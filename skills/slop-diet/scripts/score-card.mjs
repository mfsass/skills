#!/usr/bin/env node
// Score card: turns the reviewer's check lines and the verify output into one % score and the final reply.
// No model tokens, no browser. Usage:
//   node score-card.mjs <review.txt | -> <verify.txt> [--kind persuade|tool] [--fixed T2,F5|none] [--card]
//   review.txt: the reviewer's saved reply (.slop-review.txt). `-` reads it from stdin (a heredoc).
// review.txt: lines `<ID> PASS|HALF|FAIL|NA <evidence>`, `FIX <ID> <element> -> <fix>`, `NOTE <ID> <text>` (agents/reviewer.md).
// verify.txt: saved output of verify.mjs.
// Score = sum(weight x value) / sum(weights) over checks that are not NA. PASS 1, HALF 0.5, FAIL 0.
// A missing check line is left out of the score and named as `not reviewed`.
// Cap: only a floor-law fail in the verify output (text contrast, focus ring, targets, overlap, overflow,
// reduced motion, console errors, page structure), or no complete verify report, caps the score at 70%.
// Advisory verify fails (taste, picker-flow, overlay-bounds, worst-case-text, reveal with JS off, lint taste rules)
// are open items, not a cap.
// --fixed: checks whose FIX lines you applied after the review. A fixed FAIL counts as HALF, never PASS, marked "fixed, not re-reviewed":
// the builder does not grade its own fix. Only a new review can raise a check to PASS.
// T1 Character cannot be marked fixed: only a new review can confirm it.
// --card: the explicit use (score per group and a direction question). Without it: the auto use.
// The output ends with one FINAL REPLY block. It is the builder's whole final message, word for word.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const GROUPS = [
  ['Character', [['T1', 'Character'], ['T3', 'Colour jobs'], ['N1', 'Motion']]],
  ['Craft', [['T2', 'Grid'], ['T6', 'Data at a glance'], ['F2', 'Main action'], ['D1', 'Selects'], ['N2', 'Tactile controls'], ['F5', 'No AI tells']]],
  ['Phone', [['T7', 'Phone layout']]],
  ['Copy', [['N5', 'Feedback']]],
];
const WEIGHT = { T2: 2.5, F2: 2.5, F5: 2.5, D1: 2.5, N1: 1.5, N2: 1.5, N5: 1.5, T3: 1, T6: 1, T7: 1 };
const VALUE = { PASS: 1, HALF: 0.5, FAIL: 0 };
const CAP = 70;
// verify check names that are advisory (open items). Every other failed check name is a floor law.
const ADVISORY = new Set(['taste', 'picker-flow', 'overlay-bounds', 'worst-case-text', 'card-dead-space']);
const LAW_LINT = /^(UX-FITTS-TARGET|UX-REDUCED-MOTION|UX-FORM-PLACEHOLDER-ONLY|UX-CLICKABLE-DIV)$/;
const ADVISORY_ERRORS = /^(taste probes|craft probes|dots)$/;

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const files = args.filter((a, i) => !a.startsWith('--') && !['--kind', '--fixed'].includes(args[i - 1]));
if (args.includes('--help') || files.length < 1) {
  console.log('Usage: node score-card.mjs <review.txt | -> <verify.txt> [--kind persuade|tool] [--fixed T2,F5|none] [--card]');
  process.exit(files.length < 1 && !args.includes('--help') ? 2 : 0);
}
const [reviewPath, verifyPath] = files;
if (reviewPath !== '-' && !existsSync(reviewPath)) {
  console.log(`score     unavailable: no review file at ${reviewPath}. Pass - and the reviewer's reply in a heredoc, or report "Score: not reviewed".`);
  process.exit(2);
}
const kind = flag('--kind') === 'tool' ? 'tool' : 'persuade';
WEIGHT.T1 = kind === 'tool' ? 1 : 2.5;
const fixedArg = (flag('--fixed') || 'none').toUpperCase();
const fixed = new Set(fixedArg === 'NONE' ? [] : fixedArg.split(/[ ,]+/).filter(Boolean));

const checks = {}; const fixes = {}; const notes = [];
const reviewText = readFileSync(reviewPath === '-' ? 0 : reviewPath, 'utf8');
if (!/^\W*(T[1-8]|F2|F5|D1|N[1-6])\s*:?\s+(PASS|HALF|FAIL|NA)\b/im.test(reviewText)) {
  console.log('score     unavailable: the review has no check lines. Report "Score: not reviewed".');
  process.exit(2);
}
for (const raw of reviewText.split('\n')) {
  const line = raw.replace(/^[\s>*`-]+/, '').replace(/`/g, '').trim();
  let m = line.match(/^(T[1-8]|F2|F5|D1|N[1-6])\s*:?\s+(PASS|HALF|FAIL|NA)\b[\s:—-]*(.*)$/i);
  if (m && (m[1].toUpperCase() in WEIGHT || m[1].toUpperCase() === 'T1')) { checks[m[1].toUpperCase()] = { v: m[2].toUpperCase(), why: m[3].trim() }; continue; }
  m = line.match(/^FIX\s+(T[1-8]|F2|F5|D1|N[1-6])\s*:?\s+(.*)$/i);
  if (m) { (fixes[m[1].toUpperCase()] ||= []).push(m[2].trim()); continue; }
  m = line.match(/^NOTE\s+(.*)$/i);
  if (m) notes.push(m[1].trim());
}

// Gates: read the verify report line, then sort each failed check into a floor law (cap) or an open item.
const gate = { pass: false, law: [], open: [], text: 'unknown (no verify output)', report: null, target: null, state: null };
if (verifyPath && existsSync(verifyPath)) {
  const vt = readFileSync(verifyPath, 'utf8');
  const vlines = vt.split('\n');
  gate.report = (vlines.find((l) => /^report\s+Verify:/.test(l)) || '').replace(/^report\s+/, '').trim() || null;
  gate.target = ((vlines.find((l) => /^verify:\s/.test(l)) || '').replace(/^verify:\s*/, '').trim()) || null;
  const st = vt.match(/\(state: (.+?) key: (.+?)\)\s*$/m);
  if (st) gate.state = { file: st[1], key: st[2] };
  if (gate.report) {
    const verdict = gate.report.replace(/^Verify:\s*/, '').replace(/\. Exceptions:.*$/, '');
    const [head, ...rest] = verdict.split(/;\s*/);
    for (const part of rest) {
      const m = part.match(/^open:\s*(.*)$/); if (m) gate.open.push(...m[1].split(/,\s*/).filter(Boolean));
      const e = part.match(/^ERROR\s+(.*)$/); if (e) for (const n of e[1].split(/,\s*/)) (ADVISORY_ERRORS.test(n) ? gate.open : gate.law).push(`${n} did not complete`);
    }
    if (/^PASS floor checks/.test(head)) gate.pass = gate.law.length === 0;
    else if (/^FAIL_FLOOR\s/.test(head)) {
      for (const n of head.replace(/^FAIL_FLOOR\s+/, '').split(/,\s*/).filter(Boolean)) {
        let law = !ADVISORY.has(n);
        // Older verify output: reveal and lint mix floor laws and advice, so read their FAIL lines.
        if (n === 'reveal') law = vlines.some((l) => /^FAIL reveal\s+reduced motion:/.test(l));
        if (n === 'lint') law = vlines.some((l) => { const r = l.match(/^FAIL lint\s+(\S+)/); return r && LAW_LINT.test(r[1]); });
        (law ? gate.law : gate.open).push(n);
      }
      gate.pass = gate.law.length === 0;
    } else if (/^ERROR\s/.test(head)) {
      for (const n of head.replace(/^ERROR\s+/, '').replace(/\s*\(not a pass\)$/, '').split(/,\s*/)) (ADVISORY_ERRORS.test(n) ? gate.open : gate.law).push(`${n} did not complete`);
      gate.pass = gate.law.length === 0;
    }
    gate.text = gate.pass ? 'PASS' : `FAIL ${gate.law.join(', ') || head}`;
  } else gate.text = 'unknown (no report line in the verify output)';
}
const reportLine = (() => {
  if (!gate.report) return `Verify: ${gate.text}. Exceptions: unknown.`;
  if (!gate.open.length || /;\s*open:/.test(gate.report)) return gate.report;
  // Older verify output: restate the verdict with floor laws and open items apart.
  const exc = (gate.report.match(/\. Exceptions:.*$/) || ['. Exceptions: none.'])[0];
  return `Verify: ${gate.pass ? 'PASS floor checks' : `FAIL_FLOOR ${gate.law.join(', ')}`}; open: ${gate.open.join(', ')}${exc}`;
})();

const rows = [];
for (const [group, list] of GROUPS) for (const [id, name] of list) {
  const c = checks[id] || { v: 'NA', why: 'not reviewed', missing: true };
  const wasFixed = c.v === 'FAIL' && id !== 'T1' && fixed.has(id) && fixes[id];
  rows.push({ group, id, name, missing: Boolean(c.missing), before: c.v, v: wasFixed ? 'HALF' : c.v, fixed: Boolean(wasFixed), why: c.why, w: WEIGHT[id] });
}
const pct = (list, key) => {
  const scored = list.filter((r) => r[key] !== 'NA');
  const total = scored.reduce((s, r) => s + r.w, 0);
  const got = scored.reduce((s, r) => s + r.w * VALUE[r[key]], 0);
  return { pct: total ? Math.round((100 * got) / total) : 100, pass: scored.filter((r) => r[key] === 'PASS').length, n: scored.length };
};
const after = pct(rows, 'v');
const before = pct(rows, 'before');
const capped = !gate.pass && after.pct > CAP;
const final = capped ? CAP : after.pct;
const fixedIds = rows.filter((r) => r.fixed).map((r) => r.id);
const missingIds = rows.filter((r) => r.missing).map((r) => r.id);
const open = rows.filter((r) => r.v === 'FAIL' || r.v === 'HALF').sort((a, b) => (b.w - a.w) || (VALUE[a.v] - VALUE[b.v]));
const top = open[0];
const clip = (s, n = 110) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s).replace(/\.+$/, '');
const topText = !gate.pass && gate.law.length ? `floor ${gate.law[0]} (verify FAIL line)`
  : top ? `${top.id} ${top.name} - ${clip(fixes[top.id] ? fixes[top.id][0] : top.why || top.v)}` : 'none';
const scoreText = `${final}% (${after.pass} of ${after.n})`;

console.log(`score     ${scoreText}${capped ? ` capped at ${CAP}% by a floor-law fail` : ''} | gates ${gate.text}${gate.open.length ? ` | open (no cap): ${gate.open.join(', ')}` : ''} | review before fixes ${before.pct}%${fixedIds.length ? ` | fixed, not re-reviewed: ${fixedIds.join(', ')}` : ''}${missingIds.length ? ` | not reviewed: ${missingIds.join(', ')}` : ''}`);

// The final reply: one block, pasted as the whole final message.
const reply = [];
if (args.includes('--card')) {
  reply.push(reportLine, `Score ${scoreText}${capped ? `, capped at ${CAP}% by the floor fail ${gate.law.join(', ')}` : ''}.`);
  for (const [group] of GROUPS) {
    const list = rows.filter((r) => r.group === group);
    const g = pct(list, 'v');
    reply.push(`- ${group} ${g.pct}% (${g.pass} of ${g.n}): ${list.map((r) => `${r.id} ${r.name} ${r.missing ? 'not reviewed' : r.v}${r.fixed ? ' (fixed)' : ''}`).join(', ')}`);
  }
  for (const r of open.slice(0, 5)) reply.push(`- Open ${r.id} ${r.name} ${r.v}: ${clip(r.why, 90)}${fixes[r.id] ? ` -> ${clip(fixes[r.id][0], 90)}` : ''}`);
  for (const n of gate.open) reply.push(`- Open (verify, advisory): ${n}`);
  for (const n of notes.slice(0, 2)) reply.push(`- Note: ${clip(n, 120)}`);
  reply.push(`Which direction next: polish the open checks, bolder, calmer, or your own words?`);
} else {
  reply.push(`Files: ${gate.target || 'see verify'}`, reportLine,
    `Score ${scoreText}. Open: ${topText}. Say 'another round' and a direction (bolder, calmer, or your own words).`);
}
console.log('FINAL REPLY: your whole final message is the lines between the two rules, word for word. Write nothing before or after them.');
console.log('────────');
for (const l of reply) console.log(l);
console.log('────────');

// The round ends here: clear verify's run count for this page, so a new round gets two verify runs again.
if (gate.state && existsSync(gate.state.file)) {
  try { const st = JSON.parse(readFileSync(gate.state.file, 'utf8')); delete st[gate.state.key]; writeFileSync(gate.state.file, JSON.stringify(st)); } catch { /* keep the state */ }
}
