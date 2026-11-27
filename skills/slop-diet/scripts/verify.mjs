#!/usr/bin/env node
// One verify command: slop-lint, probe-dots, overflow at 320, 390 and 1440, text contrast in interactive states,
// focus rings, target size and overlaps at 390, reveal at rest, console errors, page structure, and the colour split.
// Exit 1 when a floor check fails, 2 when a check could not run (error or bad input), 0 otherwise.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { noBrowserNotice, openBrowser } from './lib/browser.mjs';
import { STRATEGIES, formatSplit, measureColourSplit } from './lib/colour-split.mjs';
import { formatFloorProbes, measureFloorProbes, scrollThrough } from './lib/floor-probes.mjs';
import { formatCraftProbes, runCraftProbes } from './lib/craft-probes.mjs';
import { OVERRIDE_IDS, PROBES, runMainPress, runTasteProbes } from './lib/taste-probes.mjs';
import { applyAutofix } from './lib/autofix.mjs';

const help = `Usage: node verify.mjs <file.html|URL> [--fix] [--shot] [--out DIRECTORY] [--strategy restrained|committed|drenched]

--fix   first measure, then write CSS fixes for mechanical fails into the file (one <style id="slop-autofix"> block:
        text contrast per state, focus rings, 44px targets, a prefers-reduced-motion block), then
        check the fixed file. Overlaps, layout and taste fails are never autofixed: they print as fix lines.
        Fails that occur only in dark mode are never autofixed: they print as [dark] fix lines.
--shot  save ONE combined screenshot (1440 left, 390 right) to <out>/shot.png. Without it no screenshot is saved.
Output: one PASS line with the names of the checks that passed, then one line per fail: FAIL <check> <selector> -> <fix>.

Checks:
  lint      slop-lint verdict and score (files only; a URL skips lint)
  dots      probe-dots verdict, dot and pill counts, with one detail line per hit (reflex rules; not part of the exit code)
  overflow  scrollWidth against the viewport at 320, 390 and 1440; at 320 and 390 the page needs a viewport meta tag
  states    text contrast of buttons, links, inputs, tabs, toggles, segmented controls and selected items at rest,
            :hover, :focus-visible and :active (forced with CDP) at 1440 and 390; 4.5:1, or 3:1 for large text and disabled.
            Measured in light and in dark (prefers-color-scheme); a fail in either scheme fails, dark-only fails print [dark]
  focus     every control shows a focus ring (outline or box-shadow) of 3:1 or more against its surroundings, 2px or wider,
            in light and in dark
  overlap   no two tap targets overlap by more than 4px at 390
  targets   touch (390): every interactive element is at least 44x44 CSS px, no spacing exception.
            pointer (1440): every interactive element is at least 24x24 CSS px (WCAG 2.5.8), or a 24px circle on its
            centre touches no other target and no other undersized target's circle. Links inside a line of prose are
            exempt at both widths. A checkbox or radio uses its label box when that is larger
  errors    each form with required (or pattern, minlength) fields shows a visible error when sent with them empty:
            native validation, aria-invalid=true, or new error text (the form is never sent)
  reveal    text at rest with JS off and under reduced motion matches the page after scrolling through
  console   JS exceptions, console errors and failed requests on load (favicon ignored)
  structure one h1, no skipped heading levels, heading sizes ordered and above body size, a main landmark, 7 nav links or fewer
  taste     hover and press (tabs: hover and selected), slow transitions (over 400 ms), segmented selected state, glyph dots, 390 px re-flow, select chevron, layout shift, accent bar
            (probe-taste.mjs; a probe id in craft-overrides.json skips it)
  main-press  press strength of the page's main action: PASS with measured values, or FAIL (weak press, colour only; no press),
            or NA when no main action is found. Advisory: it does not change the exit code.
  picker-flow  picker controls open a popup or change their value without console errors at 390 and 1440
  overlay-bounds  opened overlays fit inside the viewport at 320 and 390
  worst-case-text  every option of each select, toggle and segment keeps sibling boxes within 1px at 390 and 1440,
            and a price with its period stays on one line (TASTE-WORST-CASE-TEXT in craft-overrides.json skips it)
  card-dead-space  WARN when a card leaves more than 35% empty space below its last child
  colour    base / supporting / accent share of visible area at 1440, against the band for the strategy (INFO, never a fail)
  overlap   also checked at 1440
  shot      with --shot: one combined image at <out>/shot.png, taken after scrolling through the page
  result    which floor checks failed
  report    the Output contract line to paste: Verify: <result>. Exceptions: <craft-overrides.json entries or none>.
Floor laws (FAIL lines, exit 1): text contrast (states), focus, targets, overlap, errors, overflow, reveal under reduced
motion, console, structure, and the lint rules for targets, reduced motion, labels and clickable divs.
Advice (OPEN lines, listed as "open:" in the result and report lines, exit 0 when nothing else fails): taste,
picker-flow, overlay-bounds, worst-case-text, card-dead-space, reveal with JS off, the other lint rules.
Exit 2 when a floor check errors or times out (lint, a floor probe, a page load): the run is not a pass, fix the cause
and run again. Exit 2 also on bad input and when browser checks did not run.
Round limit: two runs per page in a round. A third run prints the last run's output and does not measure again.
score-card.mjs starts a new round. A round also ends 30 minutes after its first run.
Craft probes use a 6000 ms deadline per viewport. Each interaction family checks at most 12 controls per viewport.
Craft timeouts and control limits report WARN (incomplete). These warnings do not fail the floor.
--strategy sets the colour strategy from your plan (else it is inferred from the measured colours).
--checklist-done is accepted for compatibility and has no effect.
craft-overrides.json is read from the target file's folder, else the current folder. With no browser
(or SLOP_NO_CHROME=1) lint still runs and reports, one NOTICE line covers the browser parts, and the run
ends INCOMPLETE with exit 2: the lint floor passed but this is not a pass. For detail run slop-lint.mjs, probe-dots.mjs or capture-ui.mjs on their own.
`;

const here = dirname(fileURLToPath(import.meta.url));
const WIDTHS = [[320, 700], [390, 844], [1440, 900]];
// Verify check names that are advice (OPEN lines). Every other failed check is a floor law: the score-card caps on it.
// reveal is a floor law only under reduced motion; lint only for the rules below.
const ADVISORY = new Set(['taste', 'picker-flow', 'overlay-bounds', 'worst-case-text', 'card-dead-space']);
const LAW_LINT = /^(UX-FITTS-TARGET|UX-REDUCED-MOTION|UX-FORM-PLACEHOLDER-ONLY|UX-CLICKABLE-DIV)$/;
const ADVISORY_ERRORS = new Set(['taste probes', 'craft probes', 'dots']);
const ROUND_RUNS = 2;
const ROUND_MS = 30 * 60 * 1000;
const ROUND_FILE = join(tmpdir(), 'slop-verify-rounds.json');
const fileHash = (target) => { try { return createHash('sha1').update(readFileSync(target)).digest('hex'); } catch { return null; } };
function readRound(target) {
  let st = {};
  try { st = JSON.parse(readFileSync(ROUND_FILE, 'utf8')) || {}; } catch { st = {}; }
  const key = resolve(target);
  const entry = st[key] || { runs: [] };
  entry.runs = (entry.runs || []).filter((t) => Date.now() - t < ROUND_MS);
  return { file: ROUND_FILE, st, key, entry };
}

function runScript(name, args) {
  const out = spawnSync(process.execPath, [join(here, name), ...args], { encoding: 'utf8', timeout: 120000 });
  return { stdout: out.stdout || '', stderr: out.stderr || '', status: out.status, timedOut: out.error && out.error.code === 'ETIMEDOUT' };
}

function lintLine(target) {
  if (/^https?:\/\//.test(target)) return { line: 'SKIPPED (URL; lint reads files)', findings: [] };
  const r = runScript('slop-lint.mjs', [target, '--json']);
  if (r.timedOut) return { line: 'ERROR (lint timed out)', findings: [] };
  try {
    const s = JSON.parse(r.stdout);
    const findings = (s.reports || []).flatMap((x) => x.findings || []).filter((f) => !f.overrideReason && f.status !== 'pass' && f.status !== 'ok' && (f.tier === 'floor' || f.status === 'warn' || f.status === 'fail'))
      .map((f) => `${f.tier === 'floor' ? 'FAIL' : 'WARN'} lint     ${f.ruleId} ${String(f.match || '').slice(0, 60)} -> ${String(f.detail || f.law || '').slice(0, 140)}`);
    return { line: `${s.verdict} (score ${s.meanScore}/100, ${s.totalFloorFails} floor, ${s.totalActiveReflex} reflex)`, findings };
  } catch { return { line: `ERROR (${(r.stderr || r.stdout).trim().split('\n')[0] || 'no output'})`, findings: [] }; }
}

// craft-overrides.json beside the target file, else the current folder. The taste probes read their skip ids
// from it, and the report line lists every entry as an exception.
function readOverrides(target) {
  const beside = /^https?:\/\//.test(target) ? null : resolve(dirname(resolve(target)), 'craft-overrides.json');
  const file = beside && existsSync(beside) ? beside : existsSync('craft-overrides.json') ? 'craft-overrides.json' : null;
  if (!file) return {};
  try { const o = JSON.parse(readFileSync(file, 'utf8')); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}
const tasteSkips = (o) => (o ? PROBES.filter((p) => o[OVERRIDE_IDS[p]]) : []);
function exceptionsText(o) {
  if (!o) return 'craft-overrides.json is not a valid JSON object';
  const e = Object.entries(o).map(([id, why]) => { const r = String(why).replace(/\s+/g, ' ').trim(); return `${id} (${r.length > 100 ? r.slice(0, 99) + '…' : r})`; });
  return e.length ? e.join('; ') : 'none';
}

// One exact fix per taste probe, so the agent does not need to read the probe source.
const TASTE_FIX = {
  'hover-press': 'add a visible hover change and a visible press in the page\'s existing style (examples: fill or border change, press-in, scale), matching the other controls of that kind; a tab needs a hover change and a visible selected state, no press',
  'transition-duration': 'shorten the transition on that control to 400 ms or less (an instant change is fine; about 120-200 ms is typical)',
  'segmented-transform': 'make the chosen segment look selected: fill, border, weight, underline or tint, or a sliding indicator moved with transform',
  'decorative-dots': 'remove the dot; say the status with a text label (semantic colour optional)',
  'responsive-reflow': 'rebuild at 390: stack columns, shorter labels on one line, 16px side gutter, keep body text 16px',
  'select-chevron': 'appearance: none; padding-right: 40px; a chevron background-image at right 14px center',
  'layout-stable': 'reserve borders and font-weight in the rest state (border: 2px solid transparent; same weight), change only colour, shadow or transform',
  'accent-bar': 'remove the side border bar; mark the item with a tint, an icon or a text label',
  'worst-case-text': 'give the box a fixed min-width that fits the longest option, tabular-nums, and white-space: nowrap on a price with its period',
};
const CRAFT_FIX = {
  'picker-flow': 'make the picker open a popup or change its value on click, with no console error',
  'overlay-bounds': 'keep the opened overlay inside the viewport: max-width: calc(100vw - 32px); max-height with overflow: auto',
  'card-dead-space': 'shrink the card to its content or fill it with real content',
  'worst-case-text': TASTE_FIX['worst-case-text'],
};
function tasteOut(taste) {
  const entries = Object.entries(taste);
  const bad = entries.filter(([, r]) => r.status === 'FAIL');
  const err = entries.filter(([, r]) => r.status === 'ERROR');
  const warn = entries.filter(([, r]) => r.status === 'WARN');
  const passes = entries.filter(([, r]) => r.status === 'PASS').map(([n]) => n);
  const lines = [];
  for (const [n, r] of bad) {
    for (const f of r.findings.slice(0, 4)) lines.push(`FAIL taste    [${n}] ${f} -> ${TASTE_FIX[n] || 'fix that control'}`);
    if (r.findings.length > 4) lines.push(`FAIL taste    [${n}] and ${r.findings.length - 4} more of the same`);
  }
  for (const [n, r] of err) lines.push(`ERROR taste   [${n}] ${r.findings[0] || 'did not complete'}`);
  for (const [n, r] of warn) lines.push(`WARN taste    [${n}] incomplete: ${r.findings[0] || ''}`);
  return { lines, passes, failed: bad.length > 0, error: err.length > 0 };
}
function craftOut(craft) {
  const lines = [], failed = [], passes = [];
  let error = false;
  for (const [name, r] of Object.entries(craft)) {
    if (r.status === 'FAIL') { failed.push(name); for (const f of r.findings.slice(0, 4)) lines.push(`FAIL ${name} ${f} -> ${CRAFT_FIX[name] || 'fix that control'}`); }
    else if (r.status === 'ERROR') { if (name !== 'card-dead-space') error = true; lines.push(`ERROR ${name} ${r.findings[0] || ''}`); }
    else if (r.status === 'WARN') lines.push(`WARN ${name} ${r.findings[0] || ''}`);
    else passes.push(name);
  }
  return { lines, failed, passes, error };
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
  const vw = window.innerWidth;
  const sel = (e) => e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const wide = [];
  for (const e of document.body ? document.body.querySelectorAll('*') : []) {
    if (wide.length >= 3) break;
    const r = e.getBoundingClientRect();
    if (r.right <= vw + 1 || r.width === 0) continue;
    if ([...e.children].some((c) => c.getBoundingClientRect().right > vw + 1)) continue;
    let clipped = false;
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(n).overflowX)) { clipped = true; break; }
    if (!clipped) wide.push(`${sel(e)} ends at ${Math.round(r.right)}px`);
  }
  return {
    viewport: window.innerWidth,
    wide,
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

// One image: the 1440 shot left, the 390 shot right, top aligned, each capped in height.
async function combineShots(session, parts, outPath) {
  const imgs = parts.map(({ path, width }) => `<div style="width:${width}px;max-height:2400px;overflow:hidden;flex:none"><img src="data:image/png;base64,${readFileSync(path).toString('base64')}" style="width:${width}px;display:block"></div>`).join('');
  const tmp = `${outPath}.html`;
  writeFileSync(tmp, `<!doctype html><html><body style="margin:0;background:#888;display:flex;gap:24px;align-items:flex-start;padding:12px">${imgs}</body></html>`);
  const page = await session.newPage({ width: parts.reduce((a, p) => a + p.width, 0) + 24 * parts.length + 24, height: 900 });
  try { await page.goto(pathToFileURL(resolve(tmp)).href); await page.wait(200); await page.screenshot(outPath, true); }
  finally { await page.close(); try { unlinkSync(tmp); } catch { /* gone */ } }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(help); return 0; }
  const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const outDir = valueOf('--out') || 'ui-capture';
  const strategy = valueOf('--strategy');
  const wantFix = args.includes('--fix');
  const wantShot = args.includes('--shot');
  if (strategy !== undefined && !STRATEGIES.includes(strategy)) { console.error(`--strategy takes ${STRATEGIES.join(', ')}; got ${strategy}`); return 2; }
  const skip = new Set(['--out', '--strategy'].map((f) => args.indexOf(f) + 1).filter((i) => i > 0));
  const target = args.find((a, i) => !a.startsWith('--') && !skip.has(i));
  const isUrl = /^https?:\/\//.test(target || '');
  if (!target || (!isUrl && !existsSync(target))) { console.error(`Not a file or URL: ${target}`); return 2; }
  const url = isUrl ? target : pathToFileURL(resolve(target)).href;
  const overrides = readOverrides(target);
  // Round limit: two verify runs per page per round. A third run prints the last output instead of measuring again.
  const round = isUrl ? null : readRound(target);
  if (round && round.entry.runs.length >= ROUND_RUNS && round.entry.last) {
    console.log(`verify: ${target}`);
    console.log(`NOTICE    run limit: verify ran ${round.entry.runs.length} times on this page in this round, so it does not measure again. The output of the last run follows${round.entry.hash !== fileHash(target) ? ' (the page changed after it)' : ''}.`);
    console.log(round.entry.last);
    console.log(`NOTICE    Fix a FAIL line that is left in one edit, without verify. Then run score-card (SKILL.md step 5); a new round starts after it. (state: ${round.file} key: ${round.key})`);
    return round.entry.code;
  }

  const dots = dotsLine(target);
  let notice = dots.notice ? dots.notice.replace('probe-dots did not run', 'dots, overflow, states, focus, targets, reveal, console, structure, colour split and shot did not run') : null;
  const overflow = [];
  const overflowFix = [];
  const errors = [];
  let autofix = null;
  let shot = null;
  let structure = null;
  let split = null;
  let floor = null;
  let preFloor = null;
  let taste = null;
  let craft = null;
  let mainPress = null;
  let session = null;
  if (!notice) {
    try { session = await openBrowser(); } catch (error) { session = { kind: null, startError: error.message }; errors.push('browser'); }
    if (session.startError) console.error(`ERROR: verify could not start the browser: ${session.startError}`);
    else if (!session.kind) notice = noBrowserNotice('verify (overflow, states, focus, targets, reveal, console, structure, colour split, shot)', session.reason);
  }
  // --fix: measure once, write the mechanical fixes into the file, then check the fixed file below.
  if (wantFix && !isUrl) {
    let pre = null;
    if (session && session.kind) pre = await measureFloorProbes(url, { session });
    autofix = applyAutofix(target, pre);
    if (!autofix.count) preFloor = pre; // nothing written, so the file is unchanged: reuse the measurement
  }
  const lint = lintLine(target);
  if (session && session.kind) {
    try {
      if (wantShot) mkdirSync(outDir, { recursive: true });
      const parts = [];
      for (const [width, height] of WIDTHS) {
        const page = await session.newPage({ width, height });
        try {
          await page.goto(url);
          await page.wait(300);
          const m = await page.evaluate(inPage);
          if (width === 1440) structure = m.structure;
          if (width <= 480 && m.viewport !== width) overflow.push(`${width} NO-VIEWPORT-META (page lays out at ${m.viewport})`);
          else if (m.scrollWidth > m.viewport) { overflow.push(`${width} OVERFLOW (${m.scrollWidth}/${m.viewport})`); for (const w of m.wide) overflowFix.push(`FAIL overflow  ${w} @${width} -> min-width: 0 on its flex/grid parent, max-width: 100%, or overflow-wrap: anywhere`); }
          else overflow.push(`${width} ok`);
          if (wantShot && width !== 320) {
            await page.evaluate(scrollThrough);
            const path = join(outDir, `.part-${width}.png`);
            await page.screenshot(path, true);
            parts.push({ path, width });
          }
        } catch (error) { overflow.push(`${width} ERROR (${error.message})`); } finally { await page.close(); }
      }
      if (parts.length) {
        shot = join(outDir, 'shot.png');
        try { await combineShots(session, parts.sort((a, b) => b.width - a.width), shot); } catch (error) { shot = `not saved (${error.message})`; }
        for (const p of parts) { try { unlinkSync(p.path); } catch { /* gone */ } }
      }
      floor = preFloor || await measureFloorProbes(url, { session });
      split = await measureColourSplit(url, { session });
      const skips = tasteSkips(overrides);
      craft = await runCraftProbes(url, { session, only: ['picker-flow', 'overlay-bounds', 'card-dead-space', ...(skips.includes('worst-case-text') ? [] : ['worst-case-text'])] });
      taste = await runTasteProbes(url, { session, only: PROBES.filter((p) => p !== 'worst-case-text'), skip: skips });
      mainPress = await runMainPress(url, { session });
    } finally { await session.close(); }
  } else if (session && session.close) await session.close().catch(() => {});

  const failed = [];
  const passes = [];
  if (/^FAIL_FLOOR/.test(lint.line)) failed.push('lint'); else if (!/^ERROR/.test(lint.line)) passes.push('lint');
  if (/^ERROR/.test(lint.line)) errors.push('lint');
  const floorOut = floor ? formatFloorProbes(floor) : { lines: [], failed: [], passes: [], error: false };
  const structOut = structure ? structureLine(structure) : null;
  const tasteRes = taste ? tasteOut(taste) : null;
  const craftRes = craft ? craftOut(craft) : { lines: [], failed: [], passes: [], error: false };
  if (!notice) {
    if (/^ERROR/.test(dots.line || '')) errors.push('dots');
    if (overflow.some((o) => /ERROR/.test(o))) errors.push('overflow');
    if (overflow.some((o) => /OVERFLOW|NO-VIEWPORT-META/.test(o))) failed.push('overflow'); else if (overflow.length) passes.push('overflow');
    if (floorOut.error) errors.push('floor probes');
    failed.push(...floorOut.failed, ...craftRes.failed);
    passes.push(...floorOut.passes);
    if (craftRes.error) errors.push('craft probes');
    if (structOut && structOut.bad.length) failed.push('structure'); else if (structOut) passes.push('structure');
    if (tasteRes && tasteRes.failed) failed.push('taste');
    if (tasteRes && tasteRes.error) errors.push('taste probes');
    if (tasteRes && !tasteRes.failed && !tasteRes.error) passes.push(`taste (${tasteRes.passes.length} probes)`);
    passes.push(...craftRes.passes);
    if (!taste && !errors.includes('browser') && !overflow.some((o) => /ERROR/.test(o))) errors.push('taste probes');
    if (!structure && !overflow.some((o) => /^1440 ERROR/.test(o))) errors.push('structure');
  }

  // Gate summary: a floor-law fail caps the score; taste and craft advice prints as OPEN and does not.
  const law = [], open = [];
  for (const n of failed) {
    let isLaw = !ADVISORY.has(n);
    if (n === 'reveal') isLaw = floorOut.lines.some((l) => /^FAIL reveal\s+reduced motion:/.test(l));
    if (n === 'lint') isLaw = lint.findings.some((l) => { const r = l.match(/^FAIL lint\s+(\S+)/); return r && LAW_LINT.test(r[1]); });
    (isLaw ? law : open).push(n);
  }
  const lawErrors = errors.filter((e) => !ADVISORY_ERRORS.has(e));
  open.push(...errors.filter((e) => ADVISORY_ERRORS.has(e)).map((e) => `${e} did not complete`));
  const isOpenLine = (l) => /^FAIL (taste|picker-flow|overlay-bounds|worst-case-text|card-dead-space)\b/.test(l) || /^FAIL reveal\s+JS off:/.test(l)
    || (/^FAIL lint\s/.test(l) && !LAW_LINT.test((l.match(/^FAIL lint\s+(\S+)/) || [])[1] || ''));
  const printed = [];
  const log = (line) => { printed.push(line); console.log(line); };
  console.log(`verify: ${target}`);
  if (autofix) log(`autofix   ${autofix.count ? `wrote ${autofix.count} fixes into <style id="slop-autofix">: ${autofix.summary}` : 'nothing to fix'}`);
  if (notice) log(notice);
  if (passes.length) log(`PASS      ${passes.join(', ')}`);
  const out = [];
  if (/^FAIL_FLOOR|^NEEDS/.test(lint.line)) out.push(...lint.findings.slice(0, 6));
  else if (/^ERROR/.test(lint.line)) out.push(`ERROR lint    ${lint.line}`);
  if (overflow.some((o) => /NO-VIEWPORT-META/.test(o))) out.push('FAIL overflow  no viewport meta -> <meta name="viewport" content="width=device-width, initial-scale=1">');
  out.push(...overflowFix, ...overflow.filter((o) => /ERROR/.test(o)).map((o) => `ERROR overflow ${o}`));
  out.push(...floorOut.lines);
  if (structOut && structOut.bad.length) out.push(`FAIL structure ${structOut.bad.join('; ')} -> one h1, no skipped levels, h1 > h2 > h3 > body size, a <main>, 7 nav links or fewer`);
  if (tasteRes) out.push(...tasteRes.lines);
  out.push(...craftRes.lines);
  if (!notice && dots.line && !/^PASS/.test(dots.line)) out.push(`WARN dots     ${dots.line}${(dots.details || []).length ? ': ' + dots.details.map((d) => d.trim()).slice(0, 3).join('; ') : ''} -> remove the dot; use a text label`);
  for (const l of out) log(isOpenLine(l) ? l.replace(/^FAIL /, 'OPEN ') : l);
  const info = [];
  if (mainPress) info.push(mainPress.line.replace(/^\s+/, ''));
  if (split) info.push(formatSplit(split, strategy));
  if (info.length) log(`INFO      ${info.join(' | ')}`);
  if (shot) log(`shot      ${shot} (1440 left, 390 right)`);
  const openText = open.length ? `; open: ${open.join(', ')}` : '';
  let verdict, code;
  if (law.length) {
    log(`result    FAIL_FLOOR: ${law.join(', ')}${lawErrors.length ? `; ERROR: ${lawErrors.join(', ')}` : ''}${openText} (exit 1)`);
    verdict = `FAIL_FLOOR ${law.join(', ')}${lawErrors.length ? `; ERROR ${lawErrors.join(', ')}` : ''}`; code = 1;
  } else if (lawErrors.length) {
    log(`result    ERROR: ${lawErrors.join(', ')} did not complete, so this is not a pass; fix the cause and run again${openText} (exit 2)`);
    verdict = `ERROR ${lawErrors.join(', ')} (not a pass)`; code = 2;
  } else if (notice) {
    log('result    INCOMPLETE: browser checks did not run; lint floor passed, this is not a pass (exit 2)');
    verdict = 'INCOMPLETE, browser checks did not run (not a pass)'; code = 2;
  } else {
    log(`result    PASS floor checks${openText} (exit 0)`);
    verdict = `PASS floor checks (${WIDTHS.length} viewports, 0 console errors)`; code = 0;
  }
  log(`report    Verify: ${verdict}${openText}. Exceptions: ${exceptionsText(overrides)}.`);
  const advice = open.length ? ' OPEN lines are advice, not a floor fail: fix them in the same edit when the fix is small, else leave them; they do not cap the score.' : '';
  log(code ? `Next: apply every FAIL line above in ONE edit, or keep a tell with a one-line reason in craft-overrides.json.${advice}` : `Next: the floor passes.${advice}`);
  if (round) {
    round.entry.runs.push(Date.now());
    Object.assign(round.entry, { last: printed.join('\n'), code, hash: fileHash(target) });
    round.st[round.key] = round.entry;
    try { writeFileSync(round.file, JSON.stringify(round.st)); } catch { /* no state: no limit */ }
    console.log(`round     verify run ${round.entry.runs.length} of ${ROUND_RUNS} this round; score-card starts a new round (state: ${round.file} key: ${round.key})`);
  }
  return code;
}

main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
