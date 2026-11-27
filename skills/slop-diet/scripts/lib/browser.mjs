// Shared browser launcher for capture-ui.mjs and probe-dots.mjs.
// Order: Playwright (if importable and its browser launches), then headless
// Google Chrome / Chromium over the DevTools protocol, then nothing.
// SLOP_NO_CHROME=1 turns both off (used to test the no-browser path).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

export function loadPlaywright() {
  if (process.env.SLOP_NO_CHROME) return null;
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const names = [process.env.UI_CRAFT_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean);
  for (const name of names) {
    try { return require(name); } catch { /* try the next name */ }
  }
  return null;
}

export function findChrome() {
  if (process.env.SLOP_NO_CHROME) return null;
  const fixed = [
    process.env.UI_CRAFT_CHROMIUM,
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const path of fixed) if (existsSync(path)) return path;
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
      const path = join(dir, name);
      if (dir && existsSync(path)) return path;
    }
  }
  return null;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function launchChrome(chromePath, timeout) {
  const profile = await mkdtemp(join(tmpdir(), 'slop-chrome-'));
  const proc = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  const cleanup = async () => { try { proc.kill(); } catch { /* already gone */ } await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  try {
    const wsUrl = await withTimeout(new Promise((res, rej) => {
      let buf = '';
      proc.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res(m[1]); });
      proc.on('error', rej);
      proc.on('exit', () => rej(new Error('Chrome exited before it was ready')));
    }), timeout, 'Chrome start');
    const ws = new WebSocket(wsUrl);
    await withTimeout(new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools connection failed')); }), timeout, 'DevTools connect');
    let nextId = 0;
    const pending = new Map();
    const listeners = new Set();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      } else if (msg.method) for (const fn of listeners) fn(msg);
    };
    const failAll = (reason) => { for (const { rej } of pending.values()) rej(new Error(reason)); pending.clear(); };
    ws.onclose = () => failAll('DevTools connection closed');
    ws.onerror = () => failAll('DevTools connection failed');
    const send = (method, params = {}, sessionId) => withTimeout(new Promise((res, rej) => {
      const id = ++nextId;
      pending.set(id, { res, rej });
      try { ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (error) { pending.delete(id); rej(error); }
    }), timeout, `DevTools command ${method}`);

    const newPage = async (viewport, opts = {}) => {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const cmd = (method, params) => send(method, params, sessionId);
      await cmd('Page.enable');
      const phone = viewport.width <= 480;
      await cmd('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: phone ? (viewport.width <= 340 ? 2 : 3) : 1, mobile: phone });
      if (phone) await cmd('Emulation.setTouchEmulationEnabled', { enabled: true }).catch(() => {});
      if (opts.noScript) await cmd('Emulation.setScriptExecutionDisabled', { value: true });
      if (opts.reducedMotion) await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: opts.reducedMotion }] });
      let currentUrl = 'about:blank';
      const errors = [];
      if (opts.collectErrors) {
        await cmd('Runtime.enable');
        await cmd('Log.enable');
        await cmd('Network.enable');
        const requestUrls = new Map();
        listeners.add((msg) => {
          if (msg.sessionId !== sessionId) return;
          const p = msg.params || {};
          if (msg.method === 'Network.requestWillBeSent') requestUrls.set(p.requestId, p.request?.url || '');
          else if (msg.method === 'Network.loadingFailed') {
            // errorText is a net error code, never the URL, so look the URL up by requestId.
            const url = requestUrls.get(p.requestId) || '';
            if (!p.canceled && !/favicon/i.test(url)) errors.push(`request failed: ${p.errorText || 'unknown'} ${url.slice(0, 80)}`.trim());
          }
          else if (msg.method === 'Runtime.exceptionThrown') errors.push(`exception: ${p.exceptionDetails?.exception?.description?.split('\n')[0] || p.exceptionDetails?.text}`);
          else if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') errors.push(`console.error: ${(p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 120)}`);
          else if (msg.method === 'Log.entryAdded' && p.entry?.level === 'error') errors.push(`${p.entry.source}: ${String(p.entry.text).slice(0, 80)} ${p.entry.url || ''}`.trim());
        });
      }
      return {
        url: () => currentUrl,
        errors,
        cdp: cmd,
        async goto(url) {
          const loaded = new Promise((res) => {
            const fn = (msg) => { if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') { listeners.delete(fn); res(); } };
            listeners.add(fn);
          });
          const nav = await cmd('Page.navigate', { url });
          if (nav.errorText) throw new Error(`Navigation failed: ${nav.errorText}`);
          await withTimeout(loaded, timeout, 'Page load');
          currentUrl = url;
        },
        async evaluate(fn, arg) {
          const out = await cmd('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg)})`, returnByValue: true, awaitPromise: true });
          if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
          return out.result.value;
        },
        wait: (ms) => new Promise((res) => setTimeout(res, ms)),
        async screenshot(path, fullPage) {
          const params = { format: 'png' };
          if (fullPage) {
            const m = await cmd('Page.getLayoutMetrics');
            const box = m.cssContentSize || m.contentSize;
            Object.assign(params, { captureBeyondViewport: true, clip: { x: 0, y: 0, width: box.width, height: box.height, scale: 1 } });
          }
          const { data } = await cmd('Page.captureScreenshot', params);
          await writeFile(path, Buffer.from(data, 'base64'));
        },
        async close() { await send('Target.closeTarget', { targetId }).catch(() => {}); },
      };
    };
    return {
      newPage,
      async close() { try { await send('Browser.close'); } catch { /* closing */ } try { ws.close(); } catch { /* closed */ } await cleanup(); },
    };
  } catch (error) { await cleanup(); throw error; }
}

function playwrightAdapter(browser) {
  return {
    async newPage(viewport, opts = {}) {
      const phone = viewport.width <= 480;
      const page = await browser.newPage({
        viewport,
        ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: viewport.width <= 340 ? 2 : 3 } : {}),
        ...(opts.reducedMotion ? { reducedMotion: opts.reducedMotion } : {}),
      });
      const errors = [];
      if (opts.collectErrors) {
        page.on('pageerror', (e) => errors.push(`exception: ${String(e.message).split('\n')[0]}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 120)}`); });
        page.on('requestfailed', (r) => { const t = r.failure()?.errorText || 'unknown'; if (!/favicon/i.test(r.url()) && !/ABORTED/i.test(t)) errors.push(`request failed: ${t} ${r.url().slice(0, 80)}`); });
      }
      let cdpSession = null;
      if (opts.noScript) { cdpSession = await page.context().newCDPSession(page); await cdpSession.send('Emulation.setScriptExecutionDisabled', { value: true }); }
      return {
        url: () => page.url(),
        errors,
        cdp: async (method, params) => { cdpSession ||= await page.context().newCDPSession(page); return cdpSession.send(method, params); },
        goto: (url) => page.goto(url, { waitUntil: 'load' }),
        evaluate: (fn, arg) => page.evaluate(fn, arg),
        wait: (ms) => page.waitForTimeout(ms),
        screenshot: (path, fullPage) => page.screenshot({ path, fullPage, animations: 'allow', caret: 'initial' }),
        close: () => page.close(),
      };
    },
    close: () => browser.close(),
  };
}

// Returns { kind: 'playwright' | 'chrome', playwright?, browser, newPage, close } or { kind: null, reason } when no browser is installed.
// Throws when Chrome is installed but fails to start: that is an error (exit 2), never a skipped check.
export async function openBrowser({ timeout = 30000 } = {}) {
  if (process.env.SLOP_NO_CHROME) return { kind: null, reason: 'SLOP_NO_CHROME is set' };
  const playwright = loadPlaywright();
  if (playwright) {
    try {
      const browser = await playwright.chromium.launch({ headless: true, timeout,
        ...(process.env.UI_CRAFT_CHROMIUM ? { executablePath: process.env.UI_CRAFT_CHROMIUM } : {}) });
      return { kind: 'playwright', playwright, browser, ...playwrightAdapter(browser) };
    } catch { /* Playwright found but no browser for it: try Chrome */ }
  }
  const chromePath = findChrome();
  if (chromePath) {
    try {
      const browser = await launchChrome(chromePath, timeout);
      return { kind: 'chrome', browser, ...browser };
    } catch (error) { throw new Error(`browser found at ${chromePath} but it did not start (${error.message})`); }
  }
  return { kind: null, reason: 'Playwright and Google Chrome were not found' };
}

export const noBrowserNotice = (tool, reason) =>
  `NOTICE: ${tool} did not run because no browser is available (${reason}). Install Playwright or Google Chrome, or check the page by eye in a screenshot.`;
