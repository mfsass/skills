#!/usr/bin/env node
/**
 * slop-lint.mjs — Fast, zero-dependency deterministic anti-slop & UX-law linter.
 *
 * Scans HTML, CSS, JSX, or TSX files in <200ms with zero LLM cost.
 * Separates findings into two explicit tiers (a blocking floor and overridable reflex flags):
 *   - FLOOR  (blocking): objective usability, accessibility and UX-law defects
 *   - REFLEX (overridable): high-signal AI-slop tells that can be explicitly overridden
 *                           in `craft-overrides.json` with a one-line design rationale
 *                           so rules never flatten brand personality into boring sameness.
 *
 * Usage:
 *   node slop-lint.mjs <file-or-dir> [--json] [--overrides craft-overrides.json]
 *   (without --overrides, craft-overrides.json is read from the target's folder, else the current folder)
 *   node slop-lint.mjs --selftest
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXTENSIONS = new Set(['.html', '.htm', '.css', '.jsx', '.tsx']);

// Controls whose circle is functional: switch thumbs, radios, sliders, loaders, avatars, step markers.
const DOT_EXEMPT = /thumb|knob|handle|spinner|loader|radio|checkbox|switch|toggle|track|slider|range|avatar|step|caret|scroll|cursor|sr-only|focus/i;
const PILL_EXEMPT = /button|btn|\bseg|toggle|switch|track|thumb|tab|input|select|search|field|knob|slider|kbd|avatar|progress|bar\b/i;

function cssRules(source) {
  const css = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
    || (/<\w/.test(source) ? '' : source);
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1].trim().replace(/^@[^{]*$/, ''), body: m[2] }))
    .filter((r) => r.selector && !r.selector.startsWith('@'));
}

function hsl(hex) {
  let h6 = hex.slice(1);
  if (h6.length === 3) h6 = [...h6].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h6.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function usesInlineBackground(source, selector) {
  const last = [...selector.matchAll(/\.([a-zA-Z][\w-]*)/g)].at(-1);
  if (!last) return false;
  return new RegExp(`class=["'][^"']*\\b${last[1]}\\b[^"']*["'][^>]*style=["'][^"']*background`, 'i').test(source);
}

// ──────────────────────────────────────────────────────────────
// RULE CATALOG (Deterministic Floor + Overridable Reflex)
// ──────────────────────────────────────────────────────────────
export const RULES = [
  // ── FLOOR: Objective UX laws, a11y, and motion safety ──
  {
    id: 'UX-FITTS-TARGET',
    tier: 'floor',
    law: "Fitts's Law / Bigger Hit Areas",
    summary: 'Interactive control height or width declared below 32px. The target is 44x44px; this lint only flags what is clearly too small, verify.mjs measures the real size at 390.',
    check(source) {
      const hits = [];
      // Match actual CSS rule blocks targeting buttons/controls (ignore ::before/::after, svg, icons, hairlines <=4px, and .sr-only)
      const blockRe = /(?:^|[}\n;])\s*([^{};@\n]*?(?:\bbutton\b|\.btn\b|\[role=["']button["']\])[^{};@\n]*?)\{([^{}]+)\}/gi;
      for (const b of source.matchAll(blockRe)) {
        const selector = b[1].trim();
        const body = b[2];
        if (/::(?:before|after)\b|\bsvg\b|\bicon\b|\.dot\b|\.sr-only\b/i.test(selector)) continue;
        for (const d of body.matchAll(/(?:^|[;\s])(height|min-height|width|min-width)\s*:\s*(\d+(?:\.\d+)?)px\b/gi)) {
          const px = Number(d[2]);
          if (px > 4 && px < 32) {
            hits.push({ match: `${selector.slice(0, 42)} { ${d[1]}: ${px}px }`, detail: `Declared ${px}px interactive dimension (<32px).` });
          }
        }
      }
      return hits;
    },
  },
  {
    id: 'UX-HICK-NAV',
    tier: 'floor',
    law: "Hick's Law",
    summary: 'Primary <nav> contains more than 7 top-level links, inflating decision time.',
    check(source) {
      const hits = [];
      const navs = source.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi);
      for (const n of navs) {
        // Count only links outside nested lists (a submenu is a second level, not a top-level choice).
        let depth = 0;
        let links = 0;
        for (const t of n[1].matchAll(/<(\/?)(?:ul|ol)\b|<a\b/gi)) {
          if (/^<a/i.test(t[0])) { if (depth <= 1) links++; } else depth = Math.max(0, depth + (t[1] ? -1 : 1));
        }
        if (links > 7) {
          hits.push({ match: `<nav> (${links} links)`, detail: `Found ${links} top-level links inside <nav> (recommended <= 7).` });
        }
      }
      return hits;
    },
  },
  {
    id: 'UX-DOHERTY-DURATION',
    tier: 'floor',
    law: 'Doherty Threshold / Snappy Timing',
    summary: 'UI transition or interaction animation exceeds 600ms (feels sluggish; state transitions run 120-220ms, see references/craft-floor.md).',
    check(source) {
      const hits = [];
      // Match CSS transition durations > 600ms (excluding deliberate ambient keyframes)
      // Each comma-separated item counts: in the shorthand its first time is the duration (the second is a delay).
      const re = /(transition(?:-duration)?)\s*:\s*([^;}\n]*)/gi;
      const time = /(?<![\w.])(\d*\.?\d+)(ms|s)\b/gi;
      for (const m of source.matchAll(re)) {
        for (const item of m[2].split(/,(?![^(]*\))/)) {
          const found = [...item.matchAll(time)][0];
          if (!found) continue;
          const val = Number(found[1]);
          const ms = found[2].toLowerCase() === 's' ? val * 1000 : val;
          if (ms > 600) {
            hits.push({ match: m[0].trim().slice(0, 64), detail: `Transition duration ${ms}ms exceeds 600ms responsiveness budget.` });
            break;
          }
        }
      }
      return hits;
    },
  },
  {
    id: 'UX-REDUCED-MOTION',
    tier: 'floor',
    law: 'Accessible Motion',
    summary: 'File declares @keyframes or CSS animations without a prefers-reduced-motion media query.',
    check(source) {
      const hasAnim = /@keyframes\b|animation\s*:/i.test(source);
      const hasGuard = /prefers-reduced-motion/i.test(source);
      if (hasAnim && !hasGuard) {
        return [{ match: '@keyframes / animation', detail: 'Animated styles found with no @media (prefers-reduced-motion: reduce) fallback.' }];
      }
      return [];
    },
  },
  {
    id: 'UX-FORM-PLACEHOLDER-ONLY',
    tier: 'floor',
    law: "Postel's Law / Accessible Forms",
    summary: 'Text input relies on placeholder without a <label>, aria-label, or aria-labelledby.',
    check(source) {
      const hits = [];
      const inputs = source.matchAll(/<input\b([^>]*)>/gi);
      for (const m of inputs) {
        const attrs = m[1];
        if (/type=["'](?:hidden|submit|button|checkbox|radio)["']/i.test(attrs)) continue;
        const hasPlaceholder = /\bplaceholder=/i.test(attrs);
        const hasAria = /\baria-label(?:ledby)?=/i.test(attrs);
        const idMatch = /\bid=["']([^"']+)["']/i.exec(attrs);
        const before = source.slice(0, m.index);
        const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label');
        const hasForLabel = wrapped || idMatch && new RegExp(`<label[^>]+for=["']${idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(source);
        if (hasPlaceholder && !hasAria && !hasForLabel) {
          hits.push({ match: m[0].slice(0, 72), detail: 'Input has placeholder but no visible <label for=...> or aria-label.' });
        }
      }
      return hits;
    },
  },
  {
    id: 'UX-CLICKABLE-DIV',
    tier: 'floor',
    law: "Jakob's Law / Native Semantics",
    summary: 'Clickable <div> or <span> imitates a button without native semantics or keyboard support.',
    check(source) {
      const hits = [];
      const re = /<(div|span)\b([^>]*\bonClick\s*=[^>]*)>/gi;
      for (const m of source.matchAll(re)) {
        const attrs = m[2];
        if (!/\brole=["']button["']/i.test(attrs) || !/\btabIndex/i.test(attrs)) {
          hits.push({ match: m[0].slice(0, 72), detail: `Clickable <${m[1]}> lacks native <button> or role="button" + tabIndex.` });
        }
      }
      return hits;
    },
  },
  {
    id: 'UX-PRESS-STATE',
    tier: 'floor',
    law: 'Exaggerated / Tactile Feedback',
    summary: 'Styles declare button/control :hover lifts without any :active press state.',
    check(source) {
      const hasHover = /(?:\.btn|button)[^{;\n]*:hover\b/i.test(source);
      const hasActive = /(?:\.btn|button)[^{;\n]*:active\b/i.test(source);
      if (hasHover && !hasActive) {
        return [{ match: 'button:hover (no :active)', detail: 'Button hover state defined without a tactile :active press response.' }];
      }
      return [];
    },
  },

  // ── REFLEX: High-signal AI slop patterns (overridable with rationale) ──
  {
    id: 'SLOP-BUZZWORDS',
    tier: 'reflex',
    law: 'Anti-Slop Copywriting',
    summary: 'Generic AI marketing buzzwords substitute for concrete product truth.',
    check(source) {
      const phrases = [
        /\bunlock\s+(?:\d+x|the\s+(?:power|full)|your|new\s+levels?)\b/i,
        /\bnext[- ]gen(?:eration)?\b/i,
        /\bsupercharge\b/i,
        /\bseamless(?:ly)?\b/i,
        /\brevolution(?:ary|ize|ise|izing|ising)\b/i,
        /\b\d+x\s+(?:velocity|productivity|workflow|faster|better|more\s+productive)\b/i,
        /\bgame[- ]chang(?:er|ing)\b/i,
        /\beffortless(?:ly)?\s+(?:scale|scaling|growth)\b/i,
        /\belevate\s+your\b/i,
        /\bunleash\b/i,
        /\bcutting[- ]edge\b/i,
        /\bstate[- ]of[- ]the[- ]art\b/i,
        /\bworld[- ]class\b/i,
        /\bto\s+the\s+next\s+level\b/i,
        /\bempower(?:s|ing)?\s+(?:your|teams|you)\b/i,
        /\bai[- ]magic\b/i,
      ];
      const hits = [];
      for (const re of phrases) {
        const m = re.exec(source);
        if (m) hits.push({ match: m[0], detail: `AI cliché "${m[0]}" found; replace with concrete action or verified outcome.` });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-PULSE-DOT',
    tier: 'reflex',
    law: 'Anti-Slop Decoration',
    summary: 'Decorative pulsing status dot or ping animation implies live telemetry without real state.',
    check(source) {
      const hits = [];
      const re = /\banimate-ping\b|\banimate-pulse\b[^"']{0,40}(?:rounded-full|dot|status)|(?:width|height)\s*:\s*[6-9]px[^;}\n]{0,80}border-radius\s*:\s*999(?:9)?px[^;}\n]{0,120}box-shadow\s*:\s*0\s+0\s+\d+px/gi;
      for (const m of source.matchAll(re)) {
        hits.push({ match: m[0].slice(0, 72), detail: 'Decorative glowing/pulsing status dot detected.' });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-NEON-BTN-HALO',
    tier: 'reflex',
    law: 'Anti-Slop Surface Discipline',
    summary: 'Primary button relies on a fuzzy colored neon box-shadow halo instead of crisp contrast.',
    check(source) {
      const hits = [];
      const re = /(?:\.btn|\.cta|button)[^{}]{0,40}\{[^}]{0,400}box-shadow\s*:\s*0\s+(?:0|\d+px)\s+(?:1[89]|[2-9]\d)px\s+rgba\(\s*(?:168|198|236|147|192|56)/gi;
      for (const m of source.matchAll(re)) {
        hits.push({ match: m[0].slice(0, 72).replace(/\s+/g, ' '), detail: 'Neon glow box-shadow halo on button surface.' });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-SPARKLE-CHROME',
    tier: 'reflex',
    law: 'Anti-Slop Iconography',
    summary: 'Sparkle emoji (✨) or rocket emoji (🚀) used as UI button/badge chrome instead of a consistent icon family.',
    check(source) {
      const hits = [];
      const count = (source.match(/[✨🚀🔥⚡🎯]/gu) || []).length;
      if (count >= 2) {
        hits.push({ match: `${count} hype emojis (✨🚀🔥⚡🎯)`, detail: `Found ${count} decorative hype emojis used as UI chrome.` });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-AURORA-TEMPLATE',
    tier: 'reflex',
    law: 'Anti-Slop Visual Originality',
    summary: 'Default purple-pink-cyan multi-blob radial aurora gradient over dark navy background.',
    check(source) {
      const hasPurple = /#(?:a855f7|9333ea|c084fc)|rgba\(\s*168\s*,\s*85\s*,\s*247/i.test(source);
      const hasPink = /#(?:ec4899|f472b6)|rgba\(\s*236\s*,\s*72\s*,\s*153/i.test(source);
      const hasRadial = /radial-gradient\s*\(/i.test(source);
      if (hasPurple && hasPink && hasRadial) {
        return [{ match: 'purple + pink radial-gradient', detail: 'Stock AI purple-pink radial aurora template detected.' }];
      }
      return [];
    },
  },
  {
    id: 'SLOP-VANITY-STATS',
    tier: 'reflex',
    law: 'Truth & Evidence',
    summary: 'Big-number stat grid (three or more bare figures like 10,000+, 99%, 4x with labels) and no source or link. Cite where the number comes from, or cut it.',
    check(source) {
      const markup = source.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '');
      if (/<cite\b|\bsource\s*:|\bsources?\b[^<]{0,40}<a\b|<a\b[^>]*>[^<]*(?:study|report|source)/i.test(markup)) return [];
      const stats = [...markup.matchAll(/>\s*([+\-]?\d[\d,.]*\s*(?:%|x|\u00d7|k|m|\+)\+?)\s*</gi)].map((m) => m[1].trim());
      if (stats.length < 3) return [];
      return [{ match: stats.slice(0, 3).join(' | '), detail: `Stat grid of ${stats.length} bare figures with no source. Cite each figure or remove the grid.` }];
    },
  },
  {
    id: 'SLOP-GRADIENT-TEXT',
    tier: 'reflex',
    law: 'Anti-Slop Typography',
    summary: 'Gradient-clipped headline text (-webkit-background-clip: text) lowers legibility and signals template defaults.',
    check(source) {
      const hits = [];
      const re = /(?:-webkit-)?background-clip\s*:\s*text/gi;
      for (const m of source.matchAll(re)) {
        hits.push({ match: m[0], detail: 'Gradient-clipped text detected; prefer crisp high-contrast ink unless brand tokens require it.' });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-SIDE-BAR',
    tier: 'reflex',
    law: 'Anti-Slop Separation',
    summary: 'One-side accent bar (border-left 2-6px or inset box-shadow stripe) on cards, rows or callouts reads as an AI template default. Use a tinted surface or a full 1px border.',
    check(source) {
      const hits = [];
      const re = /border-(?:left|inline-start)\s*:\s*[2-6]px\s+solid|border-(?:left|inline-start)-width\s*:\s*[2-6]px|box-shadow\s*:\s*inset\s+[2-6]px\s+0\s+0/gi;
      for (const m of source.matchAll(re)) {
        hits.push({ match: m[0], detail: 'One-side accent bar detected; separate with a tinted surface or a full border instead.' });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-X-NOT-Y-COPY',
    tier: 'reflex',
    law: 'Anti-Slop Copywriting',
    summary: 'AI copy cliché ("Built for X, not Y" / "Designed for X, not Y") substitutes rhetoric for concrete function.',
    check(source) {
      const hits = [];
      const re = /\b(?:built|designed|crafted|made|engineered)\s+for\s+[^.,;\n<]{3,40},\s+not\s+[^.,;\n<]{3,40}|\b(?:not|more\s+than)\s+just\s+(?:a|an|another)\s+[\w-]+|\bisn['’]t\s+(?:just\s+)?(?:a|an)?\s*[\w-]+(?:\s[\w-]+){0,3}\.\s+it['’]s\b/gi;
      for (const m of source.matchAll(re)) {
        hits.push({ match: m[0], detail: `Formulaic X-not-Y phrasing "${m[0]}" detected; state what the product does directly.` });
      }
      return hits;
    },
  },
  {
    id: 'SLOP-STATUS-DOT',
    tier: 'reflex',
    law: 'Anti-Slop Decoration',
    summary: 'Decorative colored dot (<=20px filled circle) beside a status, tag, row, option, or heading. Use a typographic label, hairline rule, or monochrome icon.',
    check(source) {
      const hits = [];
      for (const { selector, body } of cssRules(source)) {
        if (DOT_EXEMPT.test(selector)) continue;
        if (/animation\s*:[^;]*spin|border(?:-\w+)?-color\s*:\s*transparent/i.test(body)) continue;
        const sizes = [...body.matchAll(/(?:^|[;\s{])(?:min-|max-)?(width|height|inline-size|block-size|size)\s*:\s*([\d.]+)(px|rem|em)\b/gi)]
          .map((d) => Number(d[2]) * (d[3].toLowerCase() === 'px' ? 1 : 16));
        if (!sizes.length || Math.max(...sizes) > 20 || Math.min(...sizes) < 3) continue;
        if (!/border-radius\s*:\s*(?:50%|100%|9{2,}px|\d{2,}px|[\d.]+em)/i.test(body)) continue;
        const filled = /background(?:-color)?\s*:\s*(?!none|transparent)[^;]+/i.test(body)
          || usesInlineBackground(source, selector);
        if (!filled) continue;
        hits.push({ match: `${selector.slice(0, 48)} { ${Math.max(...sizes)}px circle }`, detail: 'Small filled circle used as decoration. Replace with a text label, hairline, or monochrome icon.' });
      }
      for (const m of source.matchAll(/class=["'][^"']*\b(status-dot|dot|bullet-dot|led|indicator-dot)\b[^"']*["']/gi)) {
        hits.push({ match: m[0].slice(0, 72), detail: `Markup uses dot class "${m[1]}".` });
      }
      for (const m of source.matchAll(/<([a-z][\w-]*)\b[^>]*?\bclass=["']([^"']*)["']/gi)) {
        if (/^(?:input|select|textarea|img|svg|canvas|video|iframe)$/i.test(m[1])) continue;
        const cls = m[2];
        if (/\brounded-full\b/.test(cls) && /\b(?:w|h|size)-(?:1|1\.5|2|2\.5|3|4|5)\b/.test(cls) && /\bbg-(?!transparent)/.test(cls)) {
          hits.push({ match: m[0].slice(0, 72), detail: 'Tailwind dot (rounded-full + small size + bg-*).' });
        }
      }
      const glyphs = (source.replace(/<style\b[\s\S]*?<\/style>/gi, '').match(/[●•◉⬤🟢🟡🔴]/gu) || []).length;
      if (glyphs >= 3) hits.push({ match: `${glyphs} dot glyphs`, detail: 'Dot glyphs used as status chrome.' });
      return hits;
    },
  },
  {
    id: 'SLOP-PILL-CLUTTER',
    tier: 'reflex',
    law: 'Anti-Slop Decoration',
    summary: 'Four or more tinted pill tags (fully rounded, padded, filled) compete with content. Use plain text, a hairline-bordered label, or at most three pills per view.',
    check(source) {
      const markup = source.replace(/<style\b[\s\S]*?<\/style>/gi, '');
      const pillClasses = new Set();
      for (const { selector, body } of cssRules(source)) {
        if (PILL_EXEMPT.test(selector)) continue;
        if (!/border-radius\s*:\s*(?:9{2,}px|\d{3,}px|[1-9]\d?em|50vh)/i.test(body)) continue;
        if (!/padding/i.test(body) || !/background(?:-color)?\s*:\s*(?!none|transparent)[^;]+/i.test(body)) continue;
        const last = [...selector.split(',')[0].matchAll(/\.([a-zA-Z][\w-]*)/g)].at(-1);
        if (last) pillClasses.add(last[1]);
      }
      let count = 0;
      const used = [];
      for (const cls of pillClasses) {
        const n = [...markup.matchAll(new RegExp(`class=["'][^"']*\\b${cls}\\b[^"']*["']`, 'g'))].length;
        if (n) { count += n; used.push(`.${cls}×${n}`); }
      }
      for (const m of markup.matchAll(/<(?!button\b|a\b)\w+[^>]*class=["']([^"']*)["']/gi)) {
        if (/\brounded-full\b/.test(m[1]) && /\bbg-(?!transparent)/.test(m[1]) && /\bpx-/.test(m[1])) { count += 1; }
      }
      if (count >= 4) return [{ match: used.join(' ') || `${count} rounded-full tags`, detail: `${count} tinted pills in markup. Keep at most 3 per view.` }];
      return [];
    },
  },
  {
    id: 'SLOP-CREAM-CLAY',
    tier: 'reflex',
    law: 'Anti-Slop Palette',
    summary: 'Warm cream page background paired with a terracotta, clay, or burnt-orange accent: the most common generated palette.',
    check(source) {
      const css = cssRules(source);
      const pageBg = css
        .filter((r) => /(?:^|,)\s*(?::root|html|body)\s*(?:,|$)/i.test(r.selector))
        .flatMap((r) => [...r.body.matchAll(/(?:--(?:bg|paper|page|canvas|background|surface-0)|background(?:-color)?)\s*:\s*(#[0-9a-f]{6}|#[0-9a-f]{3})\b/gi)].map((m) => m[1]));
      const cream = pageBg.find((hex) => { const [h, s, l] = hsl(hex); return h >= 28 && h <= 55 && s >= 0.12 && l >= 0.9; });
      if (!cream) return [];
      const clay = [...new Set([...source.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0]))]
        .find((hex) => { const [h, s, l] = hsl(hex); return h >= 8 && h <= 30 && s >= 0.45 && l >= 0.3 && l <= 0.62; });
      return clay ? [{ match: `bg ${cream} + accent ${clay}`, detail: 'Cream page with clay/terracotta accent. Pick a palette from references/design-references.md or derive one from the world of the brief. If the brief calls for it, add one line for SLOP-CREAM-CLAY to craft-overrides.json.' }] : [];
    },
  },
  {
    id: 'SLOP-CLASHING-PALETTE',
    tier: 'reflex',
    law: 'Anti-Slop Palette',
    summary: 'Five or more distinct saturated hues in the stylesheet: an invented palette that reads as "weird colors". Keep neutrals plus one accent and only the system colors you need.',
    check(source) {
      const css = cssRules(source).map((r) => r.body).join('\n');
      const hexes = [...new Set([...css.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi)].map((m) => m[0].toLowerCase()))];
      const buckets = new Set();
      for (const hex of hexes) {
        const [h, s, l] = hsl(hex);
        if (s >= 0.45 && l >= 0.25 && l <= 0.75) buckets.add(Math.round(h / 30) % 12);
      }
      if (buckets.size >= 5) return [{ match: `${buckets.size} hue families`, detail: `${buckets.size} distinct saturated hue families. Use one accent plus at most red, amber and green for system states.` }];
      return [];
    },
  },
  {
    id: 'SLOP-BRAND-DOT',
    tier: 'reflex',
    law: 'Anti-Slop Brand Chrome',
    summary: 'Colored status dot placed beside brand logo/wordmark looks like an AI boilerplate default.',
    check(source) {
      const hits = [];
      const re = /(?:brand|logo|wordmark)[^>]{0,120}(?:●|status-dot|mark-dot|rounded-full[^"']{0,40}bg-(?:emerald|green|lime))/gi;
      for (const m of source.matchAll(re)) {
        hits.push({ match: m[0].slice(0, 72), detail: 'Decorative colored dot detected beside brand/logo mark.' });
      }
      return hits;
    },
  },
];

function collectFiles(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
  };
  walk(targetPath);
  return out;
}

export function lintSource(source, filePath = '<memory>', overrides = {}) {
  // For HTML documents, scan markup and <style> blocks rather than embedded JS string fixtures
  const scannable = /\.html?$/i.test(filePath)
    ? source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    : source;
  const findings = [];
  for (const rule of RULES) {
    const rawHits = rule.check(scannable, filePath);
    for (const hit of rawHits) {
      const overrideReason = rule.tier === 'reflex' && rule.overridable !== false ? overrides[rule.id] : undefined;
      findings.push({
        file: filePath,
        ruleId: rule.id,
        tier: rule.tier,
        law: rule.law,
        status: overrideReason ? 'overridden' : rule.tier === 'floor' ? 'fail' : 'warn',
        overrideReason: overrideReason || null,
        match: hit.match,
        detail: hit.detail,
      });
    }
  }
  const floorFails = findings.filter((f) => f.tier === 'floor').length;
  const activeReflex = findings.filter((f) => f.tier === 'reflex' && f.status !== 'overridden').length;
  const score = Math.max(0, 100 - floorFails * 18 - activeReflex * 10);
  const verdict = floorFails > 0 ? 'FAIL_FLOOR' : activeReflex > 0 ? 'NEEDS_POLISH' : 'PASS';
  return { file: filePath, verdict, score, floorFails, activeReflex, findings };
}

export function lintPath(targetPath, overrides = {}) {
  const files = collectFiles(targetPath);
  const reports = files.map((file) => lintSource(fs.readFileSync(file, 'utf8'), file, overrides));
  const totalFloorFails = reports.reduce((s, r) => s + r.floorFails, 0);
  const totalActiveReflex = reports.reduce((s, r) => s + r.activeReflex, 0);
  const meanScore = reports.length ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length) : 100;
  const verdict = totalFloorFails > 0 ? 'FAIL_FLOOR' : totalActiveReflex > 0 ? 'NEEDS_POLISH' : 'PASS';
  return { verdict, meanScore, filesScanned: reports.length, totalFloorFails, totalActiveReflex, reports };
}

function runSelftest() {
  const slopFixture = `
    <style>
      body { background: radial-gradient(circle, rgba(168,85,247,0.3), rgba(236,72,153,0.2)); }
      .btn { height: 24px; transition: all 950ms ease; box-shadow: 0 0 24px rgba(236,72,153,0.5); }
      .btn:hover { transform: translateY(-2px); }
      @keyframes float { from { opacity: 0; } to { opacity: 1; } }
    </style>
    <nav><a>1</a><a>2</a><a>3</a><a>4</a><a>5</a><a>6</a><a>7</a><a>8</a></nav>
    <h1>Unlock 10x AI Velocity with Next-Gen AI Magic ✨ 🚀</h1>
    <div><b>10,000+</b><b>99%</b><b>+420%</b></div>
    <span class="animate-ping rounded-full"></span>
    <input type="email" placeholder="Email" />
    <div onClick="go()">Submit</div>
  `;
  const cleanFixture = `
    <style>
      .btn { min-height: 44px; transition: transform 180ms cubic-bezier(0.2,0,0,1); }
      .btn:hover { background: #e8e6df; }
      .btn:active { transform: scale(0.97); }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; }
      .card::after { content: ""; display: block; height: 2px; }
      button svg { width: 16px; height: 16px; }
      @keyframes reveal { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    </style>
    <nav><a>Engine</a><a>Docs</a><a>Pricing</a></nav>
    <h1>Simulate room acoustics before a single wall is built.</h1>
    <label for="email">Work email</label>
    <input id="email" type="email" placeholder="you@studio.com" />
    <button type="submit">Run simulation</button>
  `;
  const slopRes = lintSource(slopFixture, 'slop-fixture.html');
  const cleanRes = lintSource(cleanFixture, 'clean-fixture.html');
  const overrideRes = lintSource(slopFixture, 'override-fixture.html', {
    'SLOP-AURORA-TEMPLATE': 'Explicit brand palette from DESIGN.md',
  });
  const errors = [];
  if (slopRes.verdict !== 'FAIL_FLOOR') errors.push(`Expected FAIL_FLOOR on slopFixture, got ${slopRes.verdict}`);
  if (slopRes.floorFails < 5) errors.push(`Expected >=5 floor fails on slopFixture, got ${slopRes.floorFails}`);
  if (slopRes.activeReflex < 4) errors.push(`Expected >=4 reflex hits on slopFixture, got ${slopRes.activeReflex}`);
  if (cleanRes.verdict !== 'PASS' || cleanRes.score !== 100) errors.push(`Expected PASS (100) on cleanFixture, got ${cleanRes.verdict} (${cleanRes.score})`);
  if (overrideRes.activeReflex !== slopRes.activeReflex - 1) errors.push('Override did not suppress SLOP-AURORA-TEMPLATE');
  if (errors.length) {
    console.error('SLOP-LINT SELFTEST FAIL:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log(`SLOP-LINT SELFTEST PASS: slop=${slopRes.score}/100 (${slopRes.floorFails} floor, ${slopRes.activeReflex} reflex), clean=${cleanRes.score}/100, override verified.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) {
    runSelftest();
    process.exit(0);
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node slop-lint.mjs <file-or-dir> [--json] [--overrides file.json]
       node slop-lint.mjs --selftest

Scan HTML, CSS, JSX or TSX for floor defects (blocking) and reflex tells (overridable).
craft-overrides.json, as {"RULE-ID": "reason"}, is read from the target's folder, else the current folder.
Exit 0: no floor failure (read the reflex flags too; PASS needs zero open findings).
Exit 1: at least one floor failure.
Exit 2: bad input (missing path, no target, invalid overrides JSON).`);
    process.exit(0);
  }
  const jsonMode = args.includes('--json');
  let overrides = {};
  const ovIdx = args.indexOf('--overrides');
  const target = args.find((a, i) => !a.startsWith('--') && (ovIdx === -1 || i !== ovIdx + 1));
  if (!target) {
    console.error('Usage: node slop-lint.mjs <file-or-dir> [--json] [--overrides file.json] | --selftest');
    process.exit(2);
  }
  // Overrides: --overrides, else craft-overrides.json in the target's folder, else in the current folder.
  if (!fs.existsSync(target)) {
    console.error(`slop-lint: path not found: ${target}`);
    process.exit(2);
  }
  const targetDir = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.resolve(target) : path.dirname(path.resolve(target));
  const beside = path.join(targetDir, 'craft-overrides.json');
  try {
    if (ovIdx !== -1 && args[ovIdx + 1]) overrides = JSON.parse(fs.readFileSync(args[ovIdx + 1], 'utf8'));
    else if (fs.existsSync(beside)) overrides = JSON.parse(fs.readFileSync(beside, 'utf8'));
    else if (fs.existsSync('craft-overrides.json')) overrides = JSON.parse(fs.readFileSync('craft-overrides.json', 'utf8'));
  } catch (error) {
    console.error(`craft-overrides.json is not valid JSON (${error.message}). Expected {"RULE-ID": "reason"}.`);
    process.exit(2);
  }
  const summary = lintPath(target, overrides);
  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`slop-lint: ${summary.verdict} (score ${summary.meanScore}/100, ${summary.filesScanned} file(s), ${summary.totalFloorFails} floor fails, ${summary.totalActiveReflex} reflex flags)`);
    for (const r of summary.reports) {
      for (const f of r.findings) {
        const tag = f.status === 'overridden' ? 'OVERRIDE' : f.tier.toUpperCase();
        console.log(`  [${tag}] ${f.ruleId} (${f.law}) — ${f.detail} [${path.basename(f.file)}]`);
      }
    }
  }
  process.exit(summary.totalFloorFails > 0 ? 1 : 0);
}
