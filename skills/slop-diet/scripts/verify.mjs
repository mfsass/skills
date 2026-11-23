#!/usr/bin/env node
// One verify command: slop-lint, probe-dots, overflow at 320, 390 and 1440, text contrast in interactive states,
// focus rings, target size and overlaps at 390, reveal at rest, console errors, page structure, and the colour split.
// Exit 1 when a floor check fails, 2 when a check could not run (error or bad input), 0 otherwise.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { noBrowserNotice, openBrowser } from './lib/browser.mjs';
import { STRATEGIES, formatSplit, measureColourSplit } from './lib/colour-split.mjs';
import { formatFloorProbes, measureFloorProbes, scrollThrough } from './lib/floor-probes.mjs';

const help = `Usage: node verify.mjs <file.html|URL> [--out DIRECTORY] [--strategy restrained|committed|drenched] [--checklist-done]

Print one summary block:
  lint      slop-lint verdict and score (files only; a URL skips lint)
  dots      probe-dots verdict, dot and pill counts, with one detail line per hit (reflex rules; not part of the exit code)
  overflow  scrollWidth against the viewport at 320, 390 and 1440; at 320 and 390 the page needs a viewport meta tag
  states    text contrast of buttons, links, inputs, tabs, toggles, segmented controls and selected items at rest,
            :hover, :focus-visible and :active (forced with CDP) at 1440 and 390; 4.5:1, or 3:1 for large text and disabled
  focus     every control shows a focus ring (outline or box-shadow) of 3:1 or more against its surroundings, 2px or wider
  overlap   no two tap targets overlap by more than 4px at 390
  targets   interactive elements at 390 are at least 44x44 CSS px (inline text links exempt)
  reveal    text at rest with JS off and under reduced motion matches the page after scrolling through
  console   JS exceptions, console errors and failed requests on load (favicon ignored)
  structure one h1, no skipped heading levels, heading sizes ordered and above body size, a main landmark, 7 nav links or fewer
  colour    base / supporting / accent share of visible area at 1440, against the band for the strategy (INFO, never a fail)
  shots     screenshots saved to ./ui-capture/ (or --out), taken after scrolling through the page
  result    which floor checks failed
Exit 0 when every floor check passes. Exit 1 when one fails: lint FAIL_FLOOR, overflow, states, focus, overlap,
targets, reveal, console or structure. Exit 2 when a check errors or times out (lint, dots, a probe, a page load):
the run is not a pass, fix the cause and run again. Exit 2 also on bad input.
--strategy sets the colour strategy from your plan (else it is inferred from the measured colours).
--checklist-done leaves out the closing reminder; pass it only after the law-checklist pass.
craft-overrides.json is read from the target file's folder, else the current folder. With no browser
(or SLOP_NO_CHROME=1) lint still runs, one NOTICE line covers the browser parts and they do not fail
the exit code. For detail run slop-lint.mjs, probe-dots.mjs or capture-ui.mjs on their own.
`;

const here = dirname(fileURLToPath(import.meta.url));
const WIDTHS = [[320, 700], [390, 844], [1440, 900]];

function runScript(name, args) {
  const out = spawnSync(process.execPath, [join(here, name), ...args], { encoding: 'utf8', timeout: 120000 });
  return { stdout: out.stdout || '', stderr: out.stderr || '', status: out.status, timedOut: out.error && out.error.code === 'ETIMEDOUT' };
}

function lintLine(target) {
  if (/^https?:\/\//.test(target)) return 'SKIPPED (URL; lint reads files)';
  const r = runScript('slop-lint.mjs', [target, '--json']);
  if (r.timedOut) return 'ERROR (lint timed out)';
  try {
    const s = JSON.parse(r.stdout);
    return `${s.verdict} (score ${s.meanScore}/100, ${s.totalFloorFails} floor, ${s.totalActiveReflex} reflex)`;
  } catch { return `ERROR (${(r.stderr || r.stdout).trim().split('\n')[0] || 'no output'})`; }
}

function dotsLine(target) {
  const r = runScript('probe-dots.mjs', [target]);
  if (r.timedOut) return { line: 'ERROR (probe-dots timed out)' };
  const text = r.stdout.trim();
  if (/^NOTICE:/m.test(text)) return { notice: text.split('\n')[0] };
  const m = /^probe-dots: (.*)$/m.exec(text);
  if (!m || r.status === 2) return { line: `ERROR (${(r.stderr || text).trim().split('\n')[0] || 'no output'})` };
  const details = text.split('\n').filter((l) => /^\s+\[(DOT|PILL)\]/.test(l));
  return { line: m[1], details };
}

function inPage() {
  const el = document.documentElement;
  const visible = (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible);
  const levels = hs.map((h) => Number(h.tagName[1]));
  let skips = 0, prev = 0;
  for (const l of levels) { if (l > prev + 1) skips++; prev = l; }
  const size = {};
  for (const h of hs) { const l = Number(h.tagName[1]); if (!(l in size)) size[l] = parseFloat(getComputedStyle(h).fontSize); }
  const body = parseFloat(getComputedStyle(document.body).fontSize);
  const present = [1, 2, 3].filter((l) => l in size);
  let sizesOk = true;
  for (let i = 1; i < present.length; i++) if (size[present[i - 1]] < size[present[i]]) sizesOk = false;
  if (present.length && !(size[present[present.length - 1]] > body)) sizesOk = false;
  const nav = [...document.querySelectorAll('nav,[role=navigation]')].find(visible);
  const navLinks = nav ? [...nav.querySelectorAll('a[href]')].filter(visible).length : 0;
  return {
    viewport: window.innerWidth,
    scrollWidth: Math.max(el.scrollWidth, document.body ? document.body.scrollWidth : 0),
    structure: { h1: levels.filter((l) => l === 1).length, skips, sizesOk, main: !!document.querySelector('main,[role=main]'), navLinks },
  };
}

function structureLine(s) {
  const bad = [];
  if (s.h1 !== 1) bad.push(`${s.h1} h1 (needs 1)`);
  if (s.skips) bad.push(`${s.skips} skipped heading level${s.skips > 1 ? 's' : ''}`);
  if (!s.sizesOk) bad.push('heading sizes not ordered h1 > h2 > h3 > body');
  if (!s.main) bad.push('no main landmark');
  if (s.navLinks > 7) bad.push(`${s.navLinks} nav links (7 or fewer)`);
  return { bad, line: bad.length ? `FAIL ${bad.join('; ')}` : `PASS (h1 ${s.h1}, no skipped levels, sizes ordered, main landmark, ${s.navLinks} nav links)` };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(help); return 0; }
  const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const outDir = valueOf('--out') || 'ui-capture';
  const strategy = valueOf('--strategy');
  if (strategy !== undefined && !STRATEGIES.includes(strategy)) { console.error(`--strategy takes ${STRATEGIES.join(', ')}; got ${strategy}`); return 2; }
  const checklistDone = args.includes('--checklist-done');
  const skip = new Set(['--out', '--strategy'].map((f) => args.indexOf(f) + 1).filter((i) => i > 0));
  const target = args.find((a, i) => !a.startsWith('--') && !skip.has(i));
  const isUrl = /^https?:\/\//.test(target || '');
  if (!target || (!isUrl && !existsSync(target))) { console.error(`Not a file or URL: ${target}`); return 2; }
  const url = isUrl ? target : pathToFileURL(resolve(target)).href;

  const lint = lintLine(target);
  const dots = dotsLine(target);
  let notice = dots.notice ? dots.notice.replace('probe-dots did not run', 'dots, overflow, states, focus, targets, reveal, console, structure, colour split and screenshots did not run') : null;
  const overflow = [];
  const shots = [];
  const errors = [];
  let structure = null;
  let split = null;
  let floor = null;
  if (!notice) {
    let session;
    try { session = await openBrowser(); } catch (error) { session = { kind: null, startError: error.message }; errors.push('browser'); }
    if (session.startError) console.error(`ERROR: verify could not start the browser: ${session.startError}`);
    else if (!session.kind) notice = noBrowserNotice('verify (overflow, states, focus, targets, reveal, console, structure, colour split, screenshots)', session.reason);
    else {
      try {
        mkdirSync(outDir, { recursive: true });
        for (const [width, height] of WIDTHS) {
          const page = await session.newPage({ width, height });
          try {
            await page.goto(url);
            await page.wait(300);
            const m = await page.evaluate(inPage);
            if (width === 1440) structure = m.structure;
            if (width <= 480 && m.viewport !== width) overflow.push(`${width} NO-VIEWPORT-META (page lays out at ${m.viewport})`);
            else overflow.push(`${width} ${m.scrollWidth <= m.viewport ? 'ok' : 'OVERFLOW'} (${m.scrollWidth}/${m.viewport})`);
            await page.evaluate(scrollThrough);
            const path = join(outDir, `verify-${width}.png`);
            await page.screenshot(path, true);
            shots.push(path);
          } catch (error) { overflow.push(`${width} ERROR (${error.message})`); } finally { await page.close(); }
        }
        floor = await measureFloorProbes(url, { session });
        split = await measureColourSplit(url, { session });
      } finally { await session.close(); }
    }
  }

  const failed = [];
  if (/^FAIL_FLOOR/.test(lint)) failed.push('lint');
  if (/^ERROR/.test(lint)) errors.push('lint');
  const floorOut = floor ? formatFloorProbes(floor) : { lines: [], failed: [], error: false };
  const structOut = structure ? structureLine(structure) : null;
  if (!notice) {
    if (/^ERROR/.test(dots.line || '')) errors.push('dots');
    if (overflow.some((o) => /ERROR/.test(o))) errors.push('overflow');
    if (overflow.some((o) => /OVERFLOW|NO-VIEWPORT-META/.test(o))) failed.push('overflow');
    if (floorOut.error) errors.push('floor probes');
    failed.push(...floorOut.failed);
    if (structOut && structOut.bad.length) failed.push('structure');
    if (!structure && !overflow.some((o) => /^1440 ERROR/.test(o))) errors.push('structure');
  }

  console.log(`verify: ${target}`);
  console.log(`  lint      ${lint}`);
  if (notice) console.log(`  ${notice}`);
  else {
    console.log(`  dots      ${dots.line}`);
    for (const d of dots.details || []) console.log(d);
    console.log(`  overflow  ${overflow.join(', ')}`);
    for (const line of floorOut.lines) console.log(line);
    if (structOut) console.log(`  structure ${structOut.line}`);
    console.log(`  colour    INFO ${formatSplit(split, strategy)}`);
    console.log(`  shots     ${shots.length ? shots.join(', ') : 'none'}`);
  }
  if (failed.length) console.log(`  result    FAIL_FLOOR: ${failed.join(', ')}${errors.length ? `; ERROR: ${errors.join(', ')}` : ''} (exit 1)`);
  else if (errors.length) console.log(`  result    ERROR: ${errors.join(', ')} did not complete, so this is not a pass; fix the cause and run again (exit 2)`);
  else {
    console.log(notice ? '  result    LINT ONLY: lint passed, but no browser checks ran, so contrast, targets and overflow are NOT verified (exit 0)' : '  result    PASS floor checks (exit 0)');
    if (!checklistDone) console.log("  Next: run the law-checklist pass (references/law-checklist.md) and report 'Checklist: ...'. Edits after it need a new verify run.");
  }
  return failed.length ? 1 : errors.length ? 2 : 0;
}

main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
