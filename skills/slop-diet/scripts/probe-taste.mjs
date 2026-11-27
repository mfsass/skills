#!/usr/bin/env node
// Taste probes: design principles as browser checks that fill gaps
// verify.mjs and probe-dots.mjs leave open. Exit 0 pass, 1 fail, 2 incomplete (no browser, probe error, bad input).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { noBrowserNotice, openBrowser } from './lib/browser.mjs';
import { OVERRIDE_IDS, PROBES, runTasteProbes } from './lib/taste-probes.mjs';

const help = `Usage: node probe-taste.mjs <file.html|URL> [--only a,b] [--json] [--overrides craft-overrides.json]

Browser probes for taste rules no other script checks:
  hover-press          buttons, tabs, toggles and links change at :hover; buttons change again at :active (any visible style); tabs need a visible selected state
  transition-duration  no control takes longer than 400 ms to answer (an instant change is valid)
  segmented-transform  choosing another segment shows a clear selected state (any style; a sliding indicator is optional)
  decorative-dots      glyph dots (U+25CF and kin, circle emoji, coloured bullets), ring dots, gradient dots (filled dots: probe-dots.mjs)
  responsive-reflow    390 px re-flows against 1440 px (columns, order, visibility), not just a scaled copy
  select-chevron       a native select has appearance:none and a chevron 8 px or more from the right edge
  layout-stable        clicking a tab, toggle or select moves no sibling by more than 1.5 px
  worst-case-text      every control option preserves sibling boxes within 1px, and prices stay on one line
  accent-bar           no left or right border bar, inset-shadow bar or ::before bar of 2 px or more
worst-case-text checks at most 12 controls per viewport. Each viewport has a 6000 ms deadline.
Timeouts and control limits report WARN (incomplete). These warnings do not change the exit code.
Output: one summary line, then one line per probe, then one detail line per finding.
A probe finds nothing to check on the page: NA (not a fail). Skip a probe with its id in craft-overrides.json:
${PROBES.map((p) => `  ${OVERRIDE_IDS[p]}`).join('\n')}
Exit 0 when every probe that ran passed or had nothing to check. Exit 1 when one failed. Exit 2 when no browser is available,
a probe errored, or the input is bad: the run is not a pass.
`;

function loadOverrides(args, target) {
  const idx = args.indexOf('--overrides');
  const beside = target && !/^https?:\/\//.test(target) ? resolve(dirname(resolve(target)), 'craft-overrides.json') : null;
  const file = idx >= 0 ? args[idx + 1] : (beside && existsSync(beside) ? beside : existsSync('craft-overrides.json') ? 'craft-overrides.json' : null);
  if (!file) return {};
  if (!existsSync(file)) throw new Error(`Overrides file not found: ${file}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) { console.log(help); return 0; }
  const valueOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const skipIdx = new Set(['--only', '--overrides'].map((f) => args.indexOf(f) + 1).filter((i) => i > 0));
  const target = args.find((a, i) => !a.startsWith('--') && !skipIdx.has(i));
  const url = /^https?:\/\//.test(target || '') ? target : target && existsSync(target) ? pathToFileURL(resolve(target)).href : null;
  if (!url) { console.error(`Not a file or URL: ${target}`); return 2; }
  const onlyArg = valueOf('--only');
  const only = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : PROBES;
  const unknown = only.filter((p) => !PROBES.includes(p));
  if (unknown.length) { console.error(`Unknown probe: ${unknown.join(', ')} (known: ${PROBES.join(', ')})`); return 2; }
  let overrides;
  try { overrides = loadOverrides(args, target); } catch (error) { console.error(error.message); return 2; }
  const skip = PROBES.filter((p) => overrides[OVERRIDE_IDS[p]]);

  let session;
  try { session = await openBrowser(); } catch (error) { console.error(`ERROR: probe-taste could not start the browser: ${error.message}`); return 2; }
  if (!session.kind) { console.log(noBrowserNotice('probe-taste', session.reason)); console.log('probe-taste: INCOMPLETE (browser probes did not run; this is not a pass)'); return 2; }
  let results;
  try { results = await runTasteProbes(url, { session, only, skip }); } finally { await session.close(); }

  const entries = Object.entries(results);
  const failed = entries.filter(([, r]) => r.status === 'FAIL');
  const errored = entries.filter(([, r]) => r.status === 'ERROR');
  const warned = entries.filter(([, r]) => r.status === 'WARN');
  const verdict = failed.length ? 'FAIL' : errored.length ? 'ERROR' : warned.length ? 'WARN' : 'PASS';
  if (args.includes('--json')) { console.log(JSON.stringify({ url, browser: session.kind, verdict, results }, null, 2)); }
  else {
    console.log(`probe-taste: ${verdict} (${failed.length} failed, ${errored.length} errored, ${entries.length} probes)`);
    for (const [name, r] of entries) {
      const note = r.status === 'NA' ? ' (nothing to check)' : r.status === 'PASS' ? ` (${r.checked} checked)` : r.status === 'SKIPPED' ? ' (craft-overrides.json)' : '';
      console.log(`  ${name.padEnd(20)} ${r.status}${note}`);
      for (const f of r.findings.slice(0, 8)) console.log(`    [${name.toUpperCase()}] ${f}`);
      if (r.findings.length > 8) console.log(`    [${name.toUpperCase()}] and ${r.findings.length - 8} more`);
      if (r.status === 'FAIL' || r.status === 'ERROR') for (const i of r.info.slice(0, 2)) console.log(`    note: ${i}`);
    }
  }
  return failed.length ? 1 : errored.length ? 2 : 0;
}

main().then((code) => process.exit(code), (error) => { console.error(error.message); process.exit(2); });
