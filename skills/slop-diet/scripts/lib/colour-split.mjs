#!/usr/bin/env node
// Colour split: how much of a page's visible area is base, supporting and accent colour.
// Target depends on the colour strategy (restrained, committed, drenched; see references/craft-floor.md item 1).
// Pass a strategy, or it is inferred from the measured colours. Informational only, never a fail.
//
// Method (DOM, no screenshots): open the page at 1440 wide, scroll it screen by screen
// (up to 8000px) and sample a grid of points (about 40,000 in all). At each point the
// painted colour is the topmost opaque background colour from document.elementsFromPoint,
// composited under any translucent layers above it. Saturated text colour counts as ink:
// a point inside a text line gives a quarter of its weight to the text colour. Images, video,
// canvas and iframes count as "media" and are left out of the shares. SVG shape fills (or strokes when
// the fill is none) and element borders count. Gradients, CSS background images and
// pointer-events:none overlays are not seen. Fixed and sticky
// elements count on the first screen only. Content inside an inner scroll container
// that is not visible on load is not counted.
//
// Bucketing: colours are converted to OKLab/OKLCH, then merged greedily by area. The
// largest colour seeds a family; a colour within OKLab distance 0.02 (about one just-noticeable step) of a family joins it.
//   base        the family with the largest area
//   accent      other families that are vivid (chroma >= 0.10), not very dark
//               (lightness >= 0.30) and cover 15% of the area or less
//   supporting  every other family (tinted panels, deep bands, brand surfaces)
// Hues are the area-weighted OKLCH hue of each group; chroma < 0.015 is "neutral".
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { noBrowserNotice, openBrowser } from './browser.mjs';

export const TARGET = { base: 60, supporting: 30, accent: 10 };
const MERGE_DISTANCE = 0.02;
const ACCENT_MIN_CHROMA = 0.10;
const ACCENT_MIN_LIGHTNESS = 0.30;
const ACCENT_MAX_SHARE = 0.15;
const NEUTRAL_CHROMA = 0.015;
const TEXT_MIN_CHROMA = 0.08;
const MAX_PAGE_HEIGHT = 8000;
const SAMPLE_BUDGET = 40000;

// ---- colour maths -------------------------------------------------------------------

const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

export function rgbToOklch(r, g, b) {
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const h = (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  return { L, a: A, b: B, C, h };
}

const HUE_NAMES = [[20, 'red'], [45, 'orange'], [85, 'amber'], [115, 'yellow'], [165, 'green'],
  [200, 'teal'], [235, 'cyan'], [275, 'blue'], [320, 'purple'], [350, 'pink'], [361, 'red']];
export function hueName(h) { for (const [limit, name] of HUE_NAMES) if (h < limit) return name; return 'red'; }

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// ---- in-page sampler (runs in the browser; must stay self-contained) -----------------

function samplerSource(scrollY, stepOverride) {
  const W = window.innerWidth, H = window.innerHeight;
  const total = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  if (scrollY < 0) return { height: Math.min(total, 8000), width: W, viewport: H };
  const pageH = Math.min(total, 8000);
  const step = stepOverride;
  window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
  const sy = window.scrollY;
  const start = Math.max(0, scrollY - sy);
  const cache = new WeakMap();
  const borders = new Map();
  // getComputedStyle returns rgb() for most colours but oklch(), lab(), color() and
  // color-mix() for modern ones; a 1x1 canvas converts any of them to sRGB.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = ctx.canvas.height = 1;
  const parsed = new Map();
  const parse = (css) => {
    if (!css || css === 'transparent') return [0, 0, 0, 0];
    let out = parsed.get(css);
    if (out) return out;
    const m = /^rgba?\(([^)]+)\)$/.exec(css);
    if (m) {
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      out = [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    } else {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = [d[0], d[1], d[2], d[3] / 255];
    }
    parsed.set(css, out);
    return out;
  };
  const info = (el) => {
    let c = cache.get(el);
    if (c) return c;
    const cs = getComputedStyle(el);
    const parent = el.parentElement && el.parentElement !== document.documentElement ? info(el.parentElement) : { op: 1, fixed: false };
    const media = /^(IMG|VIDEO|CANVAS|IFRAME|PICTURE|EMBED|OBJECT)$/.test(el.tagName)
      || /url\(/.test(cs.backgroundImage || '');
    let bg = parse(cs.backgroundColor);
    if (el instanceof SVGElement && bg[3] < 0.02 && !/^(svg|g|defs|clipPath|mask)$/i.test(el.tagName)) {
      const fill = cs.fill && cs.fill !== 'none' && !/^url\(/.test(cs.fill) ? parse(cs.fill) : null;
      const stroke = cs.stroke && cs.stroke !== 'none' && !/^url\(/.test(cs.stroke) ? parse(cs.stroke) : null;
      bg = fill && fill[3] > 0.02 ? fill : stroke || bg;
    }
    c = {
      bg,
      op: parent.op * (parseFloat(cs.opacity) || 0),
      fixed: parent.fixed || cs.position === 'fixed' || cs.position === 'sticky',
      media,
      svg: el instanceof SVGElement,
    };
    cache.set(el, c);
    return c;
  };
  // Text lines with a saturated colour, in viewport coordinates.
  const inks = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim() || !n.parentElement) continue;
    const pi = info(n.parentElement);
    if (pi.op < 0.5 || (pi.fixed && sy > 0)) continue;
    const cs = getComputedStyle(n.parentElement);
    if (cs.visibility === 'hidden') continue;
    const col = parse(cs.color);
    if (Math.max(col[0], col[1], col[2]) - Math.min(col[0], col[1], col[2]) < 40) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > H) continue;
      inks.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, c: col });
    }
  }
  const hist = {};
  let media = 0;
  const bump = (key, w) => { hist[key] = (hist[key] || 0) + w; };
  const canvas = (() => {
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      const bg = parse(getComputedStyle(el).backgroundColor);
      if (bg[3] >= 0.99) return bg;
    }
    return [255, 255, 255, 1];
  })();
  const limit = Math.min(H, pageH - sy);
  for (let y = start + step / 2; y < limit; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const stack = document.elementsFromPoint(x, y);
      let base = canvas.slice(0, 3);
      const layers = [];
      let isMedia = false;
      let edge = null;
      if (stack.length && !(stack[0] instanceof SVGElement)) {
        let b = borders.get(stack[0]);
        if (b === undefined) {
          const cs0 = getComputedStyle(stack[0]);
          const w = [cs0.borderTopWidth, cs0.borderRightWidth, cs0.borderBottomWidth, cs0.borderLeftWidth].map(parseFloat);
          b = w.some((v) => v >= 1) && cs0.borderTopStyle !== 'none'
            ? { w, r: stack[0].getBoundingClientRect(), c: [parse(cs0.borderTopColor), parse(cs0.borderRightColor), parse(cs0.borderBottomColor), parse(cs0.borderLeftColor)] } : null;
          borders.set(stack[0], b);
        }
        if (b) {
          const side = y - b.r.top < b.w[0] ? 0 : b.r.right - x < b.w[1] ? 1 : b.r.bottom - y < b.w[2] ? 2 : x - b.r.left < b.w[3] ? 3 : -1;
          if (side >= 0 && b.c[side][3] >= 0.99) edge = b.c[side];
        }
      }
      for (const el of edge ? [] : stack) {
        const c = info(el);
        if (c.op < 0.02 || (c.fixed && sy > 0)) continue;
        if (c.media && !c.svg) { if (c.op >= 0.5) { isMedia = true; break; } continue; }
        const a = c.bg[3] * c.op;
        if (a < 0.02) continue;
        if (a >= 0.99) { base = c.bg.slice(0, 3); break; }
        layers.push([c.bg, a]);
      }
      if (isMedia) { media += 1; continue; }
      if (edge) base = edge.slice(0, 3);
      for (let i = layers.length - 1; i >= 0; i--) {
        const [c, a] = layers[i];
        base = [base[0] * (1 - a) + c[0] * a, base[1] * (1 - a) + c[1] * a, base[2] * (1 - a) + c[2] * a];
      }
      let ink = null;
      for (const r of inks) if (x >= r.l && x <= r.r && y >= r.t && y <= r.b) { ink = r.c; break; }
      const bk = `${Math.round(base[0])},${Math.round(base[1])},${Math.round(base[2])}`;
      if (ink) { bump(`${ink[0]},${ink[1]},${ink[2]}|ink|${bk}`, 0.25); bump(bk, 0.75); } else bump(bk, 1);
    }
  }
  return { hist, media };
}

function inPage(args) {
  return new Function(`return (${samplerSource.toString()})(${JSON.stringify(args.scrollY)}, ${JSON.stringify(args.step)})`);
}

// ---- pure bucketing (importable and testable without a browser) ------------------------

// hist: { "r,g,b": weight, "r,g,b|ink|r,g,b": weight }. An ink entry is a text colour
// (weight = ink share of a point) with the surface colour under it; it counts as its own
// colour only when saturated, otherwise the weight goes back to the surface.
export function splitFromHistogram(hist, { media = 0 } = {}) {
  const colours = new Map();
  const add = (r, g, b, w) => {
    const key = `${r},${g},${b}`;
    const e = colours.get(key);
    if (e) e.w += w; else colours.set(key, { r, g, b, w, ok: rgbToOklch(r, g, b) });
  };
  for (const [key, w] of Object.entries(hist)) {
    if (!w) continue;
    const [rgb, tag, under] = key.split('|');
    const [r, g, b] = rgb.split(',').map(Number);
    if (tag === 'ink') {
      if (rgbToOklch(r, g, b).C >= TEXT_MIN_CHROMA) add(r, g, b, w);
      else add(...under.split(',').map(Number), w);
    } else add(r, g, b, w);
  }
  const list = [...colours.values()].sort((p, q) => q.w - p.w);
  const families = [];
  for (const c of list) {
    let best = null, bestD = Infinity;
    for (const f of families) {
      const d = Math.hypot(c.ok.L - f.ok.L, c.ok.a - f.ok.a, c.ok.b - f.ok.b);
      if (d < bestD) { bestD = d; best = f; }
    }
    if (best && bestD < MERGE_DISTANCE) { best.w += c.w; best.members.push(c); } else families.push({ ok: c.ok, rgb: [c.r, c.g, c.b], w: c.w, members: [c] });
  }
  families.sort((p, q) => q.w - p.w);
  const total = families.reduce((s, f) => s + f.w, 0);
  if (!families.length || total <= 0) return { ok: true, empty: true, shares: { base: 100, supporting: 0, accent: 0 }, hues: {}, families: [], media };
  const [baseF, ...rest] = families;
  const accent = [], supporting = [];
  for (const f of rest) {
    if (f.ok.C >= ACCENT_MIN_CHROMA && f.ok.L >= ACCENT_MIN_LIGHTNESS && f.w / total <= ACCENT_MAX_SHARE) accent.push(f);
    else supporting.push(f);
  }
  const sum = (arr) => arr.reduce((s, f) => s + f.w, 0);
  const describe = (arr) => {
    if (!arr.length) return null;
    const w = sum(arr);
    // Mean in OKLab (area-weighted) so hue does not wrap.
    const a = arr.reduce((s, f) => s + f.ok.a * f.w, 0) / w;
    const b = arr.reduce((s, f) => s + f.ok.b * f.w, 0) / w;
    const L = arr.reduce((s, f) => s + f.ok.L * f.w, 0) / w;
    const C = Math.hypot(a, b);
    const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    const lead = [...arr].sort((p, q) => q.w - p.w)[0];
    return { hue: Math.round(h), name: C < NEUTRAL_CHROMA ? 'neutral' : hueName(h), chroma: +C.toFixed(3), lightness: +L.toFixed(2), example: hex(...lead.rgb) };
  };
  const pct = [baseF.w, sum(supporting), sum(accent)].map((w) => (w / total) * 100);
  const rounded = pct.map((v) => Math.round(v));
  rounded[0] += 100 - rounded.reduce((s, v) => s + v, 0);
  const shares = { base: rounded[0], supporting: rounded[1], accent: rounded[2] };
  return {
    ok: true,
    shares,
    hues: { base: describe([baseF]), supporting: describe(supporting), accent: describe(accent) },
    families: families.slice(0, 8).map((f) => ({ share: +((f.w / total) * 100).toFixed(1), hex: hex(...f.rgb), chroma: +f.ok.C.toFixed(3), lightness: +f.ok.L.toFixed(2) })),
    media,
  };
}

export const STRATEGIES = ['restrained', 'committed', 'drenched'];

// Target bands, in percent of visible area.
//   restrained  neutral base, tinted panels, a small accent:        base 60-90, accent 3-15
//   committed   one colour carries a large surface (30-60%):        supporting + accent 30-60, accent 3-20
//   drenched    the brand colour is the page (base is saturated):   base 60-100, accent optional
export const BANDS = {
  restrained: { text: 'base 60-90, accent 3-15', needsAccent: true, ok: (s) => s.base >= 60 && s.accent >= 3 && s.accent <= 15 },
  committed: { text: 'supporting + accent 30-60, accent 3-20', needsAccent: true, ok: (s) => s.supporting + s.accent >= 30 && s.supporting + s.accent <= 60 && s.accent >= 3 && s.accent <= 20 },
  drenched: { text: 'base 60 or more in the brand colour, accent optional', needsAccent: false, ok: (s) => s.base >= 60 },
};

export function inferStrategy(result) {
  const baseChroma = result.hues && result.hues.base ? result.hues.base.chroma : 0;
  if (baseChroma >= ACCENT_MIN_CHROMA) return 'drenched';
  const sup = result.hues && result.hues.supporting;
  if (sup && sup.chroma >= 0.05 && result.shares.supporting >= 25) return 'committed';
  return 'restrained';
}

export function formatSplit(result, strategy = null) {
  if (!result || !result.ok) return result && result.notice ? result.notice : `Colour split: unavailable (${result && result.reason ? result.reason : 'no result'})`;
  const { base, supporting, accent } = result.shares;
  const hue = (g) => (result.hues[g] ? result.hues[g].name : 'none');
  const given = STRATEGIES.includes(strategy);
  const name = given ? strategy : inferStrategy(result);
  const band = BANDS[name];
  const verdict = band.ok(result.shares) ? 'inside the band' : 'outside the band';
  const note = band.needsAccent && accent === 0 ? '; accent 0%: the accent has lost its job, check that actions and selected states carry it' : '';
  return `Colour split: base ${base}% / supporting ${supporting}% / accent ${accent}% (${name}${given ? '' : ', inferred'}: ${band.text}; ${verdict}; hues ${hue('base')} / ${hue('supporting')} / ${hue('accent')})${note}`;
}

// ---- browser measurement -----------------------------------------------------------

// target: a file path or URL. options: { width = 1440, height = 900, session, settleMs = 600 }.
// Pass an open session from openBrowser() to reuse it; otherwise one is opened and closed.
// Returns the splitFromHistogram result plus { target, width, pageHeight }, or
// { ok: false, notice, reason } when no browser is available or the page fails to load.
export async function measureColourSplit(target, { width = 1440, height = 900, session = null, settleMs = 600 } = {}) {
  const isUrl = /^(https?|file):\/\//.test(target);
  if (!isUrl && !existsSync(target)) return { ok: false, reason: `not a file or URL: ${target}`, notice: `NOTICE: colour split did not run (not a file or URL: ${target}).` };
  const url = isUrl ? target : pathToFileURL(resolve(target)).href;
  const own = !session;
  const sess = session || await openBrowser();
  if (!sess.kind) return { ok: false, reason: sess.reason, notice: noBrowserNotice('colour split', sess.reason) };
  let page;
  try {
    page = await sess.newPage({ width, height });
    await page.goto(url);
    await page.wait(settleMs);
    const probe = await page.evaluate(inPage({ scrollY: -1, step: 0 }));
    const pageHeight = probe.height;
    const step = Math.max(8, Math.ceil(Math.sqrt((width * pageHeight) / SAMPLE_BUDGET)));
    const hist = {};
    let media = 0;
    for (let y = 0; y < pageHeight; y += height) {
      const out = await page.evaluate(inPage({ scrollY: y, step }));
      media += out.media;
      for (const [k, w] of Object.entries(out.hist)) hist[k] = (hist[k] || 0) + w;
      if (y + height >= pageHeight) break;
    }
    return { ...splitFromHistogram(hist, { media }), target, width, pageHeight, step };
  } catch (error) {
    return { ok: false, reason: error.message, notice: `NOTICE: colour split did not run (${error.message}).` };
  } finally {
    if (page) await page.close().catch(() => {});
    if (own) await sess.close();
  }
}

// ---- CLI ---------------------------------------------------------------------------

async function cli() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const sIdx = args.indexOf('--strategy');
  const strategy = sIdx >= 0 ? args[sIdx + 1] : null;
  const target = args.find((a, i) => !a.startsWith('--') && (sIdx < 0 || i !== sIdx + 1));
  if (!target || args.includes('--help')) {
    console.log('Usage: node colour-split.mjs <file.html|URL> [--strategy restrained|committed|drenched] [--json]\nPrints the base / supporting / accent share of visible area and the target band for the strategy (inferred when not given). Informational; exit 0.');
    return 0;
  }
  const result = await measureColourSplit(target);
  console.log(json ? JSON.stringify(result, null, 2) : formatSplit(result, strategy));
  return result.ok || result.notice ? 0 : 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  cli().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
}
