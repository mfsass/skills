import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { commonProbe } from './common-probes.mjs';

const selectorTypes = new Set(['visible', 'text', 'count', 'style', 'box', 'targets', 'contrast', 'text-fit', 'control-names', 'row-harmony']);
const types = new Set([...selectorTypes, 'no-overflow', 'no-errors', 'images', 'duplicate-ids', 'axe']);
const dimensions = ['minWidth', 'minHeight', 'maxWidth', 'maxHeight'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const number = value => typeof value === 'number' && Number.isFinite(value);
const owns = (value, key) => Object.hasOwn(value, key);

export function validateProbe(check) {
  if (!check || typeof check !== 'object' || Array.isArray(check)) return ['Provide a probe object.'];
  const errors = [];
  if (!types.has(check.type)) return ['Use a supported passive probe type.'];
  if (selectorTypes.has(check.type) && !nonempty(check.selector)) errors.push('Provide a nonempty selector.');
  if (check.type === 'visible' && owns(check, 'visible') && typeof check.visible !== 'boolean')
    errors.push('The visible field must be a boolean.');
  if (check.type === 'text') {
    if (owns(check, 'contains') === owns(check, 'equals')) errors.push('Provide either contains or equals for text.');
    for (const field of ['contains', 'equals'])
      if (owns(check, field) && typeof check[field] !== 'string') errors.push(`The ${field} field must be a string.`);
  }
  if (check.type === 'count' && (!Number.isSafeInteger(check.equals) || check.equals < 0))
    errors.push('Count equals must be a nonnegative integer.');
  if (check.type === 'style') {
    if (!nonempty(check.property)) errors.push('Provide a nonempty CSS property name.');
    if (typeof check.equals !== 'string') errors.push('Style equals must be a string.');
  }
  if (['box', 'targets'].includes(check.type)) {
    if (check.type === 'box' && !dimensions.some(field => owns(check, field)))
      errors.push('Provide at least one box dimension limit.');
    for (const field of dimensions) {
      if (check.type === 'targets' && field.startsWith('min') && !owns(check, field))
        errors.push(`Provide ${field} for targets.`);
      if (owns(check, field) && (!number(check[field]) || check[field] < 0))
        errors.push(`${field} must be a finite nonnegative number.`);
    }
    if (check.type === 'targets' && owns(check, 'exclude') && !nonempty(check.exclude))
      errors.push('Provide a nonempty exclude selector.');
  }
  if (['text-fit', 'control-names', 'contrast', 'row-harmony'].includes(check.type)) {
    if (owns(check, 'exclude') && !nonempty(check.exclude)) errors.push('Provide a nonempty exclude selector.');
    if (owns(check, 'maxTargets') && (!Number.isSafeInteger(check.maxTargets) || check.maxTargets < 1))
      errors.push('The maxTargets field must be a positive integer.');
  }
  if (check.type === 'row-harmony') {
    if (owns(check, 'itemSelector') && !nonempty(check.itemSelector)) errors.push('Provide a nonempty itemSelector.');
    if (owns(check, 'heightTolerance') && (!number(check.heightTolerance) || check.heightTolerance < 0))
      errors.push('The heightTolerance field must be a finite nonnegative number.');
    if (owns(check, 'checkBorder') && typeof check.checkBorder !== 'boolean')
      errors.push('The checkBorder field must be a boolean.');
    if (owns(check, 'forbidOrphanWrap') && typeof check.forbidOrphanWrap !== 'boolean')
      errors.push('The forbidOrphanWrap field must be a boolean.');
  }
  if (check.type === 'text-fit' && owns(check, 'tolerance') && (!number(check.tolerance) || check.tolerance < 0))
    errors.push('Text tolerance must be a finite nonnegative number.');
  if (check.type === 'contrast') {
    if (owns(check, 'state') && !['normal', 'hover'].includes(check.state)) errors.push('Use normal or hover for state.');
    if (owns(check, 'hoverTarget') && !nonempty(check.hoverTarget)) errors.push('Provide a nonempty hoverTarget selector.');
    if (owns(check, 'settleMs') && (!number(check.settleMs) || check.settleMs < 0 || check.settleMs > 5000))
      errors.push('The settleMs field must be from zero to 5000.');
  }
  if (check.type === 'contrast' && (!number(check.minimum) || check.minimum <= 0))
    errors.push('Contrast minimum must be a positive finite number.');
  if (check.type === 'no-overflow' && owns(check, 'tolerance') && (!number(check.tolerance) || check.tolerance < 0))
    errors.push('Overflow tolerance must be a finite nonnegative number.');
  if (check.type === 'no-errors' && owns(check, 'sources') &&
      (!Array.isArray(check.sources) || !check.sources.length ||
        check.sources.some(source => !['console', 'page', 'request', 'http'].includes(source))))
    errors.push('Use console, page, request, or http sources in a nonempty array.');
  if (check.type === 'axe' && owns(check, 'tags') &&
      (!Array.isArray(check.tags) || check.tags.some(tag => !nonempty(tag))))
    errors.push('Axe tags must be an array of nonempty strings.');
  return errors;
}

const result = (state, message, extra = {}) => ({ result: state, message, ...extra });
const unknown = (message, extra) => result('Unknown', message, extra);
const outcome = (pass, message, extra) => result(pass ? 'Pass' : 'Fail', message, extra);

async function contrast(page, check, locator = page.locator(check.selector)) {
  const observations = await locator.evaluateAll(elements => {
    function rgb(value) {
      const match = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value);
      if (!match) return null;
      const channels = match.slice(1, 4).map(Number);
      const alpha = match[4] === undefined ? 1 : Number(match[4]);
      if (channels.some(n => n < 0 || n > 255) || alpha < 0 || alpha > 1) return null;
      return { channels, alpha };
    }
    function luminance(channels) {
      const linear = channels.map(value => {
        const s = value / 255;
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    }
    return elements.map((element, index) => {
      const unsupported = reason => ({ index, reason });
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!bounds.width || !bounds.height || ['hidden', 'collapse'].includes(style.visibility))
        return unsupported('The selected text is not visible.');
      if (!element.textContent.trim()) return unsupported('The selected element contains no text.');
      if ((style.webkitTextFillColor && style.webkitTextFillColor !== style.color) ||
          parseFloat(style.webkitTextStrokeWidth || '0') !== 0)
        return unsupported('Text fill or stroke needs a separate contrast measurement.');
      const foreground = rgb(style.color);
      if (!foreground || foreground.alpha !== 1) return unsupported('The text color is unsupported or translucent.');
      let background;
      let opaqueAncestor;
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const computed = getComputedStyle(ancestor);
        if (Number(computed.opacity) !== 1) return unsupported('Ancestor opacity changes the effective contrast.');
        if (computed.backgroundImage !== 'none') return unsupported('An image or gradient makes the background complex.');
        if (computed.filter !== 'none' || (computed.backdropFilter && computed.backdropFilter !== 'none') ||
            computed.mixBlendMode !== 'normal' || (computed.maskImage && computed.maskImage !== 'none') ||
            (computed.webkitMaskImage && computed.webkitMaskImage !== 'none')) return unsupported('A compositing effect makes the backdrop uncertain.');
        if (computed.textShadow !== 'none') return unsupported('A text shadow makes this contrast measurement unsupported.');
        for (const pseudo of ['::before', '::after']) {
          const p = getComputedStyle(ancestor, pseudo);
          if (p.content !== 'none' && p.content !== 'normal' && p.display !== 'none')
            return unsupported('Generated content makes the backdrop uncertain.');
        }
        const color = rgb(computed.backgroundColor);
        if (!color) return unsupported('The background color is unsupported.');
        if (!background && color.alpha > 0 && color.alpha < 1)
          return unsupported('A translucent background needs unsupported compositing.');
        if (!background && color.alpha === 1) { background = color.channels; opaqueAncestor = ancestor; }
      }
      if (!background) return unsupported('No opaque background establishes the canvas color.');
      if (style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text')
        return unsupported('Clipped text color is unsupported.');
      if ([...element.querySelectorAll('*')].some(child => {
        if (['::before', '::after'].some(pseudo => {
          const generated = getComputedStyle(child, pseudo);
          return generated.content !== 'none' && generated.content !== 'normal' && generated.display !== 'none';
        })) return true;
        if (!child.textContent.trim()) return false;
        const childStyle = getComputedStyle(child);
        const bg = rgb(childStyle.backgroundColor);
        return childStyle.color !== style.color || childStyle.opacity !== '1' || !bg || bg.alpha !== 0 ||
          childStyle.backgroundImage !== 'none' || childStyle.filter !== 'none' ||
          (childStyle.webkitTextFillColor && childStyle.webkitTextFillColor !== childStyle.color) ||
          parseFloat(childStyle.webkitTextStrokeWidth || '0') !== 0 || childStyle.textShadow !== 'none' ||
          (childStyle.backdropFilter && childStyle.backdropFilter !== 'none') || childStyle.mixBlendMode !== 'normal' ||
          (childStyle.maskImage && childStyle.maskImage !== 'none') ||
          (childStyle.webkitMaskImage && childStyle.webkitMaskImage !== 'none') ||
          childStyle.backgroundClip === 'text' || childStyle.webkitBackgroundClip === 'text';
      })) return unsupported('Descendant text needs a separate contrast measurement.');
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height || rect.bottom < 0 || rect.top >= innerHeight) continue;
        const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
        const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
        for (const layer of document.elementsFromPoint(x, y)) {
          if (layer === opaqueAncestor) break;
          if (!element.contains(layer) && !layer.contains(element))
            return unsupported('An overlapping element makes the backdrop uncertain.');
        }
      }
      const ink = luminance(foreground.channels);
      const ground = luminance(background);
      return { index, ratio: (Math.max(ink, ground) + .05) / (Math.min(ink, ground) + .05),
        foreground: foreground.channels, background };
    });
  });
  if (!observations.length) return unknown('The selector matches no element.');
  const measured = observations.filter(item => typeof item.ratio === 'number');
  const failed = measured.filter(item => item.ratio < check.minimum);
  const extra = { actual: measured.map(item => item.ratio), expected: check.minimum, details: observations };
  if (failed.length) return result('Fail', 'Measured text contrast is below the configured minimum.', extra);
  if (measured.length !== observations.length) return unknown('Some selected text has unsupported contrast conditions.', extra);
  return result('Pass', 'Measured text contrast meets the configured minimum.', extra);
}

async function hoverContrast(page, check, options) {
  const locator = page.locator(check.selector);
  const count = await locator.count();
  if (!count) return unknown('The selector matches no element.');
  const included = await locator.evaluateAll((elements, exclude) => elements
    .map((element, index) => {
      const rect = element.getBoundingClientRect();
      const visible = !!(rect.width && rect.height) && !['hidden', 'collapse'].includes(getComputedStyle(element).visibility);
      return { index, excluded: !visible || (!!exclude && !!element.closest(exclude)) };
    })
    .filter(item => !item.excluded).map(item => item.index), check.exclude);
  if (!included.length) return unknown('No included target matches the selector.');
  const cap = check.maxTargets ?? 100;
  const details = [];
  const captures = [];
  const previous = options.pointerPosition || await page.evaluate(() => {
    const elements = [...document.querySelectorAll(':hover')];
    const element = elements.at(-1);
    if (!element || ['HTML', 'BODY'].includes(element.tagName)) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  try {
    for (const index of included.slice(0, cap)) {
      const target = locator.nth(index);
      try {
        let hoverTarget = target;
        if (check.hoverTarget) {
          // Use the configured ancestor when it contains the selected text.
          const parents = await target.evaluate((element, selector) => {
            const match = element.closest(selector);
            return match ? [...document.querySelectorAll(selector)].indexOf(match) : -1;
          }, check.hoverTarget);
          if (parents >= 0) hoverTarget = page.locator(check.hoverTarget).nth(parents);
          else {
            const candidates = page.locator(check.hoverTarget);
            if (await candidates.count() !== 1) {
              details.push({ index, result: 'Unknown', message: 'The hover target is missing or ambiguous.' });
              continue;
            }
            hoverTarget = candidates;
          }
        }
        await hoverTarget.hover({ timeout: Math.min(options.timeout || 5000, 5000) });
        await page.waitForTimeout(check.settleMs ?? 200);
        const unsettled = () => target.evaluate(element => {
          const related = [element, ...element.querySelectorAll('*')];
          for (let parent = element.parentElement; parent; parent = parent.parentElement) related.push(parent);
          return related.some(node => node.getAnimations().some(animation => animation.playState === 'running' || animation.pending));
        });
        const deadline = Date.now() + 1000;
        let moving = await unsettled();
        while (moving && Date.now() < deadline) {
          await page.waitForTimeout(50);
          moving = await unsettled();
        }
        const measured = moving ? unknown('The hover state did not settle.') : await contrast(page, check, target);
        details.push({ index, ...measured });
        if (typeof options.capture === 'function') {
          const capture = await options.capture(`hover-${check.id || 'contrast'}-${index}`, { selector: check.selector, index, state: 'hovered' });
          if (capture !== undefined) captures.push(capture);
        }
      } catch (error) {
        details.push({ index, result: 'Unknown', message: 'The hover check could not complete.', error: String(error.message || error) });
      }
    }
  } finally {
    try { await page.mouse.move(previous?.x ?? -1, previous?.y ?? -1); } catch { /* The page can close during a check. */ }
  }
  if (included.length > cap) details.push({ result: 'Unknown', message: 'The target count exceeds the coverage cap.', cap, count: included.length });
  const extra = { details, captures, expected: check.minimum };
  if (details.some(item => item.result === 'Fail')) return result('Fail', 'Some measured hover contrast is below the configured minimum.', extra);
  if (details.some(item => item.result === 'Unknown')) return unknown('Some hover targets need further checks.', extra);
  return outcome(details.every(item => item.result === 'Pass'), 'The probe checked text contrast in the hover state.', extra);
}

async function axeProbe(page, check, options) {
  if (typeof options.resolveModule !== 'function') return unknown('No resolver is available for optional axe-core.');
  let axe;
  try {
    axe = await options.resolveModule('axe-core');
    if (typeof axe === 'string') axe = createRequire(resolve(options.configDir || process.cwd(), 'package.json'))(axe);
    axe = axe?.default || axe;
  } catch { return unknown('Optional axe-core could not load.'); }
  if (!nonempty(axe?.source)) return unknown('Optional axe-core does not provide an injectable source.');
  try {
    await page.evaluate(source => {
      // Evaluate the locally resolved tool, never a page-supplied script.
      (0, eval)(source);
    }, axe.source);
    const report = await page.evaluate(async tags => {
      if (!window.axe?.run) return null;
      const config = tags?.length ? { runOnly: { type: 'tag', values: tags } } : {};
      const data = await window.axe.run(document, config);
      return { violations: data.violations, incomplete: data.incomplete,
        passes: data.passes.length, inapplicable: data.inapplicable.length };
    }, check.tags);
    if (!report) return unknown('Axe did not expose its run function.');
    if (report.violations.length) return result('Fail', 'Axe reports violations within its configured checks.', { details: report });
    if (report.incomplete.length) return unknown('Axe reports checks that need further review.', { details: report });
    if (!report.passes) return unknown('Axe completed no passing applicable checks.', { details: report });
    return result('Pass', 'Axe reports no violations in its completed applicable checks.', { details: report });
  } catch (error) { return unknown('Axe could not complete its configured checks.', { details: { error: String(error.message || error) } }); }
}

async function observeProbe(page, check, log = {}, options = {}) {
  const errors = validateProbe(check);
  if (errors.length) return unknown('The probe configuration is invalid.', { details: errors });
  try {
    if (check.type === 'axe') return await axeProbe(page, check, options);
    if (['text-fit', 'control-names', 'row-harmony'].includes(check.type)) return await commonProbe(page, check);
    if (check.type === 'contrast') return check.state === 'hover'
      ? await hoverContrast(page, check, options) : await contrast(page, check);
    if (check.type === 'no-errors') {
      const keys = { console: 'consoleErrors', page: 'pageErrors', request: 'failedRequests', http: 'httpErrors' };
      const sources = check.sources || Object.keys(keys);
      if (sources.some(source => !Array.isArray(log[keys[source]]))) return unknown('A configured error log is unavailable.');
      const observed = Object.fromEntries(sources.map(source => [source, log[keys[source]]]));
      return outcome(Object.values(observed).every(items => items.length === 0),
        'The probe checked the selected error logs.', { details: observed });
    }
    if (check.type === 'no-overflow') {
      const actual = await page.evaluate(() => Math.max(0,
        document.documentElement.scrollWidth - innerWidth, (document.body?.scrollWidth || 0) - innerWidth));
      return outcome(actual <= (check.tolerance ?? 1), 'The probe measured horizontal overflow in CSS pixels.',
        { actual, expected: check.tolerance ?? 1 });
    }
    if (check.type === 'images') {
      const images = await page.evaluate(() => [...document.images].map(image => ({
        src: image.currentSrc || image.getAttribute('src'), complete: image.complete,
        broken: image.complete && image.naturalWidth === 0,
      })));
      if (images.some(image => image.broken)) return result('Fail', 'Some completed images are broken.', { details: images });
      if (images.some(image => !image.complete)) return unknown('Some images did not complete loading.', { details: images });
      return result('Pass', 'The probe found no broken completed images.', { details: images });
    }
    if (check.type === 'duplicate-ids') {
      const duplicates = await page.evaluate(() => {
        const counts = new Map();
        for (const node of document.querySelectorAll('[id]')) if (node.id.trim()) counts.set(node.id, (counts.get(node.id) || 0) + 1);
        return [...counts].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
      });
      return outcome(!duplicates.length, 'The probe checked nonempty document IDs for duplicates.', { details: duplicates });
    }
    const locator = page.locator(check.selector);
    const count = await locator.count();
    if (check.type === 'count') return outcome(count === check.equals, 'The probe counted matching elements.', { actual: count, expected: check.equals });
    if (!count) return check.type === 'visible' && check.visible === false
      ? result('Pass', 'The selector matches no visible element.', { actual: 0 }) : unknown('The selector matches no element.');
    const values = await locator.evaluateAll((elements, probe) => elements
      .filter(element => probe.type !== 'targets' || !probe.exclude || !element.closest(probe.exclude))
      .map(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { text: element.textContent.trim(), style: probe.property ? style.getPropertyValue(probe.property) : null,
          width: rect.width, height: rect.height,
          visible: !!(rect.width && rect.height) && !['hidden', 'collapse'].includes(style.visibility) };
      }), check);
    const selected = check.type === 'targets' ? values.filter(value => value.visible) : values;
    if (!selected.length) return unknown('No included visible target matches the selector.');
    let pass;
    if (check.type === 'visible') pass = selected.every(value => value.visible === (check.visible ?? true));
    if (check.type === 'text') pass = selected.every(value => owns(check, 'equals') ? value.text === check.equals : value.text.includes(check.contains));
    if (check.type === 'style') pass = selected.every(value => value.style === check.equals);
    if (['box', 'targets'].includes(check.type)) pass = selected.every(value => dimensions.every(field =>
      !owns(check, field) || (field.startsWith('min') ? value[field.endsWith('Width') ? 'width' : 'height'] >= check[field]
        : value[field.endsWith('Width') ? 'width' : 'height'] <= check[field])));
    return outcome(pass, 'The probe checked selected elements against the configured assertion.', { actual: selected, expected: check });
  } catch (error) {
    return unknown('The probe could not complete its observation.', { details: { error: String(error.message || error) } });
  }
}

export async function runProbe(page, check, log = {}, options = {}) {
  const timeout = number(options.timeout) && options.timeout > 0 ? options.timeout : 30000;
  let timer;
  try {
    return await Promise.race([
      observeProbe(page, check, log, options),
      new Promise(resolveTimeout => {
        timer = setTimeout(() => resolveTimeout(unknown('The probe exceeded its observation timeout.')), timeout);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
