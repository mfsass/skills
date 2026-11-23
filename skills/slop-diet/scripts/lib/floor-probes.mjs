// Live floor probes for verify.mjs: text contrast in interactive states (390 and 1440), target size,
// text visible with JS off and under reduced motion, console errors.
// States are forced with CDP CSS.forcePseudoState (Chrome directly, Playwright through a CDP session).
// The in-page functions run in the browser and must stay self-contained; they share window.__slop.

const STATE_SETS = [
  ['rest', []],
  ['hover', ['hover']],
  ['focus-visible', ['focus', 'focus-visible']],
  ['active', ['active']],
];

// ---- in-page: shared helpers on window.__slop -----------------------------------------

function installToolkit() {
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
          const l = nr.left + (parseFloat(p.left) || 0), t = nr.top + (parseFloat(p.top) || 0);
          const w = parseFloat(p.width), h = parseFloat(p.height);
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
  const rangeOf = (host) => { const range = document.createRange(); range.selectNodeContents(host); return range.getBoundingClientRect(); };
  const read = (name, host, box, disabled) => {
    let rect = box;
    const cy = rect.top + rect.height / 2;
    if (cy < 0 || cy > window.innerHeight) { window.scrollBy(0, cy - window.innerHeight / 2); rect = rangeOf(host); }
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
    rows.push({ label: name, ratio: Math.round(r * 100) / 100, need, ok: r + 0.005 >= need, disabled });
  };
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
      found.push([host, r]);
    }
    return found;
  };
  for (const el of document.querySelectorAll('[data-slop-i]')) {
    if (el.tagName === 'INPUT' && NO_TEXT_INPUT.test(el.type)) continue;
    const disabled = el.matches(':disabled, [aria-disabled="true"]');
    if (disabled && state !== 'rest') continue;
    const hosts = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ? [[el, el.getBoundingClientRect()]] : textHosts(el);
    for (const [host, box] of hosts) {
      if (done.has(host)) continue;
      done.add(host);
      read(T.label(host.closest('button, a, label, summary, [role], input, select') || host), host, box, disabled);
    }
  }
  // Every other visible text in the page, at rest (disabled text needs 3:1).
  if (state === 'rest') {
    for (const [host, box] of textHosts(document.body)) {
      if (done.has(host)) continue;
      done.add(host);
      read(T.label(host), host, box, !!host.closest(':disabled, [aria-disabled="true"]'));
    }
  }
  window.scrollTo(0, startY);
  return { rows, unknown };
}

// ---- in-page: focus indicator under :focus-visible (run with the focus state forced) -----------------

function measureFocusRings() {
  const T = window.__slop;
  const COLOR_RE = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
  const FOCUSABLE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/;
  const out = { checked: 0, bad: [] };
  for (const el of document.querySelectorAll('[data-slop-i]')) {
    const role = el.getAttribute('role') || '';
    if (!(FOCUSABLE.test(el.tagName) || /^(button|tab|link|menuitem|radio|switch|checkbox)$/.test(role) || el.hasAttribute('tabindex'))) continue;
    if (el.matches(':disabled, [aria-disabled="true"]') || (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && T.srOnly(el))) continue;
    const rect = el.getBoundingClientRect();
    const parent = el.parentElement || document.body;
    const { base } = T.backdrop(parent, rect);
    const s = getComputedStyle(el);
    let kind = 'none', ratio = 0, width = 0;
    const ow = parseFloat(s.outlineWidth) || 0;
    if (s.outlineStyle === 'auto') { kind = 'auto'; ratio = 21; width = Math.max(ow, 2); }
    else if (s.outlineStyle !== 'none' && ow > 0) {
      const c = T.parse(s.outlineColor);
      kind = 'outline'; ratio = T.ratio(T.over(c, base), base); width = ow;
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
        if (kind === 'none' || r > ratio) { kind = kind === 'outline' ? 'outline+shadow' : 'shadow'; ratio = r; width = Math.max(width, spread || blur); }
      }
    }
    out.checked++;
    if (kind === 'none' || ratio < 3 || width < 2) out.bad.push(`${T.label(el)} ring ${kind} ${Math.round(ratio * 100) / 100}:1 w${width}`);
  }
  return out;
}

// ---- in-page: target size at the current viewport (run at 390) ----------------------

function measureTargets() {
  const T = window.__slop;
  const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link],'
    + ' [role=menuitem], [role=radio], [role=checkbox], [role=switch]';
  const out = { checked: 0, bad: [], overlaps: [] };
  const boxes = [];
  for (const el of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(el);
    let box = el;
    // A visually hidden checkbox or radio is tapped through its label, so the label is the target.
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type) && el.labels && el.labels.length) { box = el.labels[0]; if (T.hidden(box)) continue; }
    else if (T.hidden(el)) continue;
    const r = box.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth) continue;
    if (el.tagName === 'A' && cs.display === 'inline') {
      // A link inside running text is exempt: its nearest block ancestor holds at least 10 characters of other prose.
      let block = el.parentElement;
      while (block && getComputedStyle(block).display === 'inline') block = block.parentElement;
      if (block) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let other = 0;
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.parentElement.closest('a[href], button')) other += node.textContent.replace(/\s+/g, ' ').trim().length;
        }
        if (other >= 10) continue;
      }
    }
    out.checked++;
    boxes.push({ el, label: T.label(el), r });
    if (r.width < 43.5 || r.height < 43.5) out.bad.push({ label: T.label(el), w: Math.round(r.width), h: Math.round(r.height) });
  }
  // Two hit boxes that overlap by more than 4px in both axes, where neither holds the other (nested controls are not overlaps).
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el) || (a.el.labels && [...a.el.labels].includes(b.el)) || (b.el.labels && [...b.el.labels].includes(a.el))) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 4 && oy > 4) out.overlaps.push(`${a.label} x ${b.label} (${Math.round(ox)}x${Math.round(oy)}px)`);
    }
  }
  return out;
}

// ---- in-page: scroll through the page so one-shot scroll reveals run -------------------

export async function scrollThrough() {
  const step = Math.max(200, Math.round(window.innerHeight * 0.6));
  const end = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  for (let y = 0; y <= end; y += step) {
    window.scrollTo(0, y);
    await new Promise((res) => setTimeout(res, 60));
  }
  await new Promise((res) => setTimeout(res, 700));
  window.scrollTo(0, 0);
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
  const rings = { checked: 0, bad: [] };
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
    }
    const { rows, unknown: noBg } = await page.evaluate(measureContrast, name);
    checked += rows.length;
    for (const label of noBg) unknown.add(label);
    for (const row of rows) {
      const key = `${name}|${row.label}`;
      if (!row.ok && !seen.has(key)) {
        seen.add(key);
        fails.push(`${name}@${width}: ${row.label} ${row.ratio}:1 (needs ${row.need}${row.disabled ? ', disabled' : ''})`);
      }
    }
  }
  // Reset only: the readings are already taken, so a failure here cannot turn into a pass.
  for (const nodeId of nodeIds) await page.cdp('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] }).catch(() => {});
  return { checked, fails, unknown: [...unknown], rings };
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

// Contrast (1440 and 390), target size (390), reveal (JS off, reduced motion) and console errors (320, 390, 1440 loads).
export async function measureFloorProbes(url, { session }) {
  const result = { states: null, rings: null, targets: null, reveal: null, console: [], error: null };
  const errors = new Set();
  const collect = (page) => { for (const e of page.errors || []) if (!/favicon/i.test(e)) errors.add(e); };
  try {
    const states = { checked: 0, fails: [], unknown: [] };
    const rings = { checked: 0, bad: [] };
    const merge = (part) => {
      states.checked += part.checked; states.fails.push(...part.fails); states.unknown.push(...part.unknown);
      rings.checked += part.rings.checked; rings.bad.push(...part.rings.bad);
    };
    const desktop = await session.newPage({ width: 1440, height: 900 }, { collectErrors: true });
    try {
      await desktop.goto(url);
      await desktop.wait(300);
      merge(await contrastAcrossStates(desktop, 1440));
      collect(desktop);
    } finally { await desktop.close(); }
    for (const [width, height] of [[390, 844], [320, 700]]) {
      const page = await session.newPage({ width, height }, { collectErrors: true });
      try {
        await page.goto(url);
        await page.wait(300);
        if (width === 390) {
          await page.evaluate(installToolkit);
          result.targets = await page.evaluate(measureTargets);
          merge(await contrastAcrossStates(page, 390));
        }
        collect(page);
      } finally { await page.close(); }
    }
    result.states = states;
    result.rings = rings;
    result.reveal = await revealCheck(session, url);
  } catch (error) { result.error = error.message; }
  result.console = [...errors];
  return result;
}

const short = (list, n = 5) => `${list.slice(0, n).join('; ')}${list.length > n ? `; +${list.length - n} more` : ''}`;

export function formatFloorProbes(r) {
  const lines = [];
  const failed = [];
  if (r.error) { lines.push(`  floor     ERROR (${r.error})`); return { lines, failed, error: true }; }
  const s = r.states;
  if (s.fails.length) failed.push('state contrast');
  const unknownNote = s.unknown.length ? ` WARN: ${new Set(s.unknown).size} text elements sit on an image or gradient, contrast not measured (check by eye): ${short([...new Set(s.unknown)], 3)}` : '';
  lines.push(`  states    ${s.fails.length ? `FAIL ${s.fails.length}: ${short(s.fails)}` : `PASS (${s.checked} readings across rest, hover, focus-visible, active at 1440 and 390)`}${unknownNote}`);
  const g = r.rings;
  if (g.bad.length) failed.push('focus ring');
  lines.push(`  focus     ${g.bad.length ? `FAIL ${g.bad.length} focus rings under 3:1 or 2px: ${short(g.bad)}` : `PASS (${g.checked} control checks at 1440 and 390, each ring 3:1 or more)`}`);
  const t = r.targets;
  const badTargets = t.bad.map((b) => `${b.label} ${b.w}x${b.h}`);
  if (badTargets.length) failed.push('targets');
  const ov = t.overlaps || [];
  if (ov.length) failed.push('target overlap');
  lines.push(`  overlap   ${ov.length ? `FAIL ${ov.length} target pairs overlap at 390: ${short(ov, 3)}` : 'PASS (no two tap targets overlap at 390)'}`);
  lines.push(`  targets   ${badTargets.length ? `FAIL ${badTargets.length} under 44x44 at 390: ${short(badTargets)}` : `PASS (${t.checked} elements, all 44x44 or larger at 390)`}`);
  const rv = r.reveal;
  const revealFails = [];
  for (const [name, v] of Object.entries(rv.variants)) {
    if (v.total < rv.base.total * 0.9) revealFails.push(`${name}: ${Math.round((1 - v.total / rv.base.total) * 100)}% of the text is missing (built by script or removed)`);
    else if (rv.base.visible > 0 && v.visible < rv.base.visible * 0.95) revealFails.push(`${name}: ${Math.round((1 - v.visible / rv.base.visible) * 100)}% of the text is hidden at rest`);
  }
  if (revealFails.length) failed.push('reveal');
  lines.push(`  reveal    ${revealFails.length ? `FAIL ${revealFails.join('; ')}` : `PASS (text at rest with JS off and reduced motion matches the revealed page)`}`);
  if (r.console.length) failed.push('console errors');
  lines.push(`  console   ${r.console.length ? `FAIL ${r.console.length}: ${short(r.console, 3)}` : 'PASS (no errors or failed requests on load at 320, 390, 1440)'}`);
  return { lines, failed, error: false };
}
