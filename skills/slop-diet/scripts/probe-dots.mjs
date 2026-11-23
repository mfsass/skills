#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { noBrowserNotice, openBrowser } from './lib/browser.mjs';

const help = `Usage: node probe-dots.mjs <file.html|URL> [--json] [--overrides craft-overrides.json]

Render the page at 1440x900 and 390x844 and count, from computed styles:
  dots   filled circles 3-20px wide with no text (elements, ::before, ::after)
  pills  fully rounded, filled, padded text labels 14-32px tall (not buttons or links)
Dots include <svg><circle> and <ellipse> shapes with a fill and a radius of 1.5-10px.
Functional circles are exempt: switch thumbs, radios, sliders, loaders, avatars, step markers.
Exit 1 when any dot renders or when 4 or more pills render. Exit 2 on bad input.
Overrides: same flat JSON as slop-lint ({ "RULE-ID": "reason" }). Read from --overrides, else
craft-overrides.json in the target file's folder, else in the current folder. SLOP-STATUS-DOT, SLOP-PULSE-DOT or SLOP-BRAND-DOT skips the
dot check. SLOP-PILL-CLUTTER skips the pill check.
Browser: Playwright when importable, else headless Google Chrome. With neither, prints one line
starting NOTICE: and exits 0. SLOP_NO_CHROME=1 forces that path.
`;

function inPage() {
  const exempt = /thumb|knob|handle|spinner|loader|radio|checkbox|switch|toggle|track|slider|range|avatar|step|caret|scroll|cursor/i;
  const filled = (c) => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
  const round = (cs, w, h) => {
    const r = cs.borderTopLeftRadius;
    return r.endsWith('%') ? parseFloat(r) >= 50 : parseFloat(r) >= Math.min(w, h) / 2 - 1;
  };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
  const chain = (el) => [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean).map(label).join(' ');
  const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length; };
  const dots = [];
  const pills = [];
  for (const el of document.querySelectorAll('svg circle, svg ellipse')) {
    const box = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const fill = cs.fill;
    if (box.width >= 3 && box.width <= 20 && Math.abs(box.width - box.height) <= 2 && fill && fill !== 'none' && cs.visibility !== 'hidden'
      && !exempt.test(chain(el)) && !(el.closest('svg') && el.closest('svg').querySelectorAll('circle, ellipse').length > 3 && box.width > 12)) {
      dots.push(`svg>${el.tagName.toLowerCase()} in ${chain(el.closest('svg').parentElement || el)}`);
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement || !visible(el)) continue;
    if (el.matches('input, select, textarea, img, canvas, video, iframe')) continue;
    if (exempt.test(chain(el))) continue;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (box.width >= 3 && box.width <= 20 && Math.abs(box.width - box.height) <= 2 && !el.textContent.trim()
      && round(cs, box.width, box.height) && filled(cs.backgroundColor) && !el.querySelector('svg')) {
      dots.push(chain(el));
    }
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      if (!ps.content || ps.content === 'none' || ps.content === 'normal') continue;
      const w = parseFloat(ps.width);
      const h = parseFloat(ps.height);
      if (w >= 3 && w <= 20 && Math.abs(w - h) <= 2 && round(ps, w, h) && filled(ps.backgroundColor)) dots.push(`${label(el)}${pseudo} in ${chain(el.parentElement || el)}`);
    }
    if (el.matches('button, a, label:has(input), [role="button"], [role="tab"]')) continue;
    if (box.height >= 14 && box.height <= 32 && el.textContent.trim() && el.children.length <= 1
      && round(cs, box.width, box.height) && filled(cs.backgroundColor) && parseFloat(cs.paddingLeft) >= 4
      && cs.backgroundColor !== getComputedStyle(el.parentElement).backgroundColor) {
      pills.push(chain(el));
    }
  }
  return { dots, pills };
}

function loadOverrides(args, target) {
  const idx = args.indexOf('--overrides');
  const beside = target && !/^https?:\/\//.test(target) ? resolve(dirname(resolve(target)), 'craft-overrides.json') : null;
  const file = idx >= 0 ? args[idx + 1] : (beside && existsSync(beside) ? beside : existsSync('craft-overrides.json') ? 'craft-overrides.json' : null);
  if (!file) return {};
  if (!existsSync(file)) throw new Error(`Overrides file not found: ${file}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(help); return 0; }
  const ovIdx = args.indexOf('--overrides');
  const target = args.find((a, i) => !a.startsWith('--') && (ovIdx < 0 || i !== ovIdx + 1));
  const url = /^https?:\/\//.test(target) ? target : existsSync(target) ? pathToFileURL(resolve(target)).href : null;
  if (!url) { console.error(`Not a file or URL: ${target}`); return 2; }
  let overrides;
  try { overrides = loadOverrides(args, target); } catch (error) { console.error(error.message); return 2; }
  const skipDots = ['SLOP-STATUS-DOT', 'SLOP-PULSE-DOT', 'SLOP-BRAND-DOT'].some((id) => overrides[id]);
  const skipPills = Boolean(overrides['SLOP-PILL-CLUTTER']);
  if (skipDots && skipPills) { console.log('probe-dots: SKIPPED (craft-overrides.json allows both dots and pills)'); return 0; }
  const session = await openBrowser();
  if (!session.kind) { console.log(noBrowserNotice('probe-dots', session.reason)); return 0; }
  const result = { url, browser: session.kind, skipped: [skipDots && 'dots', skipPills && 'pills'].filter(Boolean), viewports: {} };
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      const page = await session.newPage({ width, height });
      await page.goto(url);
      await page.wait(300);
      result.viewports[name] = await page.evaluate(inPage);
      await page.close();
    }
  } finally {
    await session.close();
  }
  const dots = skipDots ? 0 : Math.max(...Object.values(result.viewports).map((v) => v.dots.length));
  const pills = skipPills ? 0 : Math.max(...Object.values(result.viewports).map((v) => v.pills.length));
  result.verdict = dots === 0 && pills < 4 ? 'PASS' : 'FAIL';
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`probe-dots: ${result.verdict} (${dots} dot(s), ${pills} pill(s)${result.skipped.length ? `; skipped by overrides: ${result.skipped.join(', ')}` : ''})`);
    const seen = new Set();
    for (const [name, v] of Object.entries(result.viewports)) {
      const tag = name === 'mobile' ? ' (390 only)' : '';
      if (!skipDots) for (const s of [...new Set(v.dots)].slice(0, 8)) if (!seen.has(`D${s}`)) { seen.add(`D${s}`); console.log(`  [DOT]${tag} ${s}`); }
      if (!skipPills) for (const s of [...new Set(v.pills)].slice(0, 8)) if (!seen.has(`P${s}`)) { seen.add(`P${s}`); console.log(`  [PILL]${tag} ${s}`); }
    }
  }
  return result.verdict === 'PASS' ? 0 : 1;
}

main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
