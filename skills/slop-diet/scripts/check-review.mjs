#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const help = `Usage: node check-review.mjs RECORD.json

Check a review record and derive readiness within its declared scope.
Use --help to show this help.
Local evidence paths resolve relative to the record file.
HTTP and HTTPS evidence URLs remain declarations. This script does not fetch them.
Pass and Fail require referenced evidence declared as inspected.
Unknown and Not applicable require a reason.
Required failures and open Critical or Major findings block readiness.
Required unknown results leave readiness pending.
Artifacts do not prove test quality or human calibration.
Exit codes: 0 Ready, 1 Blocked or Pending, 2 malformed record.
`;
const results = new Set(['Pass', 'Fail', 'Unknown', 'Not applicable']);
const severities = new Set(['Critical', 'Major', 'Minor', 'Preference']);
const statuses = new Set(['Open', 'Resolved']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const note = 'Declared artifacts do not prove test quality or human calibration. URL evidence and inspection status remain declarations.';

async function validate(record, file) {
  const errors = [];
  const ids = new Set();
  const evidence = new Map();
  const paths = { localPathsChecked: 0, urlDeclarations: 0 };
  const fail = text => errors.push(text);
  function id(item, location) {
    if (!nonempty(item.id)) fail(`${location}: provide a nonempty ID.`);
    else if (ids.has(item.id)) fail(`${location}: the ID is not unique.`);
    else ids.add(item.id);
  }
  function references(item, location) {
    if (!Array.isArray(item.evidence)) {
      fail(`${location}: provide an evidence array.`);
      return [];
    }
    const refs = [];
    for (const ref of item.evidence) {
      if (!nonempty(ref) || !evidence.has(ref)) fail(`${location}: an evidence ID does not exist.`);
      else refs.push(evidence.get(ref));
    }
    return refs;
  }
  if (!object(record)) return { errors: ['Provide a JSON object.'], paths };
  for (const key of ['scope', 'candidate'])
    if (!nonempty(record[key])) fail(`Provide a nonempty ${key} string.`);
  for (const key of ['evidence', 'checks', 'findings'])
    if (!Array.isArray(record[key])) fail(`Provide a ${key} array.`);
  if (Array.isArray(record.checks) && record.checks.length === 0) fail('Provide at least one check.');
  for (const [index, item] of (Array.isArray(record.evidence) ? record.evidence : []).entries()) {
    const location = `evidence[${index}]`;
    if (!object(item)) { fail(`${location}: provide an object.`); continue; }
    id(item, location);
    if (!nonempty(item.kind)) fail(`${location}: provide a nonempty kind string.`);
    if (typeof item.inspected !== 'boolean') fail(`${location}: inspected must be a boolean.`);
    if (nonempty(item.id)) evidence.set(item.id, item);
    if (!nonempty(item.path)) { fail(`${location}: provide a nonempty path string.`); continue; }
    if (/^https?:\/\//i.test(item.path)) {
      try {
        const url = new URL(item.path);
        if (!url.hostname) throw new Error();
        paths.urlDeclarations++;
      } catch { fail(`${location}: provide a valid HTTP or HTTPS URL.`); }
    } else if (!isAbsolute(item.path) && /^[a-z][a-z\d+.-]*:/i.test(item.path)) {
      fail(`${location}: use a local path or an HTTP or HTTPS URL.`);
    } else {
      try { await stat(resolve(dirname(file), item.path)); paths.localPathsChecked++; }
      catch { fail(`${location}: the local evidence path does not exist or cannot be read.`); }
    }
  }
  for (const [index, item] of (Array.isArray(record.checks) ? record.checks : []).entries()) {
    const location = `checks[${index}]`;
    if (!object(item)) { fail(`${location}: provide an object.`); continue; }
    id(item, location);
    if (typeof item.required !== 'boolean') fail(`${location}: required must be a boolean.`);
    if (!results.has(item.result)) fail(`${location}: result must use a supported value.`);
    if (typeof item.reason !== 'string') fail(`${location}: provide a reason string.`);
    const refs = references(item, location);
    if (['Pass', 'Fail'].includes(item.result) && !refs.some(ref => ref.inspected === true))
      fail(`${location}: Pass and Fail need referenced evidence declared as inspected.`);
    if (['Unknown', 'Not applicable'].includes(item.result) && !nonempty(item.reason))
      fail(`${location}: this result needs a nonempty reason.`);
  }
  for (const [index, item] of (Array.isArray(record.findings) ? record.findings : []).entries()) {
    const location = `findings[${index}]`;
    if (!object(item)) { fail(`${location}: provide an object.`); continue; }
    id(item, location);
    if (!severities.has(item.severity)) fail(`${location}: severity must use a supported value.`);
    if (!statuses.has(item.status)) fail(`${location}: status must use a supported value.`);
    if (!nonempty(item.message)) fail(`${location}: provide a nonempty message string.`);
    references(item, location);
  }
  return { errors, paths };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(help); return; }
  if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Provide one JSON record path. Use --help for instructions.');
  const file = resolve(args[0]);
  let record;
  try { record = JSON.parse(await readFile(file, 'utf8')); }
  catch { throw new Error('The review record could not load. Check its path and JSON syntax.'); }
  const { errors, paths } = await validate(record, file);
  if (errors.length) {
    process.stdout.write(`${JSON.stringify({ advisoryOnly: true, readiness: 'Invalid', errors, note }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  const blockers = record.checks.filter(check => check.required && check.result === 'Fail').map(check => check.id);
  blockers.push(...record.findings.filter(finding => finding.status === 'Open' &&
    ['Critical', 'Major'].includes(finding.severity)).map(finding => finding.id));
  const pending = record.checks.filter(check => check.required && check.result === 'Unknown').map(check => check.id);
  const readiness = blockers.length ? 'Blocked' : pending.length ? 'Pending' : 'Ready within tested scope';
  process.stdout.write(`${JSON.stringify({ advisoryOnly: true, readiness, scope: record.scope, candidate: record.candidate,
    blockers, pending, evidence: paths, note }, null, 2)}\n`);
  process.exitCode = blockers.length || pending.length ? 1 : 0;
}

main().catch(error => {
  process.stdout.write(`${JSON.stringify({ advisoryOnly: true, readiness: 'Invalid',
    errors: [error.message], note }, null, 2)}\n`);
  process.exitCode = 2;
});
