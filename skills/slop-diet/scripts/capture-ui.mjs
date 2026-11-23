#!/usr/bin/env node
import { noBrowserNotice, openBrowser } from './lib/browser.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const help = `Usage: node capture-ui.mjs <URL|file.html> [options]

Capture the supplied HTTP or HTTPS page, or a local HTML file (opened as file://).
Browser order: Playwright when importable (set UI_CRAFT_PLAYWRIGHT to a module path when
necessary), else headless Google Chrome or Chromium. With neither, the script prints one line
starting NOTICE: and exits 0. SLOP_NO_CHROME=1 forces that path. It does not install dependencies.
Chrome mode saves the same PNGs and the same inspection results. It records console errors,
page exceptions and failed requests in consoleErrors and pageErrors (it has no httpErrors list).

Options:
  --out DIRECTORY       Output directory. Default: ui-capture
  --viewports SIZES     Comma-separated WIDTHxHEIGHT values.
                        Default: 390x844,1440x900
  --wait-for SELECTOR   Wait for a visible element before each capture.
  --timeout MS          Timeout for each operation. Default: 30000
  --help                Show this help.

Capture each viewport with normal motion preferences.
Also capture the first viewport with reduced motion preferences.
Save viewport PNGs, full-page PNGs, and observations.json.
Diagnostics describe observations, not accessibility or quality verdicts.
Still captures do not test interaction or motion behavior.
The script does not click controls, submit forms, or follow links.

Exit 0: captures saved, or no browser (one NOTICE line), or --help.
Exit 1: a capture failed (read captureFailures in observations.json).
Exit 2: bad arguments (unknown option, missing value, no URL or file).
`;

function parse(args) {
  const options = { out: 'ui-capture', timeout: 30000,
    viewports: [{ width: 390, height: 844 }, { width: 1440, height: 900 }] };
  const flags = new Set(['--out', '--viewports', '--wait-for', '--timeout']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') {
      if (args.length !== 1) throw new Error('Use --help without other arguments.');
      return null;
    }
    if (flags.has(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Provide a value for ${arg}.`);
      if (arg === '--out') options.out = value;
      if (arg === '--wait-for') options.waitFor = value;
      if (arg === '--timeout') {
        if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647)
          throw new Error('Use a timeout from 1 to 2147483647 milliseconds.');
        options.timeout = Number(value);
      }
      if (arg === '--viewports') {
        options.viewports = value.split(',').map(size => {
          const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(size);
          if (!match || match.slice(1).some(n => Number(n) > 16384))
            throw new Error('Use WIDTHxHEIGHT values from 1 to 16384, separated by commas.');
          return { width: Number(match[1]), height: Number(match[2]) };
        });
      }
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}.`);
    } else {
      if (options.url) throw new Error('Provide exactly one URL.');
      options.url = arg;
    }
  }
  if (!options.url) throw new Error('Provide an HTTP or HTTPS URL, or a local HTML file.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(options.url) && existsSync(options.url)) options.url = pathToFileURL(resolve(options.url)).href;
  let url;
  try { url = new URL(options.url); } catch { throw new Error('Provide a valid HTTP or HTTPS URL, or a local HTML file.'); }
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS URL, or a local HTML file.');
  options.url = url.href;
  return options;
}

function message(error) { return error instanceof Error ? error.message : String(error); }

async function inspect(page) {
  return page.evaluate(() => {
    const finite = value => typeof value === 'number' && !Number.isFinite(value) ? String(value) : value;
    const root = document.documentElement;
    return {
      horizontalOverflow: {
        viewportWidth: innerWidth,
        scrollWidth: root.scrollWidth,
        pixels: Math.max(0, root.scrollWidth - innerWidth),
      },
      brokenLoadedImages: [...document.images]
        .filter(img => (img.currentSrc || img.getAttribute('src')) && img.complete && img.naturalWidth === 0)
        .map(img => ({ src: img.currentSrc || img.getAttribute('src'), alt: img.alt })),
      runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running')
        .map(animation => {
          const timing = animation.effect?.getComputedTiming();
          const element = animation.effect?.target;
          return {
            name: animation.animationName || animation.transitionProperty || animation.id || null,
            type: animation.constructor.name,
            target: element instanceof Element ? { tag: element.tagName, id: element.id,
              class: element.getAttribute('class') } : null,
            currentTime: finite(animation.currentTime),
            duration: finite(timing?.duration),
            iterations: finite(timing?.iterations),
            progress: timing?.progress,
          };
        }),
    };
  });
}

async function capture(browser, options, viewport, reducedMotion, index) {
  const result = { url: options.url, viewport, motionMode: reducedMotion,
    startedAt: new Date().toISOString(), consoleErrors: [], pageErrors: [], failedRequests: [],
    httpErrors: [], captureFailures: [], screenshots: {} };
  let context;
  let page;
  try {
    context = await browser.newContext({ viewport, reducedMotion });
    context.setDefaultTimeout(options.timeout);
    context.setDefaultNavigationTimeout(options.timeout);
    page = await context.newPage();
    page.on('console', event => {
      if (event.type() === 'error') result.consoleErrors.push({ text: event.text(), location: event.location() });
    });
    page.on('pageerror', error => result.pageErrors.push(message(error)));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(),
      method: request.method(), resourceType: request.resourceType(), error: request.failure()?.errorText }));
    page.on('response', response => {
      if (response.status() >= 400) result.httpErrors.push({ url: response.url(), status: response.status() });
    });
    await page.goto(options.url, { waitUntil: 'load' });
    if (options.waitFor) await page.locator(options.waitFor).first().waitFor({ state: 'visible' });
    result.finalUrl = page.url();
    const stem = `${index + 1}-${viewport.width}x${viewport.height}-${reducedMotion}`;
    for (const [kind, fullPage] of [['viewport', false], ['full-page', true]]) {
      const filename = `${stem}-${kind}.png`;
      try {
        await page.screenshot({ path: resolve(options.out, filename), fullPage,
          animations: 'allow', caret: 'initial', timeout: options.timeout });
        result.screenshots[kind] = filename;
      } catch (error) { result.captureFailures.push({ stage: kind, detail: message(error) }); }
    }
  } catch (error) { result.captureFailures.push({ stage: 'page', detail: message(error) }); }
  finally {
    if (page && !page.isClosed()) {
      try { Object.assign(result, await inspect(page)); }
      catch (error) { result.captureFailures.push({ stage: 'diagnostics', detail: message(error) }); }
    }
    if (context) {
      try { await context.close(); }
      catch (error) { result.captureFailures.push({ stage: 'close-context', detail: message(error) }); }
    }
    result.capturedAt = new Date().toISOString();
  }
  return result;
}

async function captureChrome(session, options, viewport, reducedMotion, index) {
  const result = { url: options.url, viewport, motionMode: reducedMotion, browser: 'chrome',
    startedAt: new Date().toISOString(), consoleErrors: [], pageErrors: [], failedRequests: [],
    httpErrors: [], captureFailures: [], screenshots: {} };
  let page;
  try {
    page = await session.newPage(viewport, { reducedMotion: reducedMotion === 'reduce' ? 'reduce' : 'no-preference', collectErrors: true });
    await page.goto(options.url);
    if (options.waitFor) {
      const sel = JSON.stringify(options.waitFor);
      const visible = new Function(`const el = document.querySelector(${sel}); return !!el && el.getClientRects().length > 0;`);
      const until = Date.now() + options.timeout;
      while (!(await page.evaluate(visible))) {
        if (Date.now() > until) throw new Error(`Timed out waiting for ${options.waitFor}`);
        await page.wait(100);
      }
    }
    result.finalUrl = page.url();
    const stem = `${index + 1}-${viewport.width}x${viewport.height}-${reducedMotion}`;
    for (const [kind, fullPage] of [['viewport', false], ['full-page', true]]) {
      const filename = `${stem}-${kind}.png`;
      try { await page.screenshot(resolve(options.out, filename), fullPage); result.screenshots[kind] = filename; }
      catch (error) { result.captureFailures.push({ stage: kind, detail: message(error) }); }
    }
    try { Object.assign(result, await inspect(page)); }
    catch (error) { result.captureFailures.push({ stage: 'diagnostics', detail: message(error) }); }
    for (const text of page.errors || []) (/^request failed/.test(text) ? result.failedRequests : /^(exception|uncaught)/i.test(text) ? result.pageErrors : result.consoleErrors).push(/^request failed/.test(text) ? { error: text } : { text });
  } catch (error) { result.captureFailures.push({ stage: 'page', detail: message(error) }); }
  finally { if (page) await page.close(); result.capturedAt = new Date().toISOString(); }
  return result;
}

async function main() {
  let options;
  try { options = parse(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${message(error)}\nRun with --help for usage.\n`); process.exitCode = 2; return; }
  if (!options) { process.stdout.write(help); return; }
  options.out = resolve(options.out);
  const report = { url: options.url, startedAt: new Date().toISOString(),
    note: 'Diagnostics are observations. Still captures do not test interaction, motion behavior, accessibility, or quality.',
    options: { viewports: options.viewports, waitFor: options.waitFor ?? null, timeout: options.timeout },
    captures: [], captureFailures: [] };
  let browser;
  let session;
  try {
    session = await openBrowser({ timeout: options.timeout });
    if (!session.kind) {
      // No browser: print one NOTICE line and write nothing (no output directory, no observations.json).
      process.stdout.write(`${noBrowserNotice('capture-ui', session.reason)}\n`);
      return;
    }
    await mkdir(options.out, { recursive: true });
    browser = session.browser;
    report.browser = session.kind;
    if (session.kind === 'playwright') {
      for (const [index, viewport] of options.viewports.entries())
        report.captures.push(await capture(browser, options, viewport, 'no-preference', index));
      report.captures.push(await capture(browser, options, options.viewports[0], 'reduce', options.viewports.length));
    } else {
      for (const [index, viewport] of options.viewports.entries())
        report.captures.push(await captureChrome(session, options, viewport, 'no-preference', index));
      report.captures.push(await captureChrome(session, options, options.viewports[0], 'reduce', options.viewports.length));
    }
  } catch (error) {
    report.captureFailures.push({ stage: 'setup', detail: message(error) });
  } finally {
    if (session?.close) {
      try { await session.close(); }
      catch (error) { report.captureFailures.push({ stage: 'close-browser', detail: message(error) }); }
    }
    if (session?.kind || report.captureFailures.length) {
      report.completedAt = new Date().toISOString();
      await mkdir(options.out, { recursive: true });
      await writeFile(resolve(options.out, 'observations.json'), `${JSON.stringify(report, null, 2)}\n`);
    }
  }
  if (!session?.kind && !report.captureFailures.length) return;
  const failed = report.captureFailures.some(item => !item.notice) || report.captures.some(item => item.captureFailures.length);
  process.stdout.write(`Saved observations to ${resolve(options.out, 'observations.json')}\n`);
  if (failed) {
    process.stderr.write('Capture failed. Read captureFailures in observations.json.\n');
    process.exitCode = 1;
  }
}

main().catch(error => { process.stderr.write(`${message(error)}\n`); process.exitCode = 1; });
