import { runCraftProbes } from './craft-probes.mjs';
// Taste probes: browser checks that turn design principles into pass/fail.
// Each probe fills a gap that verify.mjs, probe-dots.mjs and slop-lint do not cover.
// Pages come from browser.mjs (Playwright or headless Chrome). Mouse input goes through CDP Input.dispatchMouseEvent,
// so the same code runs on both adapters. In-page functions must stay self-contained: they share window.__taste.

export const PROBES = [
  'hover-press', 'transition-duration', 'segmented-transform', 'decorative-dots',
  'responsive-reflow', 'select-chevron', 'layout-stable', 'accent-bar', 'worst-case-text',
];

export const OVERRIDE_IDS = {
  'hover-press': 'TASTE-HOVER-PRESS',
  'transition-duration': 'TASTE-TRANSITION',
  'segmented-transform': 'TASTE-SEGMENTED',
  'decorative-dots': 'TASTE-GLYPH-DOT',
  'responsive-reflow': 'TASTE-REFLOW',
  'select-chevron': 'TASTE-CHEVRON',
  'layout-stable': 'TASTE-LAYOUT-SHIFT',
  'accent-bar': 'TASTE-ACCENT-BAR',
  'worst-case-text': 'TASTE-WORST-CASE-TEXT',
};

// ---- in-page toolkit ---------------------------------------------------------------------

function install() {
  const T = {};
  T.visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  // Disabled, or styled as unavailable: a label whose input is disabled (a booked time slot) is not a live control.
  T.disabled = (el) => el.matches(':disabled, [aria-disabled="true"]') || !!(el.control && el.control.disabled)
    || (el.matches('label, button, [role=option], [role=radio]') && /(^|[\s_-])(disabled|unavailable|sold-?out|booked)([\s_-]|$)/i.test(typeof el.className === 'string' ? el.className : ''))
    || (el.matches('label') && /\b(unavailable|sold out|fully booked)\b/i.test(el.innerText || ''));
  T.selected = (el) => el.matches('[aria-selected="true"], [aria-current]:not([aria-current="false"]), [aria-pressed="true"], [aria-checked="true"], .active, .selected, .is-active, .on')
    || !!el.querySelector('input:checked') || (el.tagName === 'INPUT' && el.checked);
  T.label = (el) => {
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 22);
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}${t ? ' "' + t + '"' : ''}`;
  };
  // Visible elements for a selector, in document order. A hidden checkbox or radio is represented by its label.
  T.pick = (sel) => {
    const out = [];
    for (let el of document.querySelectorAll(sel)) {
      if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)) {
        const r = el.getBoundingClientRect();
        if (r.width < 10 || r.height < 10 || parseFloat(getComputedStyle(el).opacity) === 0) {
          const lab = (el.labels && el.labels[0]) || el.closest('label');
          if (!lab) continue;
          el = lab;
        }
      }
      if (!T.visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= 0 || r.left >= window.innerWidth) continue;
      if (!out.includes(el)) out.push(el);
    }
    return out;
  };
  T.tag = (els) => {
    for (const old of document.querySelectorAll('[data-taste-i]')) old.removeAttribute('data-taste-i');
    els.forEach((el, i) => el.setAttribute('data-taste-i', String(i)));
  };
  T.get = (i) => document.querySelector(`[data-taste-i="${i}"]`);
  T.tree = (el, max = 12) => [el, ...[...el.querySelectorAll('*')].slice(0, max)];
  const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderTopWidth', 'boxShadow', 'transform', 'translate', 'scale', 'rotate', 'opacity', 'textDecorationLine', 'outlineColor', 'outlineWidth', 'filter', 'fontWeight'];
  T.fp = (el) => {
    const parts = [];
    for (const n of T.tree(el)) {
      const cs = getComputedStyle(n);
      parts.push(PROPS.map((p) => cs[p]).join('|'));
      for (const ps of ['::before', '::after']) {
        const p = getComputedStyle(n, ps);
        if (p.content && p.content !== 'none' && p.content !== 'normal') parts.push(PROPS.map((k) => p[k]).join('|'));
      }
    }
    return parts.join('~');
  };
  T.alpha = (c) => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(/[,/ ]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  T.exempt = /thumb|knob|handle|spinner|loader|radio|checkbox|switch|toggle|track|slider|range|avatar|step|caret|scroll|cursor|progress|gauge/i;
  T.chain = (el) => [el, el.parentElement, el.parentElement && el.parentElement.parentElement].filter(Boolean)
    .map((n) => `${n.tagName.toLowerCase()}${typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`).join(' ');
  T.round = (cs, w, h) => { const r = cs.borderTopLeftRadius; return r.endsWith('%') ? parseFloat(r) >= 50 : parseFloat(r) >= Math.min(w, h) / 2 - 1; };
  T.CONTROL = 'button, [role=button], [role=tab], [role=switch], [role=radio], [role=checkbox], [role=menuitem], [role=option],'
    + ' input[type=button], input[type=submit], input[type=reset], input[type=checkbox], input[type=radio], summary';
  T.ms = (s) => s.split(',').map((v) => { v = v.trim(); return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000; }).filter((n) => !Number.isNaN(n));
  window.__taste = T;
  return true;
}

// ---- hover-press ------------------------------------------------------------------------

function listHoverTargets() {
  const T = window.__taste;
  const buttons = T.pick(T.CONTROL).filter((el) => !T.disabled(el));
  // A logo or brand link is exempt: it rarely changes at :hover, and the link rule is about text links.
  const links = T.pick('a[href]').filter((el) => !T.disabled(el) && !buttons.includes(el) && !el.closest(T.CONTROL) && !el.matches('[class*=logo i], [class*=brand i], [aria-label*=home i]'));
  const all = [...buttons, ...links];
  T.tag(all);
  return all.map((el, i) => ({ i, label: T.label(el), link: links.includes(el), press: el.matches('button:not([role=tab]):not([role=radio]), [role=button], summary, input[type=button], input[type=submit]'), skip: T.selected(el) })).slice(0, 60);
}

function centerOf(i) {
  const T = window.__taste;
  const el = T.get(i);
  if (!el || !el.isConnected) return { x: 0, y: 0, hit: false };
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); // instant: with scroll-behavior: smooth the box is still moving when it is measured
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return { x, y, hit: !!top && (el === top || el.contains(top) || top.closest('label') === el) };
}

// A checkbox or radio in a label: hovering the label counts, so the label's look joins the fingerprint.
const fingerprint = (i) => {
  const T = window.__taste, el = T.get(i);
  const lab = el && el.matches('input[type=checkbox], input[type=radio]') ? el.closest('label') : null;
  return T.fp(el) + (lab ? '|' + T.fp(lab) : '');
};

async function mouse(page, type, x, y, buttons = 0) {
  const button = buttons || type === 'mouseReleased' ? 'left' : 'none';
  await page.cdp('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
}

// Tabs: the law is a visible selected state plus a hover change. A press look on :active is optional for tabs, so tabs are not in
// the press list above. The selected tab must differ from an unselected sibling in some paint property.
function tabSelectedState() {
  const T = window.__taste;
  const bad = [];
  for (const list of document.querySelectorAll('[role=tablist]')) {
    if (!T.visible(list)) continue;
    const tabs = [...list.querySelectorAll('[role=tab]')].filter((el) => T.visible(el));
    const sel = tabs.find((el) => el.matches('[aria-selected="true"]'));
    const other = tabs.find((el) => el !== sel && !T.selected(el));
    if (!sel || !other) continue;
    if (T.fp(sel) === T.fp(other)) bad.push(`${T.label(sel)}: no visible selected state (the selected tab looks like its siblings)`);
  }
  return bad;
}

async function hoverPress(page) {
  await page.evaluate(install);
  const targets = await page.evaluate(listHoverTargets);
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(s); });
  const out = { checked: 0, bad: [], info: [] };
  let skipped = 0;
  for (const t of targets) {
    if (t.skip) { skipped++; continue; }
    const c = await page.evaluate(centerOf, t.i);
    if (!c.hit) { skipped++; continue; }
    await mouse(page, 'mouseMoved', 1, 1);
    await page.wait(20);
    const rest = await page.evaluate(fingerprint, t.i);
    await mouse(page, 'mouseMoved', c.x, c.y);
    await page.wait(30);
    let hover = await page.evaluate(fingerprint, t.i);
    if (hover === rest) { await page.wait(120); hover = await page.evaluate(fingerprint, t.i); } // a slow first paint is not a missing hover
    let pressed = hover;
    if (t.press) {
      await mouse(page, 'mousePressed', c.x, c.y, 1);
      await page.wait(30);
      pressed = await page.evaluate(fingerprint, t.i);
      await mouse(page, 'mouseMoved', 1, 1, 1);
      await mouse(page, 'mouseReleased', 1, 1);
    }
    out.checked++;
    const miss = [];
    if (hover === rest) miss.push('no hover change');
    if (t.press && pressed === hover) miss.push('no press (:active) change');
    if (miss.length) out.bad.push(`${t.label}: ${miss.join(', ')}`);
  }
  for (const b of await page.evaluate(tabSelectedState)) out.bad.push(b);
  if (skipped) out.info.push(`${skipped} selected or covered controls skipped`);
  return out;
}

// ---- main-press -------------------------------------------------------------------------
// Press feedback on the page's ONE main action (the rule: tabs, filters, segmented switches and icon buttons need only
// hover or selected state). Any VISIBLE press style passes: the box moves 1 px or more, OR scales to 0.98 or less, OR box-shadow
// changes, OR the fill, border or text colour changes by a clear amount (channel difference sum of 30 or more, about 4% lightness),
// OR the border width, gradient or opacity (0.08 or more) changes. FAIL only when nothing visible changes, or the only change is
// too faint to see. Reported as its own result; it never changes the hover-press probe or the exit code.
// Heuristic for the main action: visible, enabled, button-like (button, [role=button], input[type=submit|button], or an a[href]
// with a button look), not a tab, switch, radio, checkbox, option or selected item, not inside a tablist or segmented group,
// not an icon-only control (no text and under 64 px wide), with a solid background (alpha 0.9 or more) that differs from the
// nearest opaque ancestor background. Among those, take the largest area; a control in the first viewport beats one below it.

function findMainAction() {
  const T = window.__taste;
  const bg = (el) => getComputedStyle(el).backgroundColor;
  const rgb = (c) => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); return m ? m[1].split(/[,/ ]+/).filter(Boolean).slice(0, 3).map(Number) : null; };
  const surface = (el) => { for (let n = el.parentElement; n; n = n.parentElement) { if (T.alpha(bg(n)) >= 0.5) return bg(n); } return 'rgb(255, 255, 255)'; };
  const EXCLUDE = '[role=tab], [role=switch], [role=radio], [role=checkbox], [role=option], [role=menuitem], [aria-pressed], [aria-selected], [role=tablist] *, [role=radiogroup] *';
  const SEG = /seg|tabs|switcher|toggle-group|btn-group|button-group|radio-group|pill-nav|chip|filter/i;
  const cands = T.pick('button, [role=button], input[type=submit], input[type=button], a[href]').filter((el) => {
    if (T.disabled(el) || T.selected(el) || el.matches(EXCLUDE) || el.matches('[class*=skip i], [href="#main"], [href="#content"]')) return false; // skip links are not the main action
    const r = el.getBoundingClientRect();
    const text = (el.innerText || el.value || '').trim();
    if (!text && r.width < 64) return false;
    for (let n = el.parentElement, k = 0; n && k < 3; n = n.parentElement, k++) if (typeof n.className === 'string' && SEG.test(n.className)) return false;
    if (el.tagName === 'A' && !(parseFloat(getComputedStyle(el).paddingLeft) >= 8 || /btn|button|cta/i.test(typeof el.className === 'string' ? el.className : '') || el.getAttribute('role') === 'button')) return false;
    const c = bg(el);
    if (T.alpha(c) < 0.9) return false;
    const a = rgb(c), b = rgb(surface(el));
    return a && b && a.some((v, i) => Math.abs(v - b[i]) > 6);
  });
  if (!cands.length) return null;
  const area = (el) => { const r = el.getBoundingClientRect(); return r.width * r.height; };
  const first = cands.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; });
  const pool = first.length ? first : cands;
  const best = pool.sort((a, b) => area(b) - area(a))[0];
  T.tag([best]);
  return { i: 0, label: T.label(best), n: cands.length };
}

function pressState(i) {
  const T = window.__taste, el = T.get(i);
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height,
    shadow: cs.boxShadow,
    colour: [cs.color, cs.backgroundColor, cs.backgroundImage, cs.borderTopColor, cs.opacity, cs.filter, cs.textDecorationLine].join('|'),
    rgb: [cs.backgroundColor, cs.borderTopColor, cs.color],
    other: [cs.backgroundImage, cs.borderTopWidth, cs.filter, cs.textDecorationLine, cs.outlineWidth].join('|'),
    opacity: parseFloat(cs.opacity),
  };
}

function comparePress(a, b) {
  const move = Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy));
  const scale = Math.min(b.w / a.w, b.h / a.h);
  const num = (c) => { const m = /rgba?\(([^)]*)\)/.exec(c || ''); if (!m) return [0, 0, 0, 0]; const v = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  // Visible colour change: fill, border or text colour differs by a channel sum of 30 or more (alpha counts as up to 255).
  let delta = 0;
  a.rgb.forEach((c, k) => { const x = num(c), y = num(b.rgb[k]); delta = Math.max(delta, Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) + Math.abs(x[3] - y[3]) * 255); });
  const visible = delta >= 30 || a.other !== b.other || Math.abs(a.opacity - b.opacity) >= 0.08;
  return { move, scale, shadow: a.shadow !== b.shadow, colour: a.colour !== b.colour, visible, delta };
}

async function mainPress(page) {
  await page.evaluate(install);
  const main = await page.evaluate(findMainAction);
  if (!main) return { status: 'NA', checked: 0, bad: [], line: 'main-press NA no main action found' };
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(s); });
  const c = await page.evaluate(centerOf, main.i);
  if (!c.hit) return { status: 'NA', checked: 0, bad: [], line: `main-press NA ${main.label}: covered, not measured` };
  await mouse(page, 'mouseMoved', 1, 1);
  await page.wait(20);
  const rest = await page.evaluate(pressState, main.i);
  await mouse(page, 'mouseMoved', c.x, c.y);
  await page.wait(60);
  const hover = await page.evaluate(pressState, main.i);
  await mouse(page, 'mousePressed', c.x, c.y, 1);
  await page.wait(60);
  const pressed = await page.evaluate(pressState, main.i);
  await mouse(page, 'mouseMoved', 1, 1, 1);
  await mouse(page, 'mouseReleased', 1, 1);
  // The pressed look is compared with rest and with hover: a hover lift that drops back on :active is a visible press.
  const a = comparePress(rest, pressed), b = comparePress(hover, pressed);
  const m = { move: Math.max(a.move, b.move), scale: Math.min(a.scale, b.scale), shadow: a.shadow || b.shadow, colour: a.colour || b.colour, visible: a.visible || b.visible, delta: Math.max(a.delta, b.delta) };
  const fmt = `moves ${Math.round(m.move * 10) / 10}px, scale ${Math.round(m.scale * 1000) / 1000}, shadow ${m.shadow ? 'changes' : 'same'}, colour ${m.visible ? 'changes visibly' : m.colour ? 'changes faintly' : 'same'}`;
  const strong = m.move >= 1 || m.scale <= 0.98 + 1e-6 || m.shadow || m.visible;
  if (strong) return { status: 'PASS', checked: 1, bad: [], line: `main-press PASS ${main.label}: ${fmt}` };
  const why = m.colour ? 'press change too faint to see' : 'no press';
  return { status: 'FAIL', checked: 1, bad: [`${main.label}: ${why}`], kind: m.colour ? 'weak' : 'none', line: `main-press FAIL ${main.label}: ${why}` };
}

// Returns { status: 'PASS' | 'FAIL' | 'NA' | 'ERROR', label line }. Called by verify.mjs as a separate, advisory result.
export async function runMainPress(url, { session } = {}) {
  try { return await withPage(session, url, mainPress); } catch (error) { return { status: 'ERROR', checked: 0, bad: [], line: `main-press ERROR ${String(error.message).split('\n')[0]}` }; }
}

// ---- transition-duration ----------------------------------------------------------------

function measureTransitions() {
  const T = window.__taste;
  const els = T.pick(T.CONTROL).filter((el) => !T.disabled(el));
  const out = { checked: 0, bad: [] };
  for (const el of els) {
    let max = 0;
    for (const n of T.tree(el)) {
      for (const ps of [null, '::before', '::after']) {
        const cs = ps ? getComputedStyle(n, ps) : getComputedStyle(n);
        if (ps && (!cs.content || cs.content === 'none' || cs.content === 'normal')) continue;
        for (const d of T.ms(cs.transitionDuration)) max = Math.max(max, d);
      }
    }
    out.checked++;
    // An instant change is valid (keyboard lists, command menus, quick selection). Only a slow answer to the hand is a fail.
    if (max > 400) out.bad.push(`${T.label(el)}: ${Math.round(max)} ms is too slow for direct feedback (400 ms at most; instant is fine)`);
  }
  return out;
}

// ---- segmented-transform ----------------------------------------------------------------
// Law: choosing a segment shows a clear selected state. Any style passes: a sliding indicator (transform or not), a fill, border,
// weight, underline or tint change on the chosen item, or a moving highlight. FAIL only when clicking another segment changes
// nothing visible. A sliding indicator is advice, not a requirement.

function findSegmented() {
  const T = window.__taste;
  const ITEM = '[role=tab], [role=radio], button, label, [role=option]';
  const GROUP = /seg|tabs|switcher|toggle-group|btn-group|button-group|radio-group|pill-nav/i;
  const groups = [];
  const seen = new Set();
  for (const c of document.querySelectorAll('[role=tablist], [role=radiogroup], [class*=seg], [class*=tabs], [class*=switcher], [class*=toggle-group], [class*=btn-group], [class*=button-group], [class*=radio-group], [class*=pill-nav]')) {
    if (seen.has(c) || !T.visible(c)) continue;
    if (!(c.matches('[role=tablist], [role=radiogroup]') || GROUP.test(typeof c.className === 'string' ? c.className : ''))) continue;
    const items = [...c.querySelectorAll(ITEM)].filter((el) => T.visible(el) && el.parentElement && !el.querySelector(ITEM));
    if (items.length < 2 || items.length > 8) continue;
    const hs = items.map((el) => el.getBoundingClientRect().height);
    if (Math.max(...hs) - Math.min(...hs) > Math.max(...hs) * 0.4) continue;
    // A segmented control is one tight row. A wrapped grid of chips or time slots is a picker, not a segmented control.
    const rs = items.map((el) => el.getBoundingClientRect());
    if (Math.max(...rs.map((r) => r.top)) - Math.min(...rs.map((r) => r.top)) > 6) continue;
    const sorted = [...rs].sort((a, b) => a.left - b.left);
    if (sorted.some((r, k) => k && r.left - sorted[k - 1].right > 8)) continue;
    seen.add(c);
    groups.push({ c, items });
  }
  // keep the innermost group when one holds another
  const kept = groups.filter((g) => !groups.some((o) => o !== g && g.c.contains(o.c)));
  const flat = [];
  kept.slice(0, 4).forEach((g) => g.items.forEach((el) => flat.push(el)));
  T.tag(flat);
  let n = 0;
  return kept.slice(0, 4).map((g) => {
    const idx = g.items.map(() => n++);
    let sel = g.items.findIndex((el) => T.selected(el));
    if (sel < 0) sel = 0;
    return { name: T.label(g.c), items: idx, selected: sel };
  });
}

// Indicator candidates inside a group: absolute or fixed boxes that are not items, and the group's own pseudo-elements.
function indicatorState(groupIndexes) {
  const T = window.__taste;
  const items = groupIndexes.map((i) => T.get(i));
  const c = items[0].parentElement;
  let group = c;
  while (group && !items.every((el) => group.contains(el))) group = group.parentElement;
  const out = [];
  const nodes = [group, ...group.querySelectorAll('*')];
  for (const n of nodes) {
    if (items.includes(n) || items.some((it) => it.contains(n))) continue;
    for (const ps of n === group ? [null, '::before', '::after'] : [null]) {
      const cs = ps ? getComputedStyle(n, ps) : getComputedStyle(n);
      if (ps && (!cs.content || cs.content === 'none' || cs.content === 'normal')) continue;
      if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
      if (!ps && !T.visible(n)) continue;
      const r = ps ? null : n.getBoundingClientRect();
      out.push({
        name: `${T.label(n)}${ps || ''}`,
        x: r ? r.left + r.width / 2 : 0,
        transform: cs.transform,
        inset: [cs.left, cs.right, cs.marginLeft, cs.insetInlineStart].join('|'),
        prop: cs.transitionProperty,
        dur: Math.max(0, ...T.ms(cs.transitionDuration)),
        pseudo: !!ps,
      });
    }
  }
  return out;
}

// Paint fingerprint of every item in the group, measured with the pointer away so a hover change does not count.
function itemsState(groupIndexes) {
  const T = window.__taste;
  return groupIndexes.map((i) => {
    const el = T.get(i);
    const lab = el.matches('input') ? el.closest('label') : null;
    return `${T.fp(el)}${lab ? '|' + T.fp(lab) : ''}`; // paint only: a class or aria change that paints nothing is not a visible state
  });
}

async function segmented(page) {
  await page.evaluate(install);
  const groups = await page.evaluate(findSegmented);
  const out = { checked: 0, bad: [] };
  for (const g of groups) {
    // Choose the target now, not at discovery: two groups can share one state (a billing toggle in the hero and in the form).
    const now = await page.evaluate((idx) => { const T = window.__taste; const k = idx.findIndex((i) => T.selected(T.get(i))); return k < 0 ? 0 : k; }, g.items);
    const target = g.items[(now + 1) % g.items.length];
    const c = await page.evaluate(centerOf, target);
    if (!c.hit) continue;
    await mouse(page, 'mouseMoved', 1, 1);
    await page.wait(20);
    const before = await page.evaluate(indicatorState, g.items);
    const stateBefore = await page.evaluate(itemsState, g.items);
    await mouse(page, 'mouseMoved', c.x, c.y);
    await mouse(page, 'mousePressed', c.x, c.y, 1);
    await mouse(page, 'mouseReleased', c.x, c.y);
    await mouse(page, 'mouseMoved', 1, 1);
    await page.wait(450);
    const after = await page.evaluate(indicatorState, g.items);
    const stateAfter = await page.evaluate(itemsState, g.items);
    out.checked++;
    const itemsChanged = stateBefore.some((x, k) => x !== stateAfter[k]);
    const moved = before.some((b) => { const a = after.find((n) => n.name === b.name); return a && (Math.abs(a.x - b.x) >= 2 || a.transform !== b.transform || a.inset !== b.inset); });
    if (!itemsChanged && !moved) out.bad.push(`${g.name}: choosing another segment shows no selected state (no fill, border, weight, indicator or tint change)`);
  }
  return out;
}

// ---- decorative-dots (glyph, ring, gradient and stroke dots; filled dots stay with probe-dots.mjs) -------------

function measureGlyphDots() {
  const T = window.__taste;
  const out = { checked: 0, bad: [] };
  const LEAD = /^\s*[●⬤◉○◌▪■◆]/;
  const BULLET = /^\s*[•∙·]/;
  const EMOJI = /[\u{1F534}\u{1F535}\u{1F7E0}-\u{1F7E4}⚪⚫]/u;
  const chroma = (c) => { const m = /rgba?\(([^)]*)\)/.exec(c); if (!m) return 0; const v = m[1].split(/[,/ ]+/).map(Number); return Math.max(v[0], v[1], v[2]) - Math.min(v[0], v[1], v[2]); };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const host = node.parentElement;
    const text = node.textContent;
    if (!text.trim() || !host || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|CODE|PRE|TEXTAREA|OPTION)$/.test(host.tagName) || host.closest('code, pre, [aria-hidden=true] svg')) continue;
    if (!T.visible(host) || seen.has(host)) continue;
    out.checked++;
    const cs = getComputedStyle(host);
    const first = !node.previousSibling || (node.previousSibling.nodeType === 3 && !node.previousSibling.textContent.trim());
    if (EMOJI.test(text)) { seen.add(host); out.bad.push(`colour circle emoji in ${T.label(host)}`); continue; }
    if (first && LEAD.test(text)) { seen.add(host); out.bad.push(`glyph dot "${text.trim().slice(0, 12)}" in ${T.label(host)}`); continue; }
    if (first && BULLET.test(text) && chroma(cs.color) > 40) { seen.add(host); out.bad.push(`coloured bullet "${text.trim().slice(0, 12)}" in ${T.label(host)}`); }
  }
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement || !T.visible(el)) continue;
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      const content = (p.content || '').replace(/^["']|["']$/g, '');
      if (!content || content === 'none' || content === 'normal') continue;
      if (LEAD.test(content) || EMOJI.test(content)) out.bad.push(`glyph dot in ${T.label(el)}${ps}`);
    }
    if (el.matches('input, select, textarea, img, canvas, video, iframe, button svg') || T.exempt.test(T.chain(el))) continue;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    if (!(box.width >= 3 && box.width <= 14 && Math.abs(box.width - box.height) <= 2) || el.textContent.trim() || el.querySelector('svg') || !T.round(cs, box.width, box.height)) continue;
    if (cs.animationName !== 'none') continue;
    const ring = T.alpha(cs.backgroundColor) === 0 && parseFloat(cs.borderTopWidth) >= 1.5 && T.alpha(cs.borderTopColor) > 0 && cs.backgroundImage === 'none';
    const grad = /radial-gradient/.test(cs.backgroundImage);
    if (ring) out.bad.push(`ring dot ${T.chain(el)}`);
    else if (grad) out.bad.push(`gradient dot ${T.chain(el)}`);
  }
  for (const c of document.querySelectorAll('svg circle, svg ellipse')) {
    const cs = getComputedStyle(c);
    const box = c.getBoundingClientRect();
    const svg = c.closest('svg');
    if (cs.fill !== 'none' || cs.stroke === 'none' || !(box.width >= 3 && box.width <= 12) || Math.abs(box.width - box.height) > 2) continue;
    // A circle beside a path or line is an icon (search, clock, info), not a dot.
    if (cs.strokeDasharray !== 'none' || svg.querySelectorAll('path, line, polyline, polygon, rect').length || svg.querySelectorAll('circle, ellipse').length > 2 || T.exempt.test(T.chain(c))) continue;
    out.bad.push(`stroke ring dot in ${T.chain(svg.parentElement || svg)}`);
  }
  return out;
}

// ---- responsive-reflow ------------------------------------------------------------------

function collectLayout() {
  const T = window.__taste;
  const all = [...document.querySelectorAll('body *')];
  all.forEach((el, i) => el.setAttribute('data-taste-i', String(i)));
  const rows = [];
  const text = [];
  const sizes = [];
  for (const el of all) {
    if (el instanceof SVGElement) continue;
    const cs = getComputedStyle(el);
    const i = Number(el.getAttribute('data-taste-i'));
    const shown = T.visible(el);
    const isLandmark = el.matches('header, nav, aside, footer, [role=navigation], [aria-expanded], [class*=menu], [class*=burger], [class*=hamburger]');
    const flowKids = shown ? [...el.children].filter((k) => { const kc = getComputedStyle(k); const r = k.getBoundingClientRect(); return kc.display !== 'none' && kc.position !== 'absolute' && kc.position !== 'fixed' && r.width > 1 && r.height > 1; }) : [];
    const isLayout = /flex|grid/.test(cs.display) && flowKids.length >= 2;
    if (isLayout || isLandmark) {
      let cols = 0, order = '', avg = 0, textKids = 0;
      if (isLayout) {
        const rects = flowKids.map((k) => k.getBoundingClientRect());
        const top = Math.min(...rects.map((r) => r.top));
        cols = rects.filter((r) => Math.abs(r.top - top) < 6).length;
        order = flowKids.map((k, n) => [n, k.getBoundingClientRect()]).sort((a, b) => a[1].top - b[1].top || a[1].left - b[1].left).map((p) => p[0]).join(',');
        avg = rects.reduce((s, r) => s + r.width, 0) / rects.length;
        textKids = flowKids.filter((k) => k.textContent.trim().length >= 4).length;
      }
      rows.push({ i, w: shown ? el.getBoundingClientRect().width : 0, ctl: isLayout && flowKids.every((k) => k.matches('button, label, [role=tab], [role=radio], a[href], input')), label: T.label(el), shown, display: cs.display === 'none' ? 'none' : 'shown', pos: /fixed|sticky/.test(cs.position) ? 'pinned' : 'flow', dir: cs.flexDirection, cols, order, avg, textKids, layout: isLayout });
    }
    if (shown && el.matches('button, a[href], h1, h2, h3, label, [role=tab]') && el.children.length < 3) text.push({ i, t: (el.innerText || '').trim().replace(/\s+/g, ' ') });
    if (shown && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) sizes.push({ i, fs: parseFloat(cs.fontSize) });
  }
  // Phone text (used at 390 only): short control labels that wrap or truncate, and text that touches the screen edge.
  const vw = window.innerWidth, wraps = [], edges = [];
  const textRects = (el) => {
    const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const x of r.getClientRects()) if (x.width >= 2 && x.height >= 2) out.push(x);
    }
    return out;
  };
  for (const el of document.querySelectorAll('button, [role=tab], [role=radio], [role=button], a.btn, [class*=chip], [class*=pill], [class*=badge], [class*=tag], [class*=seg], time')) {
    if (!T.visible(el)) continue;
    const t = (el.innerText || '').trim();
    if (!t || t.length > 28 || /\n/.test(t)) continue;
    const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16;
    const tops = textRects(el).map((x) => x.top).sort((a, b) => a - b);
    let lines = tops.length ? 1 : 0;
    for (let k = 1; k < tops.length; k++) if (tops[k] - tops[k - 1] > fs * 0.6) lines++;
    if (lines >= 2) wraps.push(`${T.label(el)} "${t.slice(0, 24)}" wraps onto ${lines} lines`);
    else if (/ellipsis/.test(cs.textOverflow) && el.scrollWidth > el.clientWidth + 1) wraps.push(`${T.label(el)} "${t.slice(0, 24)}" is cut with an ellipsis`);
  }
  for (const el of document.querySelectorAll('[role=tablist], [role=radiogroup], [class*=tabs], [class*=segment], [class*=chips]')) {
    if (!T.visible(el)) continue;
    const kids = [...el.children].filter((k) => T.visible(k) && k.matches('button, a, label, [role=tab], [role=radio], input + label') && (k.innerText || '').trim());
    if (kids.length < 3 || /auto|scroll/.test(getComputedStyle(el).overflowX)) continue;
    const top0 = kids[0].getBoundingClientRect().top;
    if (kids.some((k) => Math.abs(k.getBoundingClientRect().top - top0) > 6)) wraps.push(`${T.label(el)}: the row of ${kids.length} controls breaks onto a second line`);
  }
  const seenEdge = new Set();
  for (const el of all) {
    if (el instanceof SVGElement || !T.visible(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    for (const x of textRects(el)) {
      if (x.right <= 0 || x.left >= vw) continue; // inside a scroller, off screen: the overflow check owns it
      if (x.left < 6 || x.right > vw - 6) { if (!seenEdge.has(el)) { seenEdge.add(el); edges.push(`${T.label(el)} text sits ${Math.round(x.left < 6 ? x.left : vw - x.right)} px from the ${x.left < 6 ? 'left' : 'right'} edge`); } break; }
    }
  }
  const body = getComputedStyle(document.body);
  return { rows, text, sizes, wraps, edges, viewport: window.innerWidth, zoom: body.zoom, bodyTransform: body.transform };
}

async function reflow(session, url) {
  const run = async (w, h) => {
    const page = await session.newPage({ width: w, height: h });
    try { await page.goto(url); await page.wait(300); await page.evaluate(install); return await page.evaluate(collectLayout); } finally { await page.close(); }
  };
  const d = await run(1440, 900);
  const m = await run(390, 844);
  const out = { checked: 0, bad: [], info: [] };
  const mi = new Map(m.rows.map((r) => [r.i, r]));
  let signals = 0, multi = 0;
  for (const r of d.rows) {
    const p = mi.get(r.i);
    // Only a wide multi-column layout can fail to re-flow; a narrow card keeps its columns at 390 on purpose.
    if (r.layout && r.cols >= 2 && r.w >= 700) multi++;
    if (!p) continue;
    if (r.layout && p.layout && p.cols < r.cols) signals++;
    else if (r.layout && p.layout && r.dir !== p.dir) signals++;
    else if (r.layout && p.layout && r.order !== p.order) signals++;
    else if (r.shown !== p.shown) signals++;
    else if (r.pos !== p.pos) signals++;
    if (r.layout && p.layout && !p.ctl && p.cols >= 3 && p.avg < 90 && p.textKids >= 3) out.bad.push(`${p.label}: ${p.cols} text columns squeezed to ${Math.round(p.avg)} px each at 390`);
  }
  out.checked = d.rows.length;
  if (m.viewport > 480) out.bad.push(`phone lays out at ${m.viewport} px, so it shows the desktop layout scaled down (no responsive viewport meta)`);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const ratio = med(m.sizes.map((s) => s.fs)) / (med(d.sizes.map((s) => s.fs)) || 1);
  if (ratio && ratio < 0.65) out.bad.push(`text is ${Math.round(ratio * 100)}% of desktop size at 390 (median), the layout is scaled, not rebuilt`);
  if ((m.zoom && m.zoom !== '1') || (m.bodyTransform && m.bodyTransform !== 'none')) out.bad.push('page body is scaled with zoom or transform at 390');
  if (multi >= 1 && signals === 0) out.bad.push(`${multi} multi-column layout(s) at 1440 keep the same columns, order and visibility at 390 (no re-flow)`);
  for (const w of m.wraps.slice(0, 4)) out.bad.push(`390 px: ${w} (shorten the label or let the row scroll)`);
  if (m.wraps.length > 4) out.bad.push(`390 px: ${m.wraps.length - 4} more labels wrap or truncate`);
  for (const e of m.edges.slice(0, 3)) out.bad.push(`390 px: ${e} (needs a side gutter of 16 px)`);
  if (m.edges.length > 3) out.bad.push(`390 px: ${m.edges.length - 3} more text elements touch the screen edge`);
  const dt = new Map(d.text.map((t) => [t.i, t.t]));
  let shorter = 0, compared = 0;
  for (const t of m.text) { const x = dt.get(t.i); if (x === undefined) continue; compared++; if (t.t.length < x.length) shorter++; }
  out.info.push(`reflow signals ${signals}; copy: ${shorter} of ${compared} labels are shorter at 390`);
  return out;
}

// ---- select-chevron ---------------------------------------------------------------------

function measureChevrons() {
  const T = window.__taste;
  const MIN = 8;
  const out = { checked: 0, bad: [] };
  const split = (s) => { const a = []; let d = 0, c = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { a.push(c.trim()); c = ''; } else c += ch; } a.push(c.trim()); return a; };
  const bgMargin = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const C = r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    const imgs = split(cs.backgroundImage), xs = split(cs.backgroundPositionX), sz = split(cs.backgroundSize);
    let best = null;
    imgs.forEach((img, k) => {
      if (img === 'none') return;
      const size = (sz[k % sz.length] || 'auto').split(/\s+/)[0];
      const w = /px$/.test(size) ? parseFloat(size) : 12;
      if (w > C * 0.6) return;
      const x = xs[k % xs.length];
      let pos;
      let m = /^calc\(\s*([\d.]+)%\s*([-+])\s*(-?[\d.]+)px\s*\)$/.exec(x);
      if (m) pos = (C - w) * parseFloat(m[1]) / 100 + (m[2] === '-' ? -1 : 1) * parseFloat(m[3]);
      else if (/%$/.test(x)) pos = (C - w) * parseFloat(x) / 100;
      else if (/px$/.test(x)) pos = parseFloat(x);
      else return;
      if (pos < C * 0.5) return;
      const margin = C - w - pos;
      if (best === null || margin > best) best = margin;
    });
    return best;
  };
  const iconMargin = (el) => {
    let best = null;
    const r = el.getBoundingClientRect();
    const scopes = [el, el.parentElement, el.parentElement && el.parentElement.parentElement].filter(Boolean);
    for (const s of scopes) {
      for (const ic of s.querySelectorAll('svg, img, i, [class*=chev], [class*=caret], [class*=arrow], [class*=icon]')) {
        if (ic === el || (el.tagName === 'SELECT' && el.contains(ic)) || ic.closest('select') && ic.closest('select') !== el) continue;
        if (!T.visible(ic)) continue;
        const ir = ic.getBoundingClientRect();
        if (ir.width > r.width * 0.5 || ir.right > r.right + 1 || ir.left < r.left + r.width * 0.5) continue;
        if (ir.bottom < r.top || ir.top > r.bottom) continue;
        const margin = r.right - ir.right;
        if (best === null || margin > best) best = margin;
      }
      for (const ps of ['::before', '::after']) {
        const p = getComputedStyle(s, ps);
        if (!p.content || p.content === 'none' || p.content === 'normal' || p.position !== 'absolute') continue;
        const sr = s.getBoundingClientRect();
        const w = parseFloat(p.width) || 12;
        const rt = parseFloat(p.right);
        const lf = parseFloat(p.left);
        let right;
        if (!Number.isNaN(rt) && p.right !== 'auto') right = sr.right - rt;
        else if (!Number.isNaN(lf) && p.left !== 'auto') right = sr.left + lf + w;
        else continue;
        if (right < r.left + r.width * 0.5 || right > r.right + 1) continue;
        const margin = r.right - right;
        if (best === null || margin > best) best = margin;
      }
    }
    return best;
  };
  for (const el of document.querySelectorAll('select')) {
    if (!T.visible(el) || el.multiple || el.size > 1) continue;
    out.checked++;
    const cs = getComputedStyle(el);
    if (cs.appearance !== 'none' && cs.webkitAppearance !== 'none') { out.bad.push(`${T.label(el)}: browser default select (no appearance:none and custom chevron)`); continue; }
    const margins = [bgMargin(el), iconMargin(el)].filter((v) => v !== null);
    if (!margins.length) { out.bad.push(`${T.label(el)}: appearance:none but no chevron found`); continue; }
    const m = Math.max(...margins);
    if (m < MIN - 0.5) out.bad.push(`${T.label(el)}: chevron ${Math.round(m * 10) / 10} px from the right edge (needs ${MIN} or more)`);
  }
  for (const el of document.querySelectorAll('[role=combobox], [aria-haspopup=listbox]')) {
    if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || !T.visible(el)) continue;
    out.checked++;
    const margins = [bgMargin(el), iconMargin(el)].filter((v) => v !== null);
    if (!margins.length) { out.bad.push(`${T.label(el)}: custom listbox trigger has no chevron`); continue; }
    const m = Math.max(...margins);
    if (m < MIN - 0.5) out.bad.push(`${T.label(el)}: chevron ${Math.round(m * 10) / 10} px from the right edge (needs ${MIN} or more)`);
  }
  return out;
}

// ---- layout-stable ----------------------------------------------------------------------

function listTogglers() {
  const T = window.__taste;
  const sel = '[role=tab], [role=radio], [role=switch], [role=checkbox], [aria-pressed], [aria-selected], input[type=checkbox], input[type=radio], select';
  const els = T.pick(sel).filter((el) => !T.disabled(el)).slice(0, 14);
  T.tag(els);
  return els.map((el, i) => ({ i, label: T.label(el), select: el.tagName === 'SELECT' }));
}

function groupRects({ i, fresh }) {
  const T = window.__taste;
  const el = T.get(i);
  if (!el) return { vis: -1, rects: [], gone: true };
  if (fresh) {
    let root = el.parentElement;
    for (let k = 0; k < 2 && root && root.children.length < 2 && root !== document.body; k++) root = root.parentElement;
    if (!root || root === document.body || root === document.documentElement || root.getBoundingClientRect().height > window.innerHeight * 0.8) root = el.parentElement;
    window.__tasteGroup = { root, els: [root, ...root.querySelectorAll('*')].filter((n) => !(n instanceof SVGElement) && T.visible(n) && !/absolute|fixed/.test(getComputedStyle(n).position)).slice(0, 150) };
  }
  const g = window.__tasteGroup;
  if (!g.root.isConnected) return { vis: -1, rects: [], gone: true };
  const vis = [g.root, ...g.root.querySelectorAll('*')].filter((n) => T.visible(n)).length;
  return { vis, rects: g.els.map((n) => { const r = n.getBoundingClientRect(); return [r.left + scrollX, r.top + scrollY, r.width, r.height, T.label(n)]; }) };
}

async function layoutStable(page) {
  await page.evaluate(install);
  const targets = await page.evaluate(listTogglers);
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{caret-color:transparent!important;transition:none!important}'; document.head.appendChild(s); });
  const out = { checked: 0, bad: [], info: [] };
  const TOL = 1.5;
  const diff = (a, b) => {
    const hits = [];
    for (let k = 0; k < a.rects.length; k++) {
      const [x, y, w, h, name] = a.rects[k];
      const [x2, y2, w2, h2] = b.rects[k];
      if (!w || !h || !w2 || !h2) continue; // shown or hidden by the change, not shifted
      const d = Math.max(Math.abs(x - x2), Math.abs(y - y2), Math.abs(w - w2), Math.abs(h - h2));
      if (d > TOL) hits.push(`${name} moved ${Math.round(d * 10) / 10} px`);
    }
    return hits;
  };
  for (const t of targets) {
    const c = await page.evaluate(centerOf, t.i);
    if (!c.hit) continue;
    await mouse(page, 'mouseMoved', 1, 1);
    await page.wait(100);
    const rest = await page.evaluate(groupRects, { i: t.i, fresh: true });
    await mouse(page, 'mouseMoved', c.x, c.y);
    await page.wait(120);
    const hover = await page.evaluate(groupRects, { i: t.i, fresh: false });
    const before = await page.evaluate(() => location.href);
    if (t.select) {
      await page.evaluate((i) => { const s = window.__taste.get(i); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, t.i);
    } else {
      await mouse(page, 'mousePressed', c.x, c.y, 1);
      await mouse(page, 'mouseReleased', c.x, c.y);
    }
    await page.wait(200);
    const clicked = await page.evaluate(groupRects, { i: t.i, fresh: false });
    const after = await page.evaluate(() => location.href);
    out.checked++;
    if (rest.gone || hover.gone || clicked.gone) { out.info.push(`${t.label}: the page re-rendered the group, shift test skipped`); continue; }
    const h1 = diff(rest, hover);
    if (h1.length) out.bad.push(`${t.label}: hover shifts layout (${h1.slice(0, 2).join('; ')})`);
    if (before !== after) { out.info.push(`${t.label}: click navigated, skipped`); continue; }
    if (hover.vis !== clicked.vis) { out.info.push(`${t.label}: click revealed or hid content, shift test skipped`); continue; }
    const h2 = diff(hover, clicked);
    if (h2.length) out.bad.push(`${t.label}: state change shifts layout (${h2.slice(0, 2).join('; ')})`);
  }
  return out;
}

// ---- accent-bar -------------------------------------------------------------------------

function measureAccentBars() {
  const T = window.__taste;
  const out = { checked: 0, bad: [] };
  const SKIP = 'input, select, textarea, hr, table, td, th, tr, svg, img, progress, meter';
  const split = (s) => { const a = []; let d = 0, c = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { a.push(c); c = ''; } else c += ch; } a.push(c); return a; };
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement || el.matches(SKIP) || !T.visible(el) || el.closest('progress, [role=progressbar], [role=slider], [class*=progress], [class*=slider], [class*=track]')) continue;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    out.checked++;
    for (const side of ['Left', 'Right']) {
      const w = parseFloat(cs[`border${side}Width`]);
      if (!(w >= 2 && w <= 8) || !/solid|double/.test(cs[`border${side}Style`]) || T.alpha(cs[`border${side}Color`]) === 0 || box.height < 12) continue;
      const own = cs[`border${side}Color`];
      const others = ['Top', 'Bottom', side === 'Left' ? 'Right' : 'Left'].map((s) => [parseFloat(cs[`border${s}Width`]), cs[`border${s}Color`]]);
      if (others.every(([ow, oc]) => ow < w - 0.5 || oc !== own)) out.bad.push(`${side.toLowerCase()} border bar ${w}px on ${T.label(el)}`);
    }
    if (cs.boxShadow !== 'none') {
      for (const part of split(cs.boxShadow)) {
        if (!/inset/.test(part)) continue;
        const nums = part.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || [];
        const [x, y, blur] = nums.map(parseFloat);
        if (Math.abs(x) >= 2 && Math.abs(x) <= 8 && y === 0 && !blur) out.bad.push(`inset shadow bar ${Math.abs(x)}px on ${T.label(el)}`);
      }
    }
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      if (!p.content || p.content === 'none' || p.content === 'normal' || p.position !== 'absolute') continue;
      const w = parseFloat(p.width), h = parseFloat(p.height);
      const edge = Math.min(Math.abs(parseFloat(p.left)), Math.abs(parseFloat(p.right)));
      if (w >= 2 && w <= 8 && h >= Math.max(12, box.height * 0.5) && h > w * 2 && edge <= 4 && T.alpha(p.backgroundColor) > 0 && !T.round(p, w, h)) out.bad.push(`pseudo bar ${w}px on ${T.label(el)}${ps}`);
    }
  }
  return out;
}

// ---- driver -----------------------------------------------------------------------------

const withPage = async (session, url, fn, width = 1440, height = 900) => {
  const page = await session.newPage({ width, height });
  try { await page.goto(url); await page.wait(300); return await fn(page); } finally { await page.close(); }
};

const RUNNERS = {
  'worst-case-text': async (session, url) => {
    const r = (await runCraftProbes(url, { session, only: ['worst-case-text'] }))['worst-case-text'];
    if (r.status === 'ERROR') throw new Error(r.findings.join(', '));
    return { checked: r.checked, bad: r.findings, status: r.status };
  },
  'hover-press': (s, u) => withPage(s, u, hoverPress),
  'transition-duration': (s, u) => withPage(s, u, async (p) => { await p.evaluate(install); return p.evaluate(measureTransitions); }),
  'segmented-transform': (s, u) => withPage(s, u, segmented),
  'decorative-dots': async (s, u) => {
    const seen = new Set();
    const out = { checked: 0, bad: [] };
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const r = await withPage(s, u, async (p) => { await p.evaluate(install); return p.evaluate(measureGlyphDots); }, w, h);
      out.checked = Math.max(out.checked, r.checked);
      for (const b of r.bad) if (!seen.has(b)) { seen.add(b); out.bad.push(b); }
    }
    return out;
  },
  'responsive-reflow': (s, u) => reflow(s, u),
  'select-chevron': (s, u) => withPage(s, u, async (p) => { await p.evaluate(install); return p.evaluate(measureChevrons); }),
  'layout-stable': (s, u) => withPage(s, u, layoutStable),
  'accent-bar': (s, u) => withPage(s, u, async (p) => { await p.evaluate(install); return p.evaluate(measureAccentBars); }),
};

// Returns { name: { status: 'PASS' | 'FAIL' | 'WARN' | 'NA' | 'ERROR', checked, findings, info } }. NA means nothing on the page to check.
export async function runTasteProbes(url, { session, only = PROBES, skip = [] } = {}) {
  const results = {};
  for (const name of PROBES) {
    if (!only.includes(name)) continue;
    if (skip.includes(name)) { results[name] = { status: 'SKIPPED', checked: 0, findings: [], info: ['skipped by craft-overrides.json'] }; continue; }
    try {
      const r = await RUNNERS[name](session, url);
      const findings = [...new Set(r.bad)];
      results[name] = { status: r.status || (findings.length ? 'FAIL' : r.checked ? 'PASS' : 'NA'), checked: r.checked, findings, info: r.info || [] };
    } catch (error) {
      results[name] = { status: 'ERROR', checked: 0, findings: [String(error.message).split('\n')[0]], info: [] };
    }
  }
  return results;
}
