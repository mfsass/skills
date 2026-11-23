const response = (result, message, extra = {}) => ({ result, message, ...extra });

export async function commonProbe(page, check) {
  const details = await page.locator(check.selector).evaluateAll((elements, probe) => {
    const visible = node => {
      const rect = node.getBoundingClientRect();
      return !!(rect.width && rect.height) && !['hidden', 'collapse'].includes(getComputedStyle(node).visibility);
    };
    const included = elements.map((element, index) => ({ element, index }))
      .filter(({ element }) => visible(element) && (!probe.exclude || !element.closest(probe.exclude)));
    const cap = probe.maxTargets ?? 100;
    const observations = included.slice(0, cap).map(({ element, index }) => {
      const item = (result, message, extra = {}) => ({ index, result, message, ...extra });
      if (!visible(element)) return item('Unknown', 'The selected element is not visible.');
      if (probe.type === 'text-fit') {
        if (!(element instanceof HTMLElement) || ['INPUT', 'TEXTAREA', 'SELECT', 'CANVAS', 'IFRAME'].includes(element.tagName))
          return item('Unknown', 'This element needs a separate text measurement.');
        const nodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) if (walker.currentNode.textContent.trim() && visible(walker.currentNode.parentElement)) nodes.push(walker.currentNode);
        if (!nodes.length) return item('Unknown', 'The selected element contains no visible text.');
        const tolerance = probe.tolerance ?? 1;
        const failures = [];
        for (const node of nodes) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const rects = [...range.getClientRects()].filter(rect => rect.width && rect.height);
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.textOverflow === 'ellipsis' || !['none', '0', ''].includes(style.webkitLineClamp || 'none'))
              return item('Unknown', 'Explicit text truncation needs a separate review.');
            if (style.transform !== 'none' || style.writingMode !== 'horizontal-tb' || style.clipPath !== 'none' || style.clip !== 'auto' ||
                (style.maskImage && style.maskImage !== 'none') || (style.webkitMaskImage && style.webkitMaskImage !== 'none'))
              return item('Unknown', 'A text effect needs a separate text measurement.');
            for (const pseudo of ['::before', '::after']) {
              const generated = getComputedStyle(parent, pseudo);
              if (generated.content !== 'none' && generated.content !== 'normal' && generated.display !== 'none')
                return item('Unknown', 'Generated content needs a separate text measurement.');
            }
            if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) {
              const bounds = parent.getBoundingClientRect();
              const left = bounds.left + parent.clientLeft;
              const right = left + parent.clientWidth;
              if (rects.some(rect => rect.left < left - tolerance || rect.right > right + tolerance))
                failures.push({ tag: parent.tagName.toLowerCase(), left, right });
            }
          }
          if (rects.some(rect => rect.left < -tolerance || rect.right > innerWidth + tolerance)) failures.push({ boundary: 'viewport' });
        }
        return failures.length ? item('Fail', 'Some text exceeds a horizontal visible boundary.', { boundaries: failures })
          : item('Pass', 'The measured text fits the horizontal visible boundaries.');
      }
      if (probe.type === 'row-harmony') {
        const defaultControlSelector = 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), button, select, [role="combobox"], [role="radiogroup"]';
        const isAllowed = node => visible(node) && (!probe.exclude || !node.closest(probe.exclude));
        const dedupeNested = nodes => {
          const set = new Set(nodes);
          return nodes.filter(node => {
            for (let parent = node.parentElement; parent && parent !== element; parent = parent.parentElement) {
              if (set.has(parent)) return false;
            }
            return true;
          });
        };
        let rawItems;
        if (probe.itemSelector) {
          rawItems = [...element.querySelectorAll(probe.itemSelector)].filter(isAllowed);
        } else {
          const interactive = dedupeNested([...element.querySelectorAll(defaultControlSelector)].filter(isAllowed));
          rawItems = interactive.length >= 2 ? interactive : [...element.children].filter(isAllowed);
        }
        const labelOf = node => {
          const tag = node.tagName.toLowerCase();
          const clean = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
          if (tag === 'input') {
            return clean(node.getAttribute('aria-label') || node.labels?.[0]?.textContent || node.getAttribute('placeholder') || node.value || node.name);
          }
          if (tag === 'select') {
            return clean(node.getAttribute('aria-label') || node.labels?.[0]?.textContent || node.options?.[node.selectedIndex]?.text || node.name);
          }
          return clean(node.textContent || node.getAttribute('aria-label'));
        };
        const items = rawItems
          .map(node => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            const isTransparent = color => {
              if (!color) return false;
              const normalized = color.toLowerCase().replace(/\s+/g, '');
              if (normalized === 'transparent') return true;
              const rgba = /^rgba\(\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?,(\d*(?:\.\d+)?)\)$/.exec(normalized);
              if (rgba && Number(rgba[1]) === 0) return true;
              const slash = /^rgb\([^/]+\/(\d*(?:\.\d+)?)%?\)$/.exec(normalized);
              return Boolean(slash && Number(slash[1]) === 0);
            };
            const sides = [
              [style.borderTopWidth, style.borderTopStyle, style.borderTopColor],
              [style.borderRightWidth, style.borderRightStyle, style.borderRightColor],
              [style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor],
              [style.borderLeftWidth, style.borderLeftStyle, style.borderLeftColor],
            ];
            const hasBorder = sides.some(([w, s, c]) => parseFloat(w) > 0 && s && s !== 'none' && s !== 'hidden' && !isTransparent(c));
            return {
              tag: node.tagName.toLowerCase(),
              role: node.getAttribute('role'),
              text: labelOf(node),
              left: Math.round(rect.left * 10) / 10,
              top: Math.round(rect.top * 10) / 10,
              bottom: Math.round(rect.bottom * 10) / 10,
              height: Math.round(rect.height * 10) / 10,
              centerY: Math.round((rect.top + rect.height / 2) * 10) / 10,
              hasBorder,
            };
          });
        if (items.length < 2) return item('Unknown', 'The row contains fewer than two visible items.', { count: items.length });
        const tolerance = probe.heightTolerance ?? 2;
        const heights = items.map(entry => entry.height);
        const heightDelta = Math.round((Math.max(...heights) - Math.min(...heights)) * 10) / 10;
        const sorted = [...items].sort((a, b) => (a.top - b.top) || (a.left - b.left));
        const clusters = [];
        for (const entry of sorted) {
          const match = clusters.find(cluster => {
            const overlap = Math.min(cluster.maxBottom, entry.bottom) - Math.max(cluster.minTop, entry.top);
            return overlap > 0 || Math.abs(entry.centerY - cluster.centerY) <= 4;
          });
          if (match) {
            match.entries.push(entry);
            match.minTop = Math.min(match.minTop, entry.top);
            match.maxBottom = Math.max(match.maxBottom, entry.bottom);
            match.centerY = match.entries.reduce((sum, itemEntry) => sum + itemEntry.centerY, 0) / match.entries.length;
          } else {
            clusters.push({ minTop: entry.top, maxBottom: entry.bottom, centerY: entry.centerY, entries: [entry] });
          }
        }
        const rowCounts = clusters.map(cluster => cluster.entries.length);
        const orphanWrap = rowCounts.length >= 2 && rowCounts.some(count => count >= 2) && rowCounts[rowCounts.length - 1] === 1;
        const issues = [];
        if (heightDelta > tolerance) issues.push(`height delta ${heightDelta}px exceeds ${tolerance}px`);
        if (probe.checkBorder === true && !items.every(entry => entry.hasBorder === items[0].hasBorder))
          issues.push('mixed bordered and borderless siblings');
        if (probe.forbidOrphanWrap !== false && orphanWrap)
          issues.push(`orphan wrap detected (${rowCounts.join('+')})`);
        const controls = items.map(({ tag, role, text, height }) => ({ tag, role, text, height }));
        return issues.length
          ? item('Fail', `Row harmony failed: ${issues.join('; ')}.`, { issues, heights, rowCounts, controls, borders: items.map(entry => entry.hasBorder) })
          : item('Pass', 'The row items match height and wrapping rules.', { heights, rowCounts, controls });
      }
      const tag = element.tagName;
      const native = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IMG', 'A', 'SUMMARY'].includes(tag);
      if (!native || (tag === 'A' && !element.hasAttribute('href')))
        return item('Unknown', 'This element needs a separate name check.');
      if (element.hasAttribute('role') || element.closest('[aria-hidden="true"],[inert]'))
        return item('Unknown', 'This element needs a separate accessibility check.');
      const hasGeneratedText = node => [node, ...node.querySelectorAll('*')].some(child => ['::before', '::after'].some(pseudo => {
        const style = getComputedStyle(child, pseudo);
        return style.content !== 'none' && style.content !== 'normal' && style.display !== 'none';
      }));
      if (hasGeneratedText(element)) return item('Unknown', 'Generated content needs a separate name check.');
      if (element.hasAttribute('aria-labelledby')) {
        const ids = element.getAttribute('aria-labelledby').trim().split(/\s+/).filter(Boolean);
        const labels = ids.map(id => [...document.querySelectorAll('[id]')].filter(node => node.id === id));
        if (!ids.length || labels.some(matches => !matches.length)) return item('Fail', 'The label reference does not identify text.');
        if (labels.some(matches => matches.length !== 1)) return item('Unknown', 'The label reference is ambiguous.');
        const text = labels.map(matches => matches[0].textContent.trim()).join(' ').trim();
        if (labels.some(matches => matches[0].querySelector('input,select,textarea,img,svg,[aria-label],[aria-labelledby]')))
          return item('Unknown', 'The referenced label needs a separate name check.');
        return item(text ? 'Pass' : 'Fail', text ? 'The label reference identifies text.' : 'The referenced label contains no text.');
      }
      if (element.hasAttribute('aria-label')) return item(element.getAttribute('aria-label').trim() ? 'Pass' : 'Fail', 'The probe checked the explicit aria-label text.');
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) {
        const type = element.type?.toLowerCase();
        if (type === 'hidden') return item('Unknown', 'The selected input is hidden.');
        if (type === 'image') return item(element.getAttribute('alt')?.trim() ? 'Pass' : 'Fail', 'The probe checked the image input alt text.');
        if (['button', 'submit', 'reset'].includes(type))
          return element.hasAttribute('value') ? item(element.value.trim() ? 'Pass' : 'Fail', 'The probe checked the input button text.')
            : item('Unknown', 'The browser supplies the input button text.');
        const labels = [...(element.labels || [])];
        if (labels.some(label => label.querySelector('img,svg,[aria-label],[aria-labelledby]')))
          return item('Unknown', 'The native label needs a separate name check.');
        if (labels.some(label => hasGeneratedText(label))) return item('Unknown', 'Generated label content needs a separate name check.');
        const text = labels.map(label => {
          const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
          const parts = [];
          while (walker.nextNode()) {
            if (!walker.currentNode.parentElement.closest('input,select,textarea')) parts.push(walker.currentNode.textContent);
          }
          return parts.join(' ');
        }).join(' ').trim();
        if (text) return item('Pass', 'A native label provides text.');
        if (element.hasAttribute('title')) return item('Unknown', 'The title needs a separate name check.');
        return item('Fail', 'The form control has no supported explicit label.');
      }
      if (tag === 'IMG') {
        if (element.getAttribute('alt') === '') return item('Unknown', 'An empty alt value can identify a decorative image.');
        return item(element.getAttribute('alt')?.trim() ? 'Pass' : 'Fail', 'The probe checked the image alt text.');
      }
      if ([...element.querySelectorAll('svg,[role],[aria-label],[aria-labelledby]')]
        .some(node => !node.closest('svg[aria-hidden="true"]')))
        return item('Unknown', 'The control content needs a separate name check.');
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const parts = [];
      while (walker.nextNode()) {
        const parent = walker.currentNode.parentElement;
        if (!parent.closest('svg,[aria-hidden="true"]') && visible(parent)) parts.push(walker.currentNode.textContent);
      }
      const text = parts.join(' ').trim();
      const images = [...element.querySelectorAll('img')].filter(image => !image.closest('[aria-hidden="true"]'));
      if (text || images.some(image => image.getAttribute('alt')?.trim())) return item('Pass', 'The control provides visible text or image alt text.');
      if (element.hasAttribute('title')) return item('Unknown', 'The title needs a separate name check.');
      return item('Fail', 'The control has no supported name.');
    });
    if (included.length > cap) observations.push({ result: 'Unknown', message: 'The target count exceeds the coverage cap.', cap, count: included.length });
    return observations;
  }, check);
  if (!details.length) return response('Unknown', 'No included visible target matches the selector.', { details });
  const failMessages = {
    'text-fit': 'Some measured text exceeds a horizontal visible boundary.',
    'control-names': 'Some controls have no supported name.',
    'row-harmony': 'Some rows failed sibling height, border, or wrap harmony checks.',
  };
  const passMessages = {
    'text-fit': 'The probe checked horizontal text fit.',
    'control-names': 'The probe checked supported control names.',
    'row-harmony': 'The probe checked sibling height, border, and wrap harmony.',
  };
  if (details.some(item => item.result === 'Fail')) return response('Fail', failMessages[check.type], { details });
  if (details.some(item => item.result === 'Unknown')) return response('Unknown', 'Some selected elements need further checks.', { details });
  return response('Pass', passMessages[check.type], { details });
}
