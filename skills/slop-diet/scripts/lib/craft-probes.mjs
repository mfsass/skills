// Shared interaction checks. Each viewport has a fixed time budget.
export const CRAFT_PROBES = ['picker-flow', 'overlay-bounds', 'worst-case-text', 'card-dead-space'];

function installCraft() {
  const visible = (el) => {
    if (!el || !el.getClientRects().length) return false;
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    }
    return true;
  };
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.getAttribute('aria-label') || el.textContent || el.type || '').trim().replace(/\s+/g, ' ').slice(0, 60)}"`;
  const overlaySelector = 'dialog,[role=dialog],[role=listbox],[role=menu],[popover],[class*=popover],[class*=drawer],[class*=sheet]';
  // An in-flow list (position static or relative) is not an overlay, even with role=listbox.
  const topLayer = (el) => { try { return el.matches('dialog[open],:popover-open'); } catch { return el.matches('dialog[open]'); } };
  const overlays = () => [...document.querySelectorAll(overlaySelector)].filter((el) => visible(el) && (topLayer(el) || /^(fixed|absolute)$/.test(getComputedStyle(el).position)));
  // Pickers first, then disclosure triggers, then other buttons. Repeated row buttons take one slot.
  // A submit button inside a form is skipped: clicking it navigates.
  const pickerSelector = 'select,[role=combobox],[aria-haspopup],input[type=date],input[type=time],input[type=datetime-local]';
  const seen = new Set();
  const controls = [...document.querySelectorAll(`${pickerSelector},button,[role=button]`)]
    .filter((el) => visible(el) && !el.matches(':disabled,[aria-disabled=true]'))
    .filter((el) => !(el.form && el.type === 'submit' && !el.matches('[aria-haspopup],[aria-controls]')))
    .map((el, i) => [el, el.matches(pickerSelector) ? 0 : el.matches('[aria-controls],[aria-expanded]') ? 1 : 2, i])
    .filter(([el, rank]) => {
      if (rank === 0) return true;
      const k = `${el.tagName}|${el.className}|${(el.textContent || '').trim().replace(/\s+/g, ' ')}`;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    })
    .sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([el]) => el);
  const bounds = () => overlays().flatMap((el) => {
    const r = el.getBoundingClientRect(), bad = [];
    if (r.left < -1 || r.right > innerWidth + 1) bad.push(`${label(el)} exceeds viewport width`);
    if (r.top < -1 || r.bottom > innerHeight + 1) bad.push(`${label(el)} exceeds viewport height`);
    const clipped = [...el.querySelectorAll('*')].filter(visible).some((child) => {
      const c = child.getBoundingClientRect();
      const scrolls = (axis) => { for (let n = child.parentElement; n && el.contains(n); n = n.parentElement) if (/auto|scroll/.test(getComputedStyle(n)[axis]) && n.clientHeight > 0) return true; return false; };
      if ((c.right > r.right + 1 || c.left < r.left - 1) && !scrolls('overflowX')) return true;
      return c.bottom > r.bottom + 1 && !scrolls('overflowY');
    });
    if (clipped) bad.push(`${label(el)} cuts off content without internal scrolling`);
    return bad;
  });
  const prices = () => {
    const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!visible(n.parentElement) || n.parentElement.closest('script,style,option')) continue;
      const re = /(?:[$€£]\s*)?\d[\d,.]*\s*(?:\/\s*(?:month|mo|year|yr)\b|per\s+(?:month|year)\b)/gi;
      for (const match of n.textContent.matchAll(re)) {
        const range = document.createRange();
        range.setStart(n, match.index); range.setEnd(n, match.index + match[0].length);
        const tops = [...range.getClientRects()].filter((r) => r.width && r.height).map((r) => r.top);
        if (tops.some((top) => Math.abs(top - tops[0]) > 1)) bad.push(`${label(n.parentElement)} wraps price ${match[0]}`);
      }
    }
    // A price split across inline elements (<span>€200</span> <span>per month</span>): no line box may sit below another.
    const one = /(?:[$€£]\s*)?\d[\d,.]*\s*(?:\/\s*(?:month|mo|year|yr)\b|per\s+(?:month|year)\b)/i;
    for (const el of document.querySelectorAll('body *')) {
      if (!el.children.length || el.textContent.length > 200 || el.closest('script,style,option,select')) continue;
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t.length > 60 || !one.test(t)) continue;
      // Flex items are blockified, so a row flex container counts as inline; a column or block child is a deliberate stack.
      const pd = getComputedStyle(el), rowFlex = /flex/.test(pd.display) && !/column/.test(pd.flexDirection);
      if ([...el.children].some((c) => one.test(c.textContent) || (!rowFlex && !/^inline/.test(getComputedStyle(c).display))) || !visible(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const boxes = [...range.getClientRects()].filter((r) => r.width && r.height);
      if (boxes.some((a) => boxes.some((b) => b.top >= a.bottom - 1))) bad.push(`${label(el)} wraps price ${t}`);
    }
    return bad;
  };
  window.__craft = { visible, label, overlays, bounds, controls, prices };
}

function cardSpace() {
  const { visible, label } = window.__craft;
  const out = { checked: 0, findings: [] };
  for (const parent of document.querySelectorAll('body *')) {
    const kids = [...parent.children].filter((e) => visible(e) && e.children.length && !e.matches('button,select,label,svg'));
    for (const el of kids) {
      const r = el.getBoundingClientRect();
      const row = kids.filter((k) => { const b = k.getBoundingClientRect(); return Math.abs(b.top - r.top) <= 1 && Math.abs(b.width - r.width) <= 1; });
      if (row.length < 3) continue;
      const s = getComputedStyle(el);
      if (!el.matches('article,[class*=card],[class*=tile]') && s.backgroundColor === 'rgba(0, 0, 0, 0)' && parseFloat(s.borderTopWidth) === 0) continue;
      const bottoms = [...el.children].filter(visible).map((k) => k.getBoundingClientRect().bottom);
      if (!bottoms.length) continue;
      out.checked++;
      const px = (p) => parseFloat(s[p]) || 0;
      const inner = r.height - px('paddingTop') - px('paddingBottom') - px('borderTopWidth') - px('borderBottomWidth');
      const empty = r.bottom - px('paddingBottom') - px('borderBottomWidth') - Math.max(...bottoms);
      if (inner > 0 && empty / inner > 0.35) out.findings.push(`${label(el)} has ${Math.round(empty / inner * 100)}% empty space below its last child`);
    }
  }
  return out;
}

async function worstCase(page) {
  return page.evaluate(async () => {
    const { visible, label, prices } = window.__craft;
    // Freeze CSS motion and let load-time reveals settle, so a transition is not read as a layout shift.
    const freeze = document.createElement('style');
    freeze.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.append(freeze);
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    await frame(); await frame(); await new Promise((r) => setTimeout(r, 60));
    // Run short timers (a 160 ms cross-fade, a debounce) at once, so the check sees the final text.
    const realTimeout = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => realTimeout(fn, ms <= 250 ? 0 : ms, ...a);
    try { return await run(); } finally { window.setTimeout = realTimeout; freeze.remove(); }
    async function run() {
    const out = { checked: 1, findings: prices(), warnings: [] };
    // Rows a filter shows or hides. A list that changes its row count may change height, and content below it may move.
    const rows = (el) => [...el.querySelectorAll('tr,li,[role=row],[role=option],article')].filter((x) => x.getClientRects().length).length;
    const controls = [...document.querySelectorAll('select,input[type=radio],input[type=checkbox],[role=radio],[role=switch],[aria-pressed],[role=tab],[class*=segment] button,[role=radiogroup] button')].filter((el) => visible(el) || visible(el.labels?.[0])).filter((el) => !el.matches(':disabled,[aria-disabled=true]'));
    if (controls.length > 12) out.warnings.push('incomplete: checked the first 12 controls.');
    const measurable = (el) => visible(el) && !el.closest('[aria-hidden=true]')
      && !/^(absolute|fixed)$/.test(getComputedStyle(el).position)
      && (!!el.innerText?.trim() || el.matches('button,input,select,textarea,a[href],[role=button],[role=tab],[role=switch],[role=radio],[role=checkbox],[role=combobox]'));
    for (const control of controls.slice(0, 12)) {
      const target = visible(control) ? control : control.labels?.[0];
      if (!visible(target) || control.disabled || control.getAttribute('aria-disabled') === 'true') continue;
      // Measure siblings along the ancestor chain, including content after the control's section.
      const siblings = new Set();
      for (let n = target; n?.parentElement && n !== document.body; n = n.parentElement) {
        for (const s of n.parentElement.children) if (s !== n && measurable(s)) siblings.add(s);
      }
      const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; };
      const base = [...siblings].map((el) => [el, rect(el), rows(el)]);
      const options = control.tagName === 'SELECT' ? [...control.options].filter((o) => !o.disabled && !o.parentElement.disabled).map((o) => o.index) : [0, 1];
      for (const index of options) {
        if (control.tagName === 'SELECT') {
          control.selectedIndex = index;
          control.dispatchEvent(new Event('input', { bubbles: true }));
          control.dispatchEvent(new Event('change', { bubbles: true }));
        } else target.click();
        await new Promise((resolve) => realTimeout(resolve, 35));
        out.checked++;
        const filtered = base.filter(([el, , n]) => el.isConnected && rows(el) !== n).map(([el]) => el);
        for (const [el, before] of base) {
          if (!el.isConnected || !measurable(el) || filtered.includes(el)) continue;
          const after = rect(el);
          const sameSize = Math.abs(before[2] - after[2]) <= 1 && Math.abs(before[3] - after[3]) <= 1;
          if (sameSize && filtered.some((f) => f.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          const delta = Math.max(...before.map((v, i) => Math.abs(v - after[i])));
          if (delta > 1) out.findings.push(`${label(control)} moves sibling ${label(el)} by ${Math.round(delta * 10) / 10}px`);
        }
        out.findings.push(...prices());
      }
    }
    return out;
    }
  });
}

async function key(page, key, code, windowsVirtualKeyCode) {
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode });
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
}

async function interactions(page, picker, overlay) {
  const out = { 'picker-flow': { checked: 0, findings: [], warnings: [] }, 'overlay-bounds': { checked: 0, findings: [], warnings: [] } };
  const incomplete = (reason) => {
    for (const r of Object.values(out)) r.warnings.push(`incomplete: ${reason}`);
    return out;
  };
  const count = await page.evaluate(() => window.__craft?.controls.length ?? null);
  if (count === null) return incomplete('the document changed during interaction.');
  if (count > 12) incomplete('checked the first 12 controls.');
  for (let i = 0; i < Math.min(count, 12); i++) {
    const c = await page.evaluate((i) => {
      const T = window.__craft;
      if (!T?.controls[i]) return { incomplete: true };
      const el = T.controls[i];
      if (!el.isConnected || !T.visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
      const picker = el.matches('select,[role=combobox],[aria-haspopup],input[type=date],input[type=time],input[type=datetime-local]');
      T.before = T.overlays();
      T.attrs = [...document.querySelectorAll('dialog,[role=dialog],[role=listbox],[role=menu],[popover],[class*=popover],[class*=drawer],[class*=sheet]')].map((e) => [e, [...e.attributes].map((a) => [a.name, a.value])]);
      T.clickEvent = null;
      el.addEventListener('click', (event) => { T.clickEvent = event; }, { once: true });
      el.scrollIntoView({ block: 'center', behavior: 'instant' }); // a smooth-scroll page would move it after we read its position
      const r = el.getBoundingClientRect();
      return { label: T.label(el), picker, native: el.matches('select,input[type=date],input[type=time],input[type=datetime-local]'), value: el.value, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, i);
    if (c?.incomplete) return incomplete('the document changed during interaction.');
    if (!c) continue;
    const errors = page.errors.length;
    await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    if (c.native) {
      await key(page, 'Escape', 'Escape', 27);
      await key(page, 'ArrowDown', 'ArrowDown', 40);
      await key(page, 'Enter', 'Enter', 13);
    }
    await page.wait(60);
    const state = await page.evaluate((i) => {
      const T = window.__craft;
      if (!T?.controls[i]) return { incomplete: true };
      const el = T.controls[i];
      if (!el.isConnected) return { incomplete: true };
      const opened = T.overlays().filter((e) => !T.before.includes(e));
      // Native select popups live outside the DOM. Check the default click before selecting an option.
      let nativeWorks = false;
      if (el.matches('select') && T.clickEvent && !T.clickEvent.defaultPrevented) {
        const option = [...el.options].find((o) => !o.disabled && !o.parentElement.disabled && o.value !== el.value);
        if (option) { el.value = option.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        nativeWorks = [...el.options].some((o) => !o.disabled && !o.parentElement.disabled);
      }
      // Native date and time popups also live outside the DOM; one arrow key on an empty field leaves value "".
      if (el.matches('input[type=date],input[type=time],input[type=datetime-local]') && T.clickEvent && !T.clickEvent.defaultPrevented) nativeWorks = true;
      // A text combobox works when the list it controls shows after the click (a popup, or an in-flow list it filters).
      const controlled = el.matches('[role=combobox]') && document.getElementById(el.getAttribute('aria-controls') || '');
      if (controlled && T.visible(controlled)) nativeWorks = true;
      return { nativeWorks, changed: el.value, opened: opened.length, dialog: opened.some((e) => e.matches('dialog,[role=dialog]')), bounds: T.bounds() };
    }, i);
    if (state.incomplete) return incomplete('the document changed during interaction.');
    if (picker && (c.picker || state.dialog)) {
      out['picker-flow'].checked++;
      if ((!state.opened && !state.nativeWorks && c.value === state.changed) || page.errors.length > errors) {
        out['picker-flow'].findings.push(`${c.label}: ${page.errors.length > errors ? page.errors.slice(errors).join(', ') : 'click opened no popup and changed no value'}`);
      }
    }
    if (overlay && state.opened) { out['overlay-bounds'].checked += state.opened; out['overlay-bounds'].findings.push(...state.bounds); }
    await key(page, 'Escape', 'Escape', 27);
    const restored = await page.evaluate(() => {
      const T = window.__craft;
      if (!T) return false;
      for (const el of T.overlays()) {
        if (el.matches('dialog[open]')) el.close();
        if (el.matches(':popover-open')) el.hidePopover();
      }
      for (const [el, attrs] of T.attrs) {
        for (const a of [...el.attributes]) el.removeAttribute(a.name);
        for (const [name, value] of attrs) el.setAttribute(name, value);
      }
      return true;
    });
    if (!restored) return incomplete('the document changed during interaction.');
  }
  return out;
}

// Slow pages and navigation report incomplete warnings. Probe defects report ERROR.
export async function runCraftProbes(url, { session, only = CRAFT_PROBES, timeoutMs = 6000 } = {}) {
  const result = Object.fromEntries(only.map((n) => [n, { checked: 0, findings: [], warnings: [], status: 'PASS', info: [] }]));
  for (const [width, height] of [[320, 700], [390, 844], [1440, 900]]) {
    const active = only.filter((n) => n === 'overlay-bounds' ? width !== 1440 : width !== 320);
    if (!active.length) continue;
    const page = await session.newPage({ width, height }, { collectErrors: true });
    let timer, expired = false;
    const merge = (name, r) => {
      if (expired) return;
      result[name].checked += r.checked;
      result[name].findings.push(...r.findings.map((f) => `${width}: ${f}`));
      result[name].warnings.push(...(r.warnings || []).map((f) => `${width}: ${f}`));
    };
    try {
      await Promise.race([(async () => {
        await page.goto(url);
        await page.evaluate(installCraft);
        if (active.includes('overlay-bounds')) {
          merge('overlay-bounds', await page.evaluate(() => ({ checked: window.__craft.overlays().length, findings: window.__craft.bounds() })));
        }
        if (active.includes('card-dead-space')) merge('card-dead-space', await page.evaluate(cardSpace));
        if (active.includes('worst-case-text')) merge('worst-case-text', await worstCase(page));
        if (active.some((n) => n === 'picker-flow' || n === 'overlay-bounds')) {
          const r = await interactions(page, active.includes('picker-flow'), active.includes('overlay-bounds'));
          for (const n of active.filter((n) => n === 'picker-flow' || n === 'overlay-bounds')) merge(n, r[n]);
        }
      })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Craft check timed out.')), timeoutMs); })]);
    } catch (error) {
      expired = true;
      const incomplete = /timed? ?out|timeout|execution context.*destroyed|cannot find context|inspected target navigated|target.*closed/i.test(error.message);
      for (const n of active) {
        if (incomplete) result[n].warnings.push(`${width}: incomplete: ${error.message.split('\n')[0]}`);
        else { result[n].findings.push(`${width}: ${error.message.split('\n')[0]}`); result[n].status = 'ERROR'; }
      }
    } finally { clearTimeout(timer); await page.close(); }
  }
  for (const [name, r] of Object.entries(result)) {
    r.findings = [...new Set(r.findings)];
    if (r.status !== 'ERROR' || name === 'card-dead-space') r.status = r.findings.length ? name === 'card-dead-space' ? 'WARN' : 'FAIL' : r.warnings.length ? 'WARN' : r.checked ? 'PASS' : 'NA';
    r.findings.push(...new Set(r.warnings));
  }
  return result;
}

export function formatCraftProbes(results) {
  const lines = [], failed = [];
  let error = false;
  for (const [name, r] of Object.entries(results)) {
    if (r.status === 'FAIL') failed.push(name);
    if (r.status === 'ERROR' && name !== 'card-dead-space') error = true;
    lines.push(`  ${name.padEnd(16)} ${r.status} (${r.checked} checked)`);
    for (const f of r.findings.slice(0, 4)) lines.push(`    [${name.toUpperCase()}] ${f}`);
  }
  return { lines, failed, error };
}
