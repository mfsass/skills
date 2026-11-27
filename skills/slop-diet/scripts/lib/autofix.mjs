// Fix hints and autofix for mechanical floor fails (contrast, target size, focus ring, reduced motion).
// fixLines() turns floor-probe results into one line per fail: `selector -> exact fix`.
// buildAutofix() turns the same results into CSS rules; applyAutofix() writes them into the HTML file
// as one <style id="slop-autofix"> block (replaced on each run, so the fix is idempotent). No model tokens.
import { readFileSync, writeFileSync } from 'node:fs';

const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

// The nearest shade of `fg` (mixed toward black or white, whichever side reaches the target) with `need`:1 on `bg`.
// Keeps the hue, so the look stays; returns null when neither side reaches it.
export function nearestPassing(fg, bg, need) {
  const target = need + 0.15;
  const tries = [[0, 0, 0], [255, 255, 255]].sort((a, b) => ratio(b, bg) - ratio(a, bg));
  for (const end of tries) {
    if (ratio(end, bg) < target) continue;
    for (let t = 0.04; t <= 1.0001; t += 0.04) {
      const c = fg.map((v, i) => v + (end[i] - v) * t);
      if (ratio(c, bg) >= target) return hex(c);
    }
  }
  return null;
}

const stateSel = (it) => {
  const pseudo = it.state === 'rest' ? '' : it.state === 'focus-visible' ? ':focus-visible' : `:${it.state}`;
  if (!pseudo) return it.sel;
  if (!it.ctl || it.ctl === it.sel) return `${it.sel}${pseudo}`;
  // The selector of a text inside the control often starts with the control's own (#seg > button): do not repeat it.
  if (it.sel.startsWith(`${it.ctl} > `)) return `${it.ctl}${pseudo}${it.sel.slice(it.ctl.length)}`;
  return `${it.ctl}${pseudo} ${it.sel}`;
};

const uniq = (list, key) => { const seen = new Set(); return list.filter((x) => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); };

// Target size follows the same rule as verify: 44x44 on touch (the 390 run), 24x24 on a fine pointer (the 1440 run,
// WCAG 2.5.8; a smaller target also passes when it has 24 px of space around it). `min` is 44 or 24.
const TARGET_MIN = { 390: 44, 1440: 24 };
function targetDecl(it, min = TARGET_MIN[it.at] || 44) {
  const d = [];
  if (it.h < min - 0.5) d.push(`min-height: ${min}px`);
  if (it.w < min - 0.5) d.push(`min-width: ${min}px`);
  if (it.inline && d.length) d.push('display: inline-flex', 'align-items: center');
  return d;
}
// Rule key: the selector, or for a media rule the media query plus the selector inside it.
const ruleKey = (r) => { const i = r.indexOf('{'); return r.startsWith('@media') ? r.slice(0, r.indexOf('{', i + 1)).trim() : r.slice(0, i).trim(); };
const TOUCH_MEDIA = '@media (max-width: 600px), (pointer: coarse)';

function overlapHint(o) {
  if (o.pa === 'fixed' || o.pa === 'sticky' || o.pb === 'fixed' || o.pb === 'sticky') return `a ${o.pa === 'fixed' || o.pa === 'sticky' ? o.pa : o.pb} bar covers a control at rest: put the bar in normal flow (position: static) at this width, or give the content padding-bottom equal to the bar height`;
  if (o.pa === 'absolute' || o.pb === 'absolute') return 'an absolutely placed control sits on top of the other (for example a Show button inside a password field): put both in a flex row with gap: 8px, the button beside the field';
  return 'the hit boxes overlap: add gap: 8px between them, or reduce negative margins';
}

// One line per fail, grouped by selector. Each line: `<check> <selector> <measure> -> <fix>`.
export function fixLines(floor) {
  const out = { states: [], focus: [], targets: [], overlap: [] };
  if (!floor || floor.error) return out;
  for (const it of uniq(floor.states?.items || [], (i) => `${stateSel(i)}`)) {
    const fix = nearestPassing(it.fg, it.base, it.need);
    out.states.push(`${stateSel(it)} ${hex(it.fg)} on ${hex(it.base)} = ${it.ratio}:1 (needs ${it.need}) @${it.at} -> ${fix ? `color: ${fix}` : `change the background ${hex(it.base)}; no text shade reaches ${it.need}:1`}`);
  }
  for (const it of uniq(floor.rings?.items || [], (i) => i.sel)) {
    const c = nearestPassing(it.ring, it.base, 3) || (ratio([17, 17, 17], it.base) >= 3 ? '#111111' : '#ffffff');
    out.focus.push(`${it.sel}:focus-visible ring ${it.kind} ${it.ratio}:1 w${it.width} @${it.at} -> outline: 2px solid ${c}; outline-offset: 2px`);
  }
  const tg = [...(floor.targets?.items || []).map((i) => ({ ...i, at: 390 })), ...(floor.targets1440?.items || []).map((i) => ({ ...i, at: 1440 }))];
  for (const it of uniq(tg, (i) => `${i.sel}@${i.at}`)) {
    const decl = targetDecl(it).join('; ');
    out.targets.push(`${it.sel} ${it.w}x${it.h} @${it.at} -> ${decl}${it.at === 1440 ? ' (or keep 24px of space around it)' : ' (touch: 44x44, no spacing exception)'}`);
  }
  const ov = [...(floor.targets?.overlapItems || []).map((o) => ({ ...o, at: 390 })), ...(floor.targets1440?.overlapItems || []).map((o) => ({ ...o, at: 1440 }))];
  for (const o of uniq(ov, (x) => `${x.a}|${x.b}`)) out.overlap.push(`${o.a} x ${o.b} (${o.ox}x${o.oy}px) @${o.at} -> ${overlapHint(o)}`);
  return out;
}

// CSS rules for the mechanical fails. Overlaps are never autofixed (they need a layout decision).
export function buildAutofix(floor, html) {
  const rules = [];
  const changed = { contrast: [], focus: [], targets: [], 'reduced-motion': [] };
  const drop = new Set(); // earlier autofix colour rules that still match a failing text: replaced by the new rule
  if (floor && !floor.error) {
    for (const it of uniq(floor.states?.items || [], (i) => stateSel(i))) {
      const c = nearestPassing(it.fg, it.base, it.need);
      if (!c) continue;
      rules.push(`${stateSel(it)} { color: ${c} !important; }`);
      for (const t of it.shadow || []) drop.add(t.replace(/\s+/g, ''));
      changed.contrast.push(stateSel(it));
    }
    for (const it of uniq(floor.rings?.items || [], (i) => i.sel)) {
      const c = nearestPassing(it.ring, it.base, 3) || (ratio([17, 17, 17], it.base) >= 3 ? '#111111' : '#ffffff');
      rules.push(`${it.sel}:focus-visible { outline: 2px solid ${c} !important; outline-offset: 2px !important; }`);
      changed.focus.push(it.sel);
    }
    // 1440 fails get a 24 px minimum everywhere; 390 fails get 44 px on touch and narrow screens only, so desktop
    // targets are not grown past what the 24 px rule asks.
    const bySel = new Map();
    const add = (list, at) => { for (const it of list) {
      const prev = bySel.get(it.sel) || { sel: it.sel, desk: null, touch: null, inline: false };
      const cur = prev[at] || { h: 99, w: 99 };
      prev[at] = { h: Math.min(cur.h, it.h), w: Math.min(cur.w, it.w) };
      prev.inline = prev.inline || it.inline;
      bySel.set(it.sel, prev);
    } };
    add(floor.targets1440?.items || [], 'desk');
    add(floor.targets?.items || [], 'touch');
    const box = (d) => `${d.map((x) => `${x} !important`).join('; ')}; box-sizing: border-box;`;
    for (const it of bySel.values()) {
      const dd = it.desk ? targetDecl({ ...it, ...it.desk }, 24) : [];
      const dt = it.touch ? targetDecl({ ...it, ...it.touch }, 44) : [];
      if (!dd.length && !dt.length) continue;
      if (dd.length) rules.push(`${it.sel} { ${box(dd)} }`);
      if (dt.length) rules.push(`${TOUCH_MEDIA} { ${it.sel} { ${box(dt)} } }`);
      changed.targets.push(it.sel);
    }
  }
  const own = html.replace(/<style id="slop-autofix">[\s\S]*?<\/style>/, '');
  if (!/prefers-reduced-motion/.test(own)) {
    rules.push('@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; scroll-behavior: auto !important; } }');
    changed['reduced-motion'].push('*');
  }
  return { rules, changed, drop };
}

// Write the rules into the file. Keeps earlier autofix rules (same selector is replaced), so a second run adds to them.
export function applyAutofix(file, floor) {
  const html = readFileSync(file, 'utf8');
  const { rules, changed, drop } = buildAutofix(floor, html);
  const count = Object.values(changed).reduce((a, x) => a + x.length, 0);
  if (!count) return { count: 0, summary: 'nothing to fix' };
  const old = /<style id="slop-autofix">([\s\S]*?)<\/style>/.exec(html);
  const keyOf = ruleKey;
  const merged = new Map();
  for (const r of (old ? old[1].split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('/*')) : [])) merged.set(keyOf(r), r);
  for (const k of [...merged.keys()]) if (drop.has(k.replace(/\s+/g, ''))) merged.delete(k);
  for (const r of rules) merged.set(keyOf(r), r);
  const block = `<style id="slop-autofix">\n/* verify.mjs --fix: mechanical floor fixes. Keep, or move into your own rules. */\n${[...merged.values()].join('\n')}\n</style>`;
  let next;
  if (old) next = html.replace(old[0], block);
  else if (/<\/head>/i.test(html)) next = html.replace(/<\/head>/i, `${block}\n</head>`);
  else next = html.replace(/<body[^>]*>/i, (m) => `${m}\n${block}`);
  writeFileSync(file, next);
  const summary = Object.entries(changed).filter(([, v]) => v.length).map(([k, v]) => `${k} ${v.length}${k === 'reduced-motion' ? '' : ` (${v.slice(0, 4).join(', ')}${v.length > 4 ? ', ...' : ''})`}`).join('; ');
  return { count, summary };
}
