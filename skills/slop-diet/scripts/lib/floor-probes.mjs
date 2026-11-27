// Live floor probes for verify.mjs: text contrast in interactive states (390 and 1440), target size,
// text visible with JS off and under reduced motion, console errors.
// States are forced with CDP CSS.forcePseudoState (Chrome directly, Playwright through a CDP session).
// The in-page functions run in the browser and must stay self-contained; they share window.__slop.
import { fixLines, hex, nearestPassing, ratio } from './autofix.mjs';

const STATE_SETS = [
  ['rest', []],
  ['hover', ['hover']],
  ['focus-visible', ['focus', 'focus-visible']],
  ['active', ['active']],
];

// ---- in-page: shared helpers on window.__slop -----------------------------------------

export function installToolkit() {
  const T = {};
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  ctx.canvas.width = ctx.canvas.height = 1;
  T.parse = (css) => {
    if (!css || css === 'transparent') return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  T.over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  T.lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  T.ratio = (a, b) => { const x = T.lum(a), y = T.lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  T.label = (el) => {
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}${t ? ' "' + t + '"' : ''}`;
  };
  // A short CSS selector for fix lines and autofix rules: #id, else tag.class.class, else parent > tag.
  T.sel = (el, depth = 0) => {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z_][\w-]*$/.test(c) && !/^(is-|js-|active$|selected$|on$)/.test(c)).slice(0, 2) : [];
    let s = el.tagName.toLowerCase() + cls.map((c) => '.' + c).join('');
    if (el.tagName === 'INPUT' && el.type) s += `[type=${el.type}]`;
    if (!cls.length && depth < 1 && el.parentElement && el.parentElement !== document.body) s = `${T.sel(el.parentElement, depth + 1)} > ${s}`;
    return s;
  };
  // A selector that matches exactly this element, for fix rules that must not touch look-alike elements on another
  // surface (for example `dd > small` on a dark panel and on a light card). Keeps state attributes, so the selected
  // segment of a control stays addressable after the selection moves. Climbs the ancestors until the match is unique.
  T.usel = (el) => {
    const STATE = ['aria-checked', 'aria-selected', 'aria-pressed', 'aria-current', 'aria-expanded'];
    const count = (css) => { try { return document.querySelectorAll(css).length; } catch { return 99; } };
    const plain = (n) => {
      if (n.id && /^[A-Za-z][\w-]*$/.test(n.id) && count('#' + n.id) === 1) return { text: '#' + n.id, id: true };
      const cls = typeof n.className === 'string' ? n.className.trim().split(/\s+/).filter((c) => /^[A-Za-z_][\w-]*$/.test(c) && !/^(is-|js-)/.test(c)).slice(0, 3) : [];
      let t = n.tagName.toLowerCase() + cls.map((c) => '.' + c).join('');
      for (const a of STATE) { const v = n.getAttribute(a); if (v !== null && /^[\w-]+$/.test(v)) t += `[${a}=${v}]`; }
      return { text: t, id: false };
    };
    const nth = (n, text) => {
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      return same.length > 1 ? `${text}:nth-of-type(${same.indexOf(n) + 1})` : text;
    };
    for (const useNth of [false, true]) {
      const parts = [];
      for (let n = el, d = 0; n && n !== document.documentElement && d < 8; n = n.parentElement, d++) {
        const p = plain(n);
        parts.unshift(useNth && !p.id ? nth(n, p.text) : p.text);
        const css = parts.join(' > ');
        if (p.id || n === document.body) { if (count(css) === 1) return css; break; }
        // A state attribute alone ([aria-checked=true]) would also catch a later selected item elsewhere: anchor it to its parent.
        if (count(css) === 1 && (parts.length > 1 || !STATE.some((a) => el.hasAttribute(a)))) return css;
      }
    }
    return T.sel(el);
  };
  T.effOpacity = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  // .sr-only patterns: clipped to nothing, or 1px and overflow hidden.
  T.srOnly = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const clipped = /rect\(\s*0(px)?[ ,]+0(px)?[ ,]+0(px)?[ ,]+0(px)?\s*\)/.test(cs.clip)
      || /inset\(\s*(50|100)%/.test(cs.clipPath) || /^polygon\(\s*0 0, 0 0/.test(cs.clipPath);
    return (clipped && (cs.position === 'absolute' || cs.position === 'fixed')) || (r.width <= 1 && r.height <= 1 && cs.overflow !== 'visible');
  };
  // Not shown to a person: display none, visibility hidden, opacity 0 on it or an ancestor, sr-only, or inside a
  // zero-size clipping container.
  T.hidden = (el) => {
    let first = true;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || (first && cs.visibility !== 'visible') || parseFloat(cs.opacity) === 0) return true;
      if (T.srOnly(n)) return true;
      if (!first && cs.overflow !== 'visible') {
        const r = n.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return true;
      }
      first = false;
    }
    return false;
  };
  // Painted background under the centre of a text box: the elements the browser paints there, from the text host down,
  // then the host's ancestors that are not hit-testable. Image or gradient layers make the reading unknown.
  T.backdrop = (host, rect) => {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let layers = [];
    if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
      const stack = document.elementsFromPoint(cx, cy);
      const idx = stack.indexOf(host);
      if (idx >= 0) layers = stack.slice(idx);
    }
    for (let n = host; n; n = n.parentElement) if (!layers.includes(n)) layers.push(n);
    // A positioned pseudo-element that covers the point with a colour joins the stack above its owner.
    const withPseudo = [];
    for (const n of layers) {
      const own = getComputedStyle(n);
      if (own.position !== 'static' && (n === host || host.contains(n) || n.contains(host))) {
        const nr = n.getBoundingClientRect();
        for (const ps of ['::before', '::after']) {
          const p = getComputedStyle(n, ps);
          if (p.content === 'none' || p.content === 'normal' || p.position !== 'absolute') continue;
          let l = nr.left + (parseFloat(p.left) || 0), t = nr.top + (parseFloat(p.top) || 0);
          let w = parseFloat(p.width), h = parseFloat(p.height);
          // A sliding thumb is often moved with transform: translateX(...) (and scaled): place the box where it is painted.
          // Only for a flat-colour pseudo (a thumb): a moved gradient or image pseudo (a decorative ring) would turn text under it into "unknown".
          if (p.transform && p.transform !== 'none' && p.backgroundImage === 'none') {
            try { const m = new DOMMatrixReadOnly(p.transform); l += m.e + (w * (1 - m.a)) / 2; t += m.f + (h * (1 - m.d)) / 2; w *= m.a; h *= m.d; } catch { /* keep the unmoved box */ }
          }
          if (!(w > 0 && h > 0) || cx < l || cx > l + w || cy < t || cy > t + h) continue;
          if (p.backgroundImage !== 'none') withPseudo.push({ el: n, style: p, pseudo: true });
          else if (T.parse(p.backgroundColor)[3] > 0) withPseudo.push({ el: n, style: p, pseudo: true });
        }
      }
      withPseudo.push({ el: n, style: own });
    }
    let acc = [0, 0, 0, 0];
    let unknown = false;
    for (const { el, style } of withPseudo) {
      if (acc[3] >= 0.999) break;
      if (style.backgroundImage !== 'none') { unknown = true; break; }
      const c = T.parse(style.backgroundColor);
      acc = T.over([c[0], c[1], c[2], c[3] * T.effOpacity(el)], acc);
    }
    return { base: T.over(acc, [255, 255, 255, 1]), unknown };
  };
  // Characters of text a person can see (visible) and characters in the DOM (total).
  T.textLength = () => {
    let visible = 0, total = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const cache = new Map();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      const parent = node.parentElement;
      if (!text || !parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(parent.tagName)) continue;
      total += text.length;
      if (!cache.has(parent)) cache.set(parent, !T.hidden(parent) && parent.getBoundingClientRect().width >= 1);
      if (cache.get(parent)) visible += text.length;
    }
    return { visible, total };
  };
  window.__slop = T;
  return true;
}

// ---- in-page: tag candidates in document order, return how many ----------------------

function tagCandidates() {
  const T = window.__slop;
  // Controls, labels, and anything that marks a selected or toggled state (segments, switches, pills, chips, tabs).
  const SEL = 'button, a[href], label, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link],'
    + ' [role=menuitem], [role=radio], [role=switch], [role=checkbox], [aria-selected], [aria-pressed], [aria-checked],'
    + ' [aria-current], [data-state], [data-active], [data-selected], .active, .selected, .is-active, .on,'
    + ' [class*=seg], [class*=toggle], [class*=switch], [class*=tab], [class*=pill], [class*=chip], [class*=option]';
  for (const old of document.querySelectorAll('[data-slop-i]')) old.removeAttribute('data-slop-i');
  let n = 0;
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || T.hidden(el)) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth) continue;
    el.setAttribute('data-slop-i', String(n++));
  }
  const style = document.createElement('style');
  // pointer-events auto, so elementsFromPoint also sees sliding thumbs and overlays that ignore the pointer.
  style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;pointer-events:auto!important}';
  document.head.appendChild(style);
  return n;
}

// ---- in-page: contrast of every text node in every tagged element, in the current forced state -----

function measureContrast(state) {
  const T = window.__slop;
  const NO_TEXT_INPUT = /^(checkbox|radio|range|color|file|image)$/;
  const rows = [];
  const unknown = [];
  const done = new Set();
  const startY = window.scrollY;
  // The box of the text now: earlier reads scroll the page, so a box taken when the text was collected is stale.
  const liveRect = (host, node) => {
    if (!node) return host.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect();
  };
  const read = (name, host, node, disabled) => {
    let rect = liveRect(host, node);
    const cy = rect.top + rect.height / 2;
    // Instant, and on the element itself, so a page with smooth scrolling or an inner scroll container (a settings
    // pane, a modal) shows the text at the point we read; otherwise the painted thumb under it is not hit-testable.
    if (cy < 0 || cy > window.innerHeight || rect.left < 0 || rect.right > window.innerWidth) { host.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); rect = liveRect(host, node); }
    const cs = getComputedStyle(host);
    const { base, unknown: noBg } = T.backdrop(host, rect);
    if (noBg) { unknown.push(name); return; }
    const ink = T.parse(cs.color);
    const fg = T.over([ink[0], ink[1], ink[2], ink[3] * T.effOpacity(host)], base);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || (cs.fontWeight === 'bold' ? 700 : 400);
    const large = size >= 24 || (weight >= 700 && size >= 18.66);
    const need = disabled ? 3.0 : large ? 3.0 : 4.5;
    const r = T.ratio(fg, base);
    rows.push({ label: name, ratio: Math.round(r * 100) / 100, need, ok: r + 0.005 >= need, disabled, sel: T.sel(host), host, ctl: ctlSel, fg: fg.slice(0, 3).map(Math.round), base: base.slice(0, 3).map(Math.round) });
  };
  let ctlSel = null;
  const textHosts = (root) => {
    const found = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const seen = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const host = node.parentElement;
      if (!node.textContent.trim() || !host || seen.has(host) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TEXTAREA)$/.test(host.tagName) || host.closest('svg')) continue;
      if (T.hidden(host)) continue;
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      seen.add(host);
      found.push([host, r, node]);
    }
    return found;
  };
  for (const el of document.querySelectorAll('[data-slop-i]')) {
    if (el.tagName === 'INPUT' && NO_TEXT_INPUT.test(el.type)) continue;
    const disabled = el.matches(':disabled, [aria-disabled="true"]');
    if (disabled && state !== 'rest') continue;
    const hosts = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ? [[el, el.getBoundingClientRect(), null]] : textHosts(el);
    for (const [host, , node] of hosts) {
      if (done.has(host)) continue;
      done.add(host);
      ctlSel = T.sel(el);
      read(T.label(host.closest('button, a, label, summary, [role], input, select') || host), host, node, disabled);
    }
  }
  // Every other visible text in the page, at rest (disabled text needs 3:1).
  if (state === 'rest') {
    for (const [host, , node] of textHosts(document.body)) {
      if (done.has(host)) continue;
      done.add(host);
      ctlSel = null;
      read(T.label(host), host, node, !!host.closest(':disabled, [aria-disabled="true"]'));
    }
  }
  window.scrollTo({ top: startY, left: 0, behavior: 'instant' });
  // A failing text whose short selector also matches other text with another reading (or text not measured here) gets a
  // selector for that element alone, so its fix cannot break the look-alikes: the same `dd > small` on a dark panel and
  // on a light card, or the selected and unselected segment of one control.
  const bySel = new Map();
  for (const row of rows) { if (!bySel.has(row.sel)) bySel.set(row.sel, []); bySel.get(row.sel).push(row); }
  for (const row of rows) {
    if (row.ok) continue;
    const group = bySel.get(row.sel);
    const same = group.every((g) => g.fg.join() === row.fg.join() && g.base.join() === row.base.join());
    if (!same || document.querySelectorAll(row.sel).length > group.length) row.sel = T.usel(row.host);
  }
  // Rules a previous --fix run wrote that still match a failing text: they did not help (or hurt), so autofix replaces them.
  const old = [];
  const sheet = document.getElementById('slop-autofix') && document.getElementById('slop-autofix').sheet;
  for (const rule of sheet ? [...sheet.cssRules] : []) if (rule.selectorText && rule.style && rule.style.color) old.push(rule.selectorText);
  for (const row of rows) {
    if (!row.ok && old.length) row.shadow = old.filter((t) => { try { return row.host.matches(t.replace(/:(hover|focus-visible|active)\b/g, '').trim() || '*'); } catch { return false; } });
    delete row.host;
  }
  return { rows, unknown };
}

// ---- in-page: focus indicator under :focus-visible (run with the focus state forced) -----------------

function measureFocusRings() {
  const T = window.__slop;
  const COLOR_RE = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
  const FOCUSABLE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
  const out = { checked: 0, bad: [], items: [] };
  for (const el of document.querySelectorAll('[data-slop-i]')) {
    const role = el.getAttribute('role') || '';
    if (!(FOCUSABLE.test(el.tagName) || /^(button|tab|link|menuitem|radio|switch|checkbox)$/.test(role) || el.hasAttribute('tabindex'))) continue;
    if (el.matches(':disabled, [aria-disabled="true"]') || (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && T.srOnly(el))) continue;
    const rect = el.getBoundingClientRect();
    const parent = el.parentElement || document.body;
    const { base } = T.backdrop(parent, rect);
    const s = getComputedStyle(el);
    let kind = 'none', ratio = 0, width = 0, ring = null;
    const ow = parseFloat(s.outlineWidth) || 0;
    if (s.outlineStyle === 'auto') { kind = 'auto'; ratio = 21; width = Math.max(ow, 2); }
    else if (s.outlineStyle !== 'none' && ow > 0) {
      const c = T.parse(s.outlineColor);
      kind = 'outline'; ratio = T.ratio(T.over(c, base), base); width = ow; ring = c;
    }
    if (s.boxShadow && s.boxShadow !== 'none') {
      const parts = []; let depth = 0, cur = '';
      for (const ch of s.boxShadow) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
      parts.push(cur);
      for (const p of parts) {
        if (/inset/.test(p)) continue;
        const col = (p.match(COLOR_RE) || [])[0];
        const nums = p.replace(COLOR_RE, '').match(/-?[\d.]+px/g) || [];
        const spread = nums.length >= 4 ? parseFloat(nums[3]) : 0, blur = nums.length >= 3 ? parseFloat(nums[2]) : 0;
        const c = col && T.parse(col);
        if (!c || c[3] < 0.2 || (spread < 2 && blur < 3)) continue;
        const r = T.ratio(T.over(c, base), base);
        if (kind === 'none' || r > ratio) { kind = kind === 'outline' ? 'outline+shadow' : 'shadow'; ratio = r; width = Math.max(width, spread || blur); ring = c; }
      }
    }
    out.checked++;
    if (kind === 'none' || ratio < 3 || width < 2) {
      out.bad.push(`${T.label(el)} ring ${kind} ${Math.round(ratio * 100) / 100}:1 w${width}`);
      const accent = T.parse(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || s.color);
      out.items.push({ sel: T.sel(el), kind, ratio: Math.round(ratio * 100) / 100, width, ring: (ring && ring[3] > 0.2 ? ring : accent).slice(0, 3).map(Math.round), base: base.slice(0, 3).map(Math.round) });
    }
  }
  return out;
}

// ---- in-page: target size at the current viewport -------------------------------------

// pointer=false (390, touch): every control is at least 44x44, no spacing exception.
// pointer=true (1440, fine pointer, WCAG 2.5.8): every control is at least 24x24, or a 24px circle on its centre touches
// no other target and no other undersized target's circle. Links inside running text are exempt in both modes.
function measureTargets(pointer) {
  const T = window.__slop;
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link],'
    + ' [role=menuitem], [role=radio], [role=checkbox], [role=switch]';
  const MIN = pointer ? 23.5 : 43.5;
  const out = { width: window.innerWidth, mode: pointer ? 'pointer 24px (WCAG 2.5.8)' : 'touch 44px', checked: 0, bad: [], overlaps: [], items: [], overlapItems: [], spaced: 0 };
  const placed = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return p; } return getComputedStyle(el).position === 'absolute' ? 'absolute' : ''; };
  const boxes = [];
  for (const el of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(el);
    let box = el;
    // A checkbox or radio is also pressed through its label: the target is the label box when the input is hidden or
    // the label box is larger.
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && el.labels && el.labels.length) {
      const lab = el.labels[0];
      if (T.hidden(el)) { box = lab; if (T.hidden(box)) continue; }
      else if (!T.hidden(lab)) { const a = el.getBoundingClientRect(), b = lab.getBoundingClientRect(); if (b.width * b.height > a.width * a.height) box = lab; }
    } else if (T.hidden(el)) continue;
    const r = box.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth) continue;
    if (el.tagName === 'A' && cs.display === 'inline') {
      // A link inside running text is exempt: the line it sits on holds at least 10 characters of other prose. Only text
      // in the same inline flow counts (text whose nearest non-inline ancestor is the link's block), so a lone link in a
      // header or card (a "Back to workspace" link above an h1) is a target, not running text.
      let block = el.parentElement;
      while (block && getComputedStyle(block).display === 'inline') block = block.parentElement;
      if (block) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let other = 0;
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.parentElement.closest('a[href], button')) continue;
          let host = node.parentElement;
          while (host && host !== block && getComputedStyle(host).display === 'inline') host = host.parentElement;
          if (host === block) other += node.textContent.replace(/\s+/g, ' ').trim().length;
        }
        if (other >= 10) continue;
      }
    }
    out.checked++;
    boxes.push({ el, box, label: T.label(el), r, small: r.width < MIN || r.height < MIN });
  }
  const dist = (x, y, q) => Math.hypot(Math.max(q.left - x, 0, x - q.right), Math.max(q.top - y, 0, y - q.bottom));
  for (const a of boxes) {
    if (!a.small) continue;
    let near = null;
    if (pointer) {
      // WCAG 2.5.8 spacing: a 24px circle on the centre of an undersized target must not touch another target or the
      // circle of another undersized target.
      const cx = a.r.left + a.r.width / 2, cy = a.r.top + a.r.height / 2;
      for (const b of boxes) {
        if (b === a || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (dist(cx, cy, b.r) < 12 || (b.small && Math.hypot(cx - (b.r.left + b.r.width / 2), cy - (b.r.top + b.r.height / 2)) < 24)) { near = b.label; break; }
      }
      if (!near) { out.spaced++; continue; }
    }
    out.bad.push({ label: T.label(a.el) + (near ? ` (near ${near})` : ''), w: Math.round(a.r.width), h: Math.round(a.r.height) });
    out.items.push({ sel: T.sel(a.box), w: Math.round(a.r.width), h: Math.round(a.r.height), inline: getComputedStyle(a.box).display === 'inline' });
  }
  // Two hit boxes that overlap by more than 4px in both axes, where neither holds the other (nested controls are not overlaps).
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el) || (a.el.labels && [...a.el.labels].includes(b.el)) || (b.el.labels && [...b.el.labels].includes(a.el))) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 4 && oy > 4) {
        out.overlaps.push(`${a.label} x ${b.label} (${Math.round(ox)}x${Math.round(oy)}px)`);
        out.overlapItems.push({ a: T.sel(a.el), b: T.sel(b.el), pa: placed(a.el), pb: placed(b.el), ox: Math.round(ox), oy: Math.round(oy) });
      }
    }
  }
  return out;
}

// ---- in-page: a visible error when a form is sent with its required fields empty -------------------

// For each visible form with constrained fields (required, pattern, minlength, aria-required): empty those fields, press
// the submit button, and look for an error a person can see. Any of these passes: native validation is on (the browser
// shows its own message and blocks the send), a field gets aria-invalid=true, or a visible error element or new error
// text appears. The form is never sent: a window listener cancels the submit after the page's own handlers ran.
async function emptySubmit() {
  const T = window.__slop;
  const FIELD = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea';
  const ERR_SEL = '[role=alert], [aria-live], [class*=error], [class*=invalid], [id*=error], [data-error], [class*=message], [class*=feedback]';
  const ERR_WORDS = /required|enter |please|invalid|must|missing|error|fix|can.?t be (empty|blank)|cannot be (empty|blank)|choose|select an?|add an?|is empty|too short/i;
  const shown = (e) => !T.hidden(e) && e.getBoundingClientRect().width >= 1 && e.textContent.trim().length >= 3;
  const errTexts = () => new Set([...document.querySelectorAll(ERR_SEL)].filter(shown).map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const lines = () => new Set(document.body.innerText.split('\n').map((l) => l.trim()).filter(Boolean));
  const out = { checked: 0, bad: [], items: [], notes: [] };
  window.addEventListener('submit', (e) => e.preventDefault());
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a && !a.getAttribute('href').startsWith('#')) e.preventDefault(); }, true);
  const forms = [...document.forms].filter((f) => !T.hidden(f) && f.getBoundingClientRect().width >= 1).slice(0, 3);
  for (const f of forms) {
    const constrained = [...f.querySelectorAll(FIELD)].filter((el) => !el.disabled && !T.hidden(el.type === 'checkbox' || el.type === 'radio' ? (el.closest('label') || el) : el)
      && (el.required || el.hasAttribute('pattern') || el.hasAttribute('minlength') || el.getAttribute('aria-required') === 'true'));
    if (!constrained.length) continue;
    const btn = [...f.querySelectorAll('button[type=submit], input[type=submit], button:not([type])')].find((b) => !T.hidden(b) && !b.disabled)
      || (f.id ? [...document.querySelectorAll(`button[form="${CSS.escape(f.id)}"]`)].find((b) => !T.hidden(b) && !b.disabled) : null);
    if (!btn) { out.notes.push(`${T.sel(f)}: no enabled submit button`); continue; }
    // Empty every constrained field the way a person would (input and change events).
    for (const el of constrained) {
      const t = (el.type || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio') { if (el.checked && t === 'checkbox') el.click(); continue; }
      if (el.tagName === 'SELECT') { const i = [...el.options].findIndex((o) => o.value === ''); if (i < 0) continue; el.selectedIndex = i; }
      else { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ''); }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    out.checked++;
    const native = !f.noValidate && !btn.formNoValidate && !f.checkValidity();
    const errs0 = errTexts(), lines0 = lines();
    btn.click();
    await new Promise((r) => setTimeout(r, 450));
    const invalid = [...document.querySelectorAll('[aria-invalid=true]')].filter((e) => !T.hidden(e)).length;
    const newErr = [...errTexts()].filter((t) => !errs0.has(t));
    const newLines = [...lines()].filter((l) => !lines0.has(l) && ERR_WORDS.test(l));
    if (native || invalid || newErr.length || newLines.length) continue;
    out.bad.push(`${T.sel(f)}: empty submit (${constrained.length} constrained fields emptied) shows no visible error`);
    out.items.push({ sel: T.sel(f) });
  }
  return out;
}

async function formErrorsCheck(session, url) {
  const page = await session.newPage({ width: 1440, height: 900 });
  try {
    await page.goto(url);
    await page.wait(300);
    await page.evaluate(installToolkit);
    return await page.evaluate(emptySubmit);
  } finally { await page.close(); }
}

// ---- in-page: scroll through the page so one-shot scroll reveals run -------------------

export async function scrollThrough() {
  const step = Math.max(200, Math.round(window.innerHeight * 0.6));
  const end = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  for (let y = 0; y <= end; y += step) {
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    await new Promise((res) => setTimeout(res, 60));
  }
  await new Promise((res) => setTimeout(res, 700));
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  await new Promise((res) => setTimeout(res, 100));
  return true;
}

// ---- driver -------------------------------------------------------------------------

async function contrastAcrossStates(page, width) {
  await page.evaluate(installToolkit);
  const count = await page.evaluate(tagCandidates);
  let nodeIds = [];
  if (count) {
    await page.cdp('DOM.enable');
    await page.cdp('CSS.enable');
    const { root } = await page.cdp('DOM.getDocument', { depth: 0 });
    ({ nodeIds } = await page.cdp('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-slop-i]' }));
  }
  const fails = [];
  const rings = { checked: 0, bad: [], items: [] };
  const items = [];
  const seen = new Set();
  const unknown = new Set();
  let checked = 0;
  for (const [name, forced] of STATE_SETS) {
    if (!count && name !== 'rest') continue;
    // A state that cannot be forced is an error, never a pass: the readings would be rest styles.
    for (const nodeId of nodeIds) {
      try { await page.cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced }); }
      catch (error) { throw new Error(`could not force the ${name} state at ${width}px (${String(error.message).split('\n')[0]}), so this check did not run`); }
    }
    await page.wait(40);
    if (name === 'focus-visible') {
      const ring = await page.evaluate(measureFocusRings);
      rings.checked = ring.checked;
      rings.bad = ring.bad.map((b) => `${b}@${width}`);
      rings.items = ring.items.map((i) => ({ ...i, at: width }));
    }
    const { rows, unknown: noBg } = await page.evaluate(measureContrast, name);
    checked += rows.length;
    for (const label of noBg) unknown.add(label);
    for (const row of rows) {
      const key = `${name}|${row.label}`;
      if (!row.ok && !seen.has(key)) {
        seen.add(key);
        fails.push(`${name}@${width}: ${row.label} ${row.ratio}:1 (needs ${row.need}${row.disabled ? ', disabled' : ''})`);
        items.push({ state: name, at: width, sel: row.sel, ctl: row.ctl, fg: row.fg, base: row.base, ratio: row.ratio, need: row.need, shadow: row.shadow || [] });
      }
    }
  }
  // Reset only: the readings are already taken, so a failure here cannot turn into a pass.
  for (const nodeId of nodeIds) await page.cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }).catch(() => {});
  return { checked, fails, items, unknown: [...unknown], rings };
}

async function textLength(page) {
  await page.evaluate(installToolkit);
  return page.evaluate(() => window.__slop.textLength());
}

// Visible text at rest with JS off and under reduced motion, against the text visible after scrolling through.
async function revealCheck(session, url) {
  const open = (opts) => session.newPage({ width: 1440, height: 900 }, opts);
  const normal = await open({});
  let base;
  try {
    await normal.goto(url);
    await normal.wait(300);
    await normal.evaluate(scrollThrough);
    // Wait for the revealed text to settle (timed reveals, late hydration), up to about 3 s.
    base = await textLength(normal);
    for (let i = 0; i < 10; i++) {
      await normal.wait(300);
      const next = await textLength(normal);
      const settled = next.visible === base.visible && next.total === base.total;
      base = next;
      if (settled && i >= 1) break;
    }
  } finally { await normal.close(); }
  const out = { base, variants: {} };
  for (const [name, opts] of [['reduced motion', { reducedMotion: 'reduce' }], ['JS off', { noScript: true }]]) {
    const page = await open(opts);
    try {
      await page.goto(url);
      await page.wait(500);
      out.variants[name] = await textLength(page);
    } finally { await page.close(); }
  }
  return out;
}

// The same state contrast and focus ring checks with prefers-color-scheme: dark, at 1440 and 390. Only fails that the
// light pass did not already report are kept (same state, selector and width), so a page without dark styles adds nothing.
async function darkPass(session, url, light, lightRings) {
  const seenState = new Set(light.items.map((i) => `${i.state}|${i.sel}|${i.at}`));
  const seenRing = new Set(lightRings.items.map((i) => `${i.sel}|${i.at}`));
  const out = { checked: 0, states: { fails: [], items: [] }, rings: { checked: 0, bad: [], items: [] } };
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const page = await session.newPage({ width, height });
    try {
      await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
      await page.goto(url);
      await page.wait(300);
      const scheme = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
      if (!scheme) throw new Error(`could not switch to dark mode at ${width}px, so the dark check did not run`);
      await page.evaluate(scrollThrough);
      const part = await contrastAcrossStates(page, width);
      out.checked += part.checked; out.rings.checked += part.rings.checked;
      part.items.forEach((it, k) => { if (!seenState.has(`${it.state}|${it.sel}|${it.at}`)) { out.states.items.push(it); out.states.fails.push(part.fails[k]); } });
      part.rings.items.forEach((it, k) => { if (!seenRing.has(`${it.sel}|${it.at}`)) { out.rings.items.push(it); out.rings.bad.push(part.rings.bad[k]); } });
    } finally { await page.close(); }
  }
  return out;
}

// Fix lines for dark-only fails. They are not autofixed: the fix belongs inside the page's dark-mode rules.
function darkLines(d) {
  const states = [], focus = [], seen = new Set();
  for (const it of d.states.items) {
    const sel = it.state === 'rest' ? it.sel : it.state === 'focus-visible' ? `${it.sel}:focus-visible` : `${it.sel}:${it.state}`;
    if (seen.has(sel)) continue; seen.add(sel);
    const c = nearestPassing(it.fg, it.base, it.need);
    states.push(`[dark] ${sel} ${hex(it.fg)} on ${hex(it.base)} = ${it.ratio}:1 (needs ${it.need}) @${it.at} -> inside @media (prefers-color-scheme: dark): ${c ? `color: ${c}` : `change the background ${hex(it.base)}`}`);
  }
  for (const it of d.rings.items) {
    if (seen.has('ring|' + it.sel)) continue; seen.add('ring|' + it.sel);
    const c = nearestPassing(it.ring, it.base, 3) || (ratio([17, 17, 17], it.base) >= 3 ? '#111111' : '#ffffff');
    focus.push(`[dark] ${it.sel}:focus-visible ring ${it.kind} ${it.ratio}:1 w${it.width} @${it.at} -> inside @media (prefers-color-scheme: dark): outline: 2px solid ${c}; outline-offset: 2px`);
  }
  return { states, focus };
}

// Contrast (1440 and 390, light and dark), target size (390), reveal (JS off, reduced motion), a visible error on empty submit (1440)
// and console errors (320, 390, 1440 loads).
export async function measureFloorProbes(url, { session }) {
  const result = { states: null, rings: null, targets: null, targets1440: null, reveal: null, forms: null, console: [], error: null };
  const errors = new Set();
  const collect = (page) => { for (const e of page.errors || []) if (!/favicon/i.test(e)) errors.add(e); };
  try {
    const states = { checked: 0, fails: [], items: [], unknown: [] };
    const rings = { checked: 0, bad: [], items: [] };
    const merge = (part) => {
      states.checked += part.checked; states.fails.push(...part.fails); states.items.push(...part.items); states.unknown.push(...part.unknown);
      rings.checked += part.rings.checked; rings.bad.push(...part.rings.bad); rings.items.push(...part.rings.items);
    };
    const desktop = await session.newPage({ width: 1440, height: 900 }, { collectErrors: true });
    try {
      // Light first, set explicitly: headless Chrome can follow the OS scheme. Dark runs in darkPass().
      await desktop.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      await desktop.goto(url);
      await desktop.wait(300);
      // Scroll through first, so controls in scroll-reveal sections are visible and measured too.
      await desktop.evaluate(scrollThrough);
      await desktop.evaluate(installToolkit);
      result.targets1440 = await desktop.evaluate(measureTargets, true);
      merge(await contrastAcrossStates(desktop, 1440));
      collect(desktop);
    } finally { await desktop.close(); }
    for (const [width, height] of [[390, 844], [320, 700]]) {
      const page = await session.newPage({ width, height }, { collectErrors: true });
      try {
        await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
        await page.goto(url);
        await page.wait(300);
        if (width === 390) {
          await page.evaluate(scrollThrough);
          await page.evaluate(installToolkit);
          result.targets = await page.evaluate(measureTargets, false);
          merge(await contrastAcrossStates(page, 390));
        }
        collect(page);
      } finally { await page.close(); }
    }
    result.states = states;
    result.rings = rings;
    result.dark = await darkPass(session, url, states, rings);
    result.reveal = await revealCheck(session, url);
    result.forms = await formErrorsCheck(session, url);
  } catch (error) { result.error = error.message; }
  result.console = [...errors];
  return result;
}

const short = (list, n = 5) => `${list.slice(0, n).join('; ')}${list.length > n ? `; +${list.length - n} more` : ''}`;

// Compact output: passes are names only; each fail is one line per selector, `selector -> exact fix`.
export function formatFloorProbes(r) {
  const lines = [];
  const failed = [];
  const passes = [];
  if (r.error) { lines.push(`ERROR floor probes: ${r.error}`); return { lines, failed, passes, error: true }; }
  const fx = fixLines(r);
  const put = (name, check, list, n = 8) => {
    failed.push(check);
    for (const l of list.slice(0, n)) lines.push(`FAIL ${name.padEnd(8)} ${l}`);
    if (list.length > n) lines.push(`FAIL ${name.padEnd(8)} and ${list.length - n} more`);
  };
  const s = r.states;
  const dk = r.dark ? darkLines(r.dark) : { states: [], focus: [] };
  const stateLines = [...(s.fails.length ? (fx.states.length ? fx.states : s.fails) : []), ...dk.states];
  if (stateLines.length) put('states', 'state contrast', stateLines); else passes.push('states');
  if (s.unknown.length) lines.push(`WARN states   ${new Set(s.unknown).size} text elements on an image or gradient, check by eye: ${short([...new Set(s.unknown)], 3)}`);
  const focusLines = [...(r.rings.bad.length ? (fx.focus.length ? fx.focus : r.rings.bad) : []), ...dk.focus];
  if (focusLines.length) put('focus', 'focus ring', focusLines); else passes.push('focus');
  const t = r.targets, t2 = r.targets1440 || { bad: [], overlaps: [] };
  if (t.bad.length || t2.bad.length) put('targets', 'targets', fx.targets); else passes.push('targets');
  if ((t.overlaps || []).length || (t2.overlaps || []).length) put('overlap', 'target overlap', fx.overlap); else passes.push('overlap');
  const rv = r.reveal;
  const revealFails = [];
  for (const [name, v] of Object.entries(rv.variants)) {
    if (v.total < rv.base.total * 0.9) revealFails.push(`${name}: ${Math.round((1 - v.total / rv.base.total) * 100)}% of the text is missing (built by script or removed) -> put the text in the HTML, not only in JS`);
    else if (rv.base.visible > 0 && v.visible < rv.base.visible * 0.95) revealFails.push(`${name}: ${Math.round((1 - v.visible / rv.base.visible) * 100)}% of the text is hidden at rest -> keep text visible in base CSS; hide only under .js-reveal and show it under prefers-reduced-motion`);
  }
  if (revealFails.length) put('reveal', 'reveal', revealFails); else passes.push('reveal');
  if (r.forms && r.forms.bad.length) put('errors', 'form errors', r.forms.bad.map((b) => `${b} -> on submit, show a message next to each empty field and set aria-invalid=true (or keep native validation: no novalidate)`), 3);
  else if (r.forms && r.forms.checked) passes.push('errors');
  if (r.console.length) put('console', 'console errors', r.console.map((c) => `${c} -> fix the script or the missing file`), 3); else passes.push('console');
  return { lines, failed, passes, error: false };
}
