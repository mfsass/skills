/* Configurable consistency scenario for scripts/ui-eval.mjs. */

export function stylesMatch(reference, candidate, properties, tolerance = {}) {
  return properties.every(property => {
    const a = reference[property];
    const b = candidate[property];
    if (a === undefined || b === undefined) return false;
    const allowed = tolerance[property];
    if (typeof allowed === 'number') {
      const left = String(a).match(/^(-?\d+(?:\.\d+)?)(.*)$/);
      const right = String(b).match(/^(-?\d+(?:\.\d+)?)(.*)$/);
      if (left && right && left[2] === right[2]) return Math.abs(Number(left[1]) - Number(right[1])) <= allowed;
    }
    return a === b;
  });
}

export function leftEdgesMatch(values, tolerance) {
  if (!Array.isArray(values) || values.length < 2 || !Number.isFinite(tolerance) || tolerance < 0) return false;
  const origin = values[0];
  return values.every(value => Number.isFinite(value) && Math.abs(value - origin) <= tolerance);
}

export function heightsMatch(values, tolerance) {
  if (!Array.isArray(values) || values.length < 2 || !Number.isFinite(tolerance) || tolerance < 0) return false;
  if (values.some(value => !Number.isFinite(value) || value <= 0)) return false;
  return Math.max(...values) - Math.min(...values) <= tolerance;
}

export function edgesMatch(values, tolerance) {
  if (!Array.isArray(values) || values.length < 2 || !Number.isFinite(tolerance) || tolerance < 0) return false;
  const origin = values[0];
  return values.every(value => Number.isFinite(value) && Math.abs(value - origin) <= tolerance);
}

export function hasVisibleBorder(style) {
  if (!style || typeof style !== 'object') return false;
  const read = (camel, kebab) => {
    if (typeof style.getPropertyValue === 'function') {
      const value = style.getPropertyValue(kebab);
      if (value) return value.trim();
    }
    const value = style[camel] ?? style[kebab];
    return typeof value === 'string' ? value.trim() : '';
  };
  const isTransparent = color => {
    if (!color) return false;
    const normalized = color.toLowerCase().replace(/\s+/g, '');
    if (normalized === 'transparent') return true;
    const rgba = /^rgba\(\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?,(\d*(?:\.\d+)?)\)$/.exec(normalized);
    if (rgba && Number(rgba[1]) === 0) return true;
    const slash = /^rgb\([^/]+\/(\d*(?:\.\d+)?)%?\)$/.exec(normalized);
    if (slash && Number(slash[1]) === 0) return true;
    return false;
  };
  const checkSide = (widthText, styleText, colorText) => {
    const width = parseFloat(widthText);
    if (!Number.isFinite(width) || width <= 0) return false;
    if (!styleText || styleText === 'none' || styleText === 'hidden') return false;
    if (isTransparent(colorText)) return false;
    return true;
  };
  const sides = [
    ['borderTopWidth', 'border-top-width', 'borderTopStyle', 'border-top-style', 'borderTopColor', 'border-top-color'],
    ['borderRightWidth', 'border-right-width', 'borderRightStyle', 'border-right-style', 'borderRightColor', 'border-right-color'],
    ['borderBottomWidth', 'border-bottom-width', 'borderBottomStyle', 'border-bottom-style', 'borderBottomColor', 'border-bottom-color'],
    ['borderLeftWidth', 'border-left-width', 'borderLeftStyle', 'border-left-style', 'borderLeftColor', 'border-left-color'],
  ];
  const hasSideProps = sides.some(([wc, wk, sc, sk]) => read(wc, wk) !== '' || read(sc, sk) !== '');
  if (hasSideProps) {
    return sides.some(([wc, wk, sc, sk, cc, ck]) => checkSide(read(wc, wk), read(sc, sk), read(cc, ck)));
  }
  return checkSide(read('borderWidth', 'border-width'), read('borderStyle', 'border-style'), read('borderColor', 'border-color'));
}

export function clusterVisualRows(rects, tolerance = 4) {
  if (!Array.isArray(rects) || !rects.length || !Number.isFinite(tolerance) || tolerance < 0) return [];
  const normalized = rects
    .map(rect => {
      if (!rect || typeof rect !== 'object') return null;
      const top = rect.top;
      const height = Number.isFinite(rect.height) ? rect.height : (Number.isFinite(rect.bottom) && Number.isFinite(top) ? rect.bottom - top : NaN);
      const bottom = Number.isFinite(rect.bottom) ? rect.bottom : top + height;
      const left = Number.isFinite(rect.left) ? rect.left : 0;
      if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0 || !Number.isFinite(bottom)) return null;
      return { rect, top, bottom, left, centerY: top + height / 2 };
    })
    .filter(Boolean)
    .sort((a, b) => (a.top - b.top) || (a.left - b.left));

  const clusters = [];
  for (const entry of normalized) {
    const match = clusters.find(cluster => {
      const overlap = Math.min(cluster.maxBottom, entry.bottom) - Math.max(cluster.minTop, entry.top);
      return overlap > 0 || Math.abs(entry.centerY - cluster.centerY) <= tolerance;
    });
    if (match) {
      match.entries.push(entry);
      match.minTop = Math.min(match.minTop, entry.top);
      match.maxBottom = Math.max(match.maxBottom, entry.bottom);
      match.centerY = match.entries.reduce((sum, item) => sum + item.centerY, 0) / match.entries.length;
    } else {
      clusters.push({ minTop: entry.top, maxBottom: entry.bottom, centerY: entry.centerY, entries: [entry] });
    }
  }
  return clusters.map(cluster => cluster.entries.sort((a, b) => a.left - b.left).map(entry => entry.rect));
}

export function hasOrphanWrap(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return false;
  if (!rows.some(row => Array.isArray(row) && row.length >= 2)) return false;
  const last = rows[rows.length - 1];
  return Array.isArray(last) && last.length === 1;
}

export function rectHasInsets(rect, container, insets, tolerance = 0) {
  if (!Number.isFinite(tolerance) || tolerance < 0) return false;
  const keys = Object.keys(insets);
  if (!keys.length || keys.some(key => !['left', 'right', 'top', 'bottom'].includes(key))) return false;
  return keys.every(key => {
    if (![rect[key], container[key], insets[key]].every(Number.isFinite) || insets[key] < 0) return false;
    const gap = key === 'right' || key === 'bottom' ? container[key] - rect[key] : rect[key] - container[key];
    return gap + tolerance >= insets[key];
  });
}

// Measure each selected node against its own closest matching ancestor when requested.
export function measureContainmentNodes({ selector, container, closest = false, viewport }) {
  const box = node => {
    if (!node) return null;
    const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : node;
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  };
  const nodes = [...document.querySelectorAll(selector)];
  if (container === 'viewport') {
    const bounds = viewport ?? { left: 0, right: innerWidth, top: 0, bottom: innerHeight, width: innerWidth, height: innerHeight };
    return nodes.map(node => ({ rect: box(node), container: box(bounds), reason: null }));
  }
  if (closest) return nodes.map(node => {
    const parent = typeof node.closest === 'function' ? node.closest(container) : null;
    return { rect: box(node), container: box(parent), reason: parent ? null : 'No matching closest container.' };
  });
  const parents = [...document.querySelectorAll(container)];
  const parent = parents.length === 1 ? box(parents[0]) : null;
  return nodes.map(node => ({ rect: box(node), container: parent, reason: parent ? null : 'Expected one matching container.' }));
}

const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// Edit these groups before a run. Empty groups report Unknown.
export const SCENARIO_CONFIG = {
  groups: {}
};

async function collect(page, selectors, properties, includeLeft = false) {
  return page.evaluate(({ selectors, properties, includeLeft }) => {
    const nodes = selectors.flatMap(selector => [...document.querySelectorAll(selector)]);
    return nodes.map(node => {
      const style = getComputedStyle(node);
      const values = Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property).trim()]));
      if (includeLeft) values.__left = node.getBoundingClientRect().left;
      return values;
    });
  }, { selectors, properties, includeLeft });
}

export async function runConsistencyChecks({ page, check, unknown, signal, config = {} }) {
  const groups = config.groups ?? {};
  const names = [
    'tokens',
    'repeatedComponents',
    'alignments',
    'containments',
    'controlRowHeights',
    'columnAlignments',
    'immediateToggleSemantics',
    'inlineMetadataRowHarmony',
    'actionBarButtonParity',
  ];
  if (!names.some(name => Object.hasOwn(groups, name))) {
    unknown('Configure the consistency groups needed for this task.', { denominator: 0 });
    return;
  }
  for (const name of names) {
    if (!Object.hasOwn(groups, name)) continue;
    if (signal?.aborted) return;
    const rules = Array.isArray(groups[name]) ? groups[name] : [];
    if (rules.length === 0) {
      unknown(`${name}: no configured checks.`, { group: name, denominator: 0 });
      continue;
    }
    for (const rule of rules) {
      const id = rule.id;
      if (!nonempty(id)) {
        unknown(`${name}: a rule has no ID.`, { group: name });
        continue;
      }
      if (name === 'tokens') {
        if (!nonempty(rule.selector) || !nonempty(rule.property) || !Array.isArray(rule.allowed) || !rule.allowed.length) {
          unknown(`${id}: configure a selector, property, and allowed values.`, { id, group: name });
          continue;
        }
        const rows = await collect(page, [rule.selector], [rule.property]);
        if (!rows.length) unknown(`${id}: no elements matched the selector.`, { id, selector: rule.selector });
        else check(rows.every(row => rule.allowed.includes(row[rule.property])), `${id}: computed values follow the approved token set.`, { id, selector: rule.selector, property: rule.property, allowed: rule.allowed, observed: rows.map(row => row[rule.property]) });
      } else if (name === 'repeatedComponents') {
        if (!nonempty(rule.selector) || !Array.isArray(rule.properties) || !rule.properties.length) {
          unknown(`${id}: configure a selector and computed properties.`, { id, group: name });
          continue;
        }
        const rows = await collect(page, [rule.selector], rule.properties);
        if (rows.length < 2) unknown(`${id}: the selector matched fewer than two instances.`, { id, selector: rule.selector, count: rows.length });
        else check(rows.slice(1).every(row => stylesMatch(rows[0], row, rule.properties, rule.tolerance ?? {})), `${id}: repeated instances use equivalent computed styles.`, { id, selector: rule.selector, properties: rule.properties, reference: rows[0], observed: rows.slice(1) });
      } else if (name === 'alignments') {
        if (!nonempty(rule.selector) || !Number.isFinite(rule.tolerance) || rule.tolerance < 0) {
          unknown(`${id}: configure a selector and a nonnegative CSS pixel tolerance.`, { id, group: name });
          continue;
        }
        const rows = await collect(page, [rule.selector], [], true);
        const edges = rows.map(row => row.__left);
        if (edges.length < 2) unknown(`${id}: the selector matched fewer than two elements.`, { id, selector: rule.selector, count: edges.length });
        else check(leftEdgesMatch(edges, rule.tolerance), `${id}: left edges fall within the declared tolerance.`, { id, selector: rule.selector, tolerance: rule.tolerance, leftEdges: edges });
      } else if (name === 'containments') {
        const insets = rule.insets;
        const tolerance = rule.tolerance ?? 0;
        if (!nonempty(rule.selector) || !nonempty(rule.container) || !insets || typeof insets !== 'object' ||
            Array.isArray(insets) || !Object.keys(insets).length ||
            Object.entries(insets).some(([key, value]) => !['left', 'right', 'top', 'bottom'].includes(key) || !Number.isFinite(value) || value < 0) ||
            !Number.isFinite(tolerance) || tolerance < 0) {
          unknown(`${id}: configure selectors, nonnegative insets, and tolerance.`, { id, group: name });
          continue;
        }
        const measured = await page.evaluate(measureContainmentNodes, { selector: rule.selector, container: rule.container, closest: rule.closest === true });
        const valid = item => item.rect && item.container && [item.rect, item.container].every(rect => rect.width > 0 && rect.height > 0);
        const results = measured.map(item => ({ ...item, result: valid(item) ? rectHasInsets(item.rect, item.container, insets, tolerance) : null }));
        const details = { id, selector: rule.selector, container: rule.container, closest: rule.closest === true, insets, tolerance, measured: results };
        if (!results.length) unknown(`${id}: no selected elements matched the selector.`, details);
        else if (results.some(item => item.result === false)) check(false, `${id}: content does not preserve the configured container insets.`, details);
        else if (results.some(item => item.result === null)) unknown(`${id}: selected elements need measurable boxes and matching containers.`, details);
        else check(true, `${id}: content preserves the configured container insets.`, details);
      } else if (name === 'controlRowHeights') {
        const tolerance = rule.tolerance ?? 2;
        if (!nonempty(rule.rowSelector) || !Number.isFinite(tolerance) || tolerance < 0) {
          unknown(`${id}: configure a rowSelector and nonnegative CSS pixel tolerance.`, { id, group: name });
          continue;
        }
        const controlSelector = nonempty(rule.controlSelector)
          ? rule.controlSelector
          : 'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), button, select, [role="combobox"], [role="radiogroup"]';
        const rows = await page.evaluate(({ rowSelector, controlSelector }) => {
          const labelOf = node => {
            const tag = node.tagName.toLowerCase();
            const clean = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
            if (tag === 'input') {
              return clean(node.getAttribute('aria-label') || node.labels?.[0]?.textContent || node.getAttribute('placeholder') || node.value || node.name) || tag;
            }
            if (tag === 'select') {
              return clean(node.getAttribute('aria-label') || node.labels?.[0]?.textContent || node.options?.[node.selectedIndex]?.text || node.name) || tag;
            }
            return clean(node.textContent || node.getAttribute('aria-label')) || tag;
          };
          return [...document.querySelectorAll(rowSelector)].map((row, rowIndex) => {
            const matched = [...row.querySelectorAll(controlSelector)].filter(node => {
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(node).visibility);
            });
            const matchedSet = new Set(matched);
            const topLevel = matched.filter(node => {
              for (let parent = node.parentElement; parent && parent !== row; parent = parent.parentElement) {
                if (matchedSet.has(parent)) return false;
              }
              return true;
            });
            const controls = topLevel.map(node => {
              const rect = node.getBoundingClientRect();
              return {
                tag: node.tagName.toLowerCase(),
                role: node.getAttribute('role'),
                label: labelOf(node),
                height: Math.round(rect.height * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
              };
            });
            return { rowIndex, controls };
          });
        }, { rowSelector: rule.rowSelector, controlSelector });
        const measurable = rows.filter(row => row.controls.length >= 2);
        if (!measurable.length) {
          unknown(`${id}: fewer than two visible controls matched inside rowSelector.`, { id, rowSelector: rule.rowSelector, rows });
        } else {
          const evaluated = measurable.map(row => {
            const heights = row.controls.map(item => item.height);
            const heightDelta = Math.round((Math.max(...heights) - Math.min(...heights)) * 10) / 10;
            const rowPassed = heightsMatch(heights, tolerance);
            return {
              ...row,
              heightDelta,
              passed: rowPassed,
              mismatched: rowPassed ? [] : row.controls.map(({ tag, role, label, height }) => ({ tag, role, label, height })),
            };
          });
          const passed = evaluated.every(row => row.passed);
          const mismatched = evaluated.flatMap(row => row.mismatched.map(item => ({ rowIndex: row.rowIndex, ...item })));
          const summary = mismatched.map(item => `${item.tag} "${item.label}" (${item.height}px)`).join(', ');
          const message = passed
            ? `${id}: sibling controls in each toolbar row match height within ${tolerance}px.`
            : `${id}: sibling controls in toolbar row differ in height beyond ${tolerance}px (${summary}).`;
          check(passed, message, { id, rowSelector: rule.rowSelector, tolerance, rows: evaluated, mismatched });
        }
      } else if (name === 'columnAlignments') {
        const edge = rule.edge === 'right' ? 'right' : 'left';
        const tolerance = rule.tolerance ?? 2;
        if (!nonempty(rule.selector) || !Number.isFinite(tolerance) || tolerance < 0) {
          unknown(`${id}: configure a selector and nonnegative tolerance.`, { id, group: name });
          continue;
        }
        const edges = await page.evaluate(({ selector, edge }) => {
          return [...document.querySelectorAll(selector)]
            .map(node => node.getBoundingClientRect())
            .filter(rect => rect.width > 0 && rect.height > 0)
            .map(rect => Math.round(rect[edge] * 10) / 10);
        }, { selector: rule.selector, edge });
        if (edges.length < 2) unknown(`${id}: fewer than two visible elements matched the selector.`, { id, selector: rule.selector, edge, edges });
        else check(edgesMatch(edges, tolerance), `${id}: repeated column ${edge} edges align within ${tolerance}px.`, { id, selector: rule.selector, edge, tolerance, edges });
      } else if (name === 'immediateToggleSemantics') {
        if (!nonempty(rule.toolbarSelector)) {
          unknown(`${id}: configure a toolbarSelector for immediate-effect filter bars.`, { id, group: name });
          continue;
        }
        const offenders = await page.evaluate(({ toolbarSelector }) => {
          const bars = [...document.querySelectorAll(toolbarSelector)];
          if (!bars.length) return null;
          return bars.flatMap((bar, barIndex) =>
            [...bar.querySelectorAll('input[type="checkbox"]')]
              .filter(input => input.getAttribute('role') !== 'switch' && !input.closest('[role="switch"]'))
              .map(input => ({
                barIndex,
                label: input.getAttribute('aria-label') || input.labels?.[0]?.textContent?.trim() || input.name || 'checkbox',
              }))
          );
        }, { toolbarSelector: rule.toolbarSelector });
        if (offenders === null) {
          unknown(`${id}: toolbarSelector matched no element, so nothing was checked.`, { id, toolbarSelector: rule.toolbarSelector });
          continue;
        }
        check(offenders.length === 0, `${id}: immediate-effect filter toolbars use switches rather than form checkboxes.`, { id, toolbarSelector: rule.toolbarSelector, offenders });
      } else if (name === 'inlineMetadataRowHarmony') {
        const heightTolerance = rule.heightTolerance ?? 2;
        const centerTolerance = rule.centerTolerance ?? 2;
        const requireConsistentBorder = rule.requireConsistentBorder ?? true;
        if (!nonempty(rule.rowSelector) || !Number.isFinite(heightTolerance) || heightTolerance < 0 || !Number.isFinite(centerTolerance) || centerTolerance < 0) {
          unknown(`${id}: configure a rowSelector and nonnegative tolerances.`, { id, group: name });
          continue;
        }
        const itemSelector = nonempty(rule.itemSelector) ? rule.itemSelector : ':scope > *';
        const rows = await page.evaluate(({ rowSelector, itemSelector }) => {
          return [...document.querySelectorAll(rowSelector)].map((row, rowIndex) => {
            const items = [...row.querySelectorAll(itemSelector)]
              .map(node => {
                const rect = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                if (!rect.width || !rect.height || ['hidden', 'collapse'].includes(style.visibility)) return null;
                return {
                  text: node.textContent?.trim().slice(0, 40) || node.tagName.toLowerCase(),
                  left: Math.round(rect.left * 10) / 10,
                  top: Math.round(rect.top * 10) / 10,
                  bottom: Math.round(rect.bottom * 10) / 10,
                  width: Math.round(rect.width * 10) / 10,
                  height: Math.round(rect.height * 10) / 10,
                  centerY: Math.round((rect.top + rect.height / 2) * 10) / 10,
                  border: {
                    borderTopWidth: style.borderTopWidth,
                    borderTopStyle: style.borderTopStyle,
                    borderTopColor: style.borderTopColor,
                    borderRightWidth: style.borderRightWidth,
                    borderRightStyle: style.borderRightStyle,
                    borderRightColor: style.borderRightColor,
                    borderBottomWidth: style.borderBottomWidth,
                    borderBottomStyle: style.borderBottomStyle,
                    borderBottomColor: style.borderBottomColor,
                    borderLeftWidth: style.borderLeftWidth,
                    borderLeftStyle: style.borderLeftStyle,
                    borderLeftColor: style.borderLeftColor,
                  },
                };
              })
              .filter(Boolean);
            return { rowIndex, items };
          });
        }, { rowSelector: rule.rowSelector, itemSelector });
        const measurable = rows.filter(row => row.items.length >= 2).map(row => {
          const items = row.items.map(item => ({ ...item, hasBorder: hasVisibleBorder(item.border) }));
          const visualRows = clusterVisualRows(items);
          const heightOk = heightsMatch(items.map(item => item.height), heightTolerance);
          const centerOk = visualRows.every(vRow => vRow.length < 2 || edgesMatch(vRow.map(item => item.centerY), centerTolerance));
          const borderOk = !requireConsistentBorder || items.every(item => item.hasBorder === items[0].hasBorder);
          return { rowIndex: row.rowIndex, heightOk, centerOk, borderOk, items };
        });
        if (!measurable.length) {
          unknown(`${id}: fewer than two visible items matched inside rowSelector.`, { id, rowSelector: rule.rowSelector, rows });
        } else {
          const passed = measurable.every(row => row.heightOk && row.centerOk && row.borderOk);
          check(passed, `${id}: inline metadata pills share height, vertical centerline, and border grammar.`, {
            id,
            rowSelector: rule.rowSelector,
            heightTolerance,
            centerTolerance,
            requireConsistentBorder,
            rows: measurable,
          });
        }
      } else if (name === 'actionBarButtonParity') {
        const heightTolerance = rule.heightTolerance ?? 2;
        const forbidOrphanWrap = rule.forbidOrphanWrap ?? true;
        if (!nonempty(rule.rowSelector) || !Number.isFinite(heightTolerance) || heightTolerance < 0) {
          unknown(`${id}: configure a rowSelector and nonnegative heightTolerance.`, { id, group: name });
          continue;
        }
        const buttonSelector = nonempty(rule.buttonSelector)
          ? rule.buttonSelector
          : 'button, a[role="button"], [role="button"]';
        const rows = await page.evaluate(({ rowSelector, buttonSelector }) => {
          return [...document.querySelectorAll(rowSelector)].map((row, rowIndex) => {
            const buttons = [...row.querySelectorAll(buttonSelector)]
              .map(node => {
                const rect = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                if (!rect.width || !rect.height || ['hidden', 'collapse'].includes(style.visibility)) return null;
                return {
                  text: node.textContent?.trim().slice(0, 40) || node.tagName.toLowerCase(),
                  left: Math.round(rect.left * 10) / 10,
                  top: Math.round(rect.top * 10) / 10,
                  bottom: Math.round(rect.bottom * 10) / 10,
                  width: Math.round(rect.width * 10) / 10,
                  height: Math.round(rect.height * 10) / 10,
                };
              })
              .filter(Boolean);
            return { rowIndex, buttons };
          });
        }, { rowSelector: rule.rowSelector, buttonSelector });
        const measurable = rows.filter(row => row.buttons.length >= 2).map(row => {
          const visualRows = clusterVisualRows(row.buttons);
          const heightOk = heightsMatch(row.buttons.map(button => button.height), heightTolerance);
          const orphanWrap = hasOrphanWrap(visualRows);
          const wrapOk = !forbidOrphanWrap || !orphanWrap;
          return {
            rowIndex: row.rowIndex,
            heightOk,
            wrapOk,
            orphanWrap,
            rowCounts: visualRows.map(vRow => vRow.length),
            buttons: row.buttons,
          };
        });
        if (!measurable.length) {
          unknown(`${id}: fewer than two visible buttons matched inside rowSelector.`, { id, rowSelector: rule.rowSelector, rows });
        } else {
          const passed = measurable.every(row => row.heightOk && row.wrapOk);
          check(passed, `${id}: sibling action-bar buttons share height within ${heightTolerance}px without orphan wraps.`, {
            id,
            rowSelector: rule.rowSelector,
            heightTolerance,
            forbidOrphanWrap,
            rows: measurable,
          });
        }
      }
    }
  }
}

// The runner supplies page, context, baseUrl, check, unknown, capture, and signal.
export async function consistencyScenario(args) {
  return runConsistencyChecks({ ...args, config: SCENARIO_CONFIG });
}
