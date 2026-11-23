const STATES = ['Pass', 'Fail', 'Unknown', 'Not applicable'];

function object(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
  return value;
}

function array(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array.`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a nonempty string.`);
  return value;
}

function boolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean.`);
  return value;
}

function integer(value, name, min, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}.`);
  }
  return value;
}

function weight(value, name, fallback = false) {
  if (value === undefined && fallback) return 1;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive and finite.`);
  }
  return value;
}

function unique(seen, value, name) {
  if (seen.has(value)) throw new Error(`Duplicate ${name}: ${value}.`);
  seen.add(value);
}

function counts(rows, field = 'result') {
  const out = Object.fromEntries(STATES.map(state => [state, 0]));
  for (const row of rows) out[row[field]]++;
  return { ...out, total: rows.length };
}

// Normalize weights before addition to keep finite inputs from overflowing.
function mechanicalMetrics(rows) {
  const applicable = rows.filter(row => row.result !== 'Not applicable');
  const evaluated = applicable.filter(row => row.result !== 'Unknown');
  const ratio = (numerator, denominator) => {
    if (!denominator.length) return null;
    const largest = denominator.reduce((max, row) => Math.max(max, row.weight), 0);
    const sum = values => values.reduce((total, row) => total + row.weight / largest, 0);
    return 100 * (sum(numerator) / sum(denominator));
  };
  return {
    score: ratio(evaluated.filter(row => row.result === 'Pass'), evaluated),
    coverage: ratio(evaluated, applicable),
    counts: counts(rows),
  };
}

export function summarize(results) {
  const seen = new Set();
  const pairs = new Set();
  const rows = array(results, 'results').map((input, index) => {
    const row = object(input, `results[${index}]`);
    const id = text(row.id, `results[${index}].id`);
    const checkId = text(row.checkId, `${id}.checkId`);
    const contextId = text(row.contextId, `${id}.contextId`);
    unique(seen, id, 'result ID');
    unique(pairs, JSON.stringify([checkId, contextId]), 'check and context pair');
    if (!STATES.includes(row.result)) throw new Error(`${id}.result is invalid.`);
    return {
      id, checkId, contextId,
      area: text(row.area, `${id}.area`),
      required: boolean(row.required, `${id}.required`),
      weight: weight(row.weight, `${id}.weight`),
      result: row.result,
    };
  });
  rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const blockers = rows.filter(row => row.required && row.result === 'Fail').map(row => row.id);
  const pending = rows.filter(row => row.required && row.result === 'Unknown').map(row => row.id);
  const requiredApplicable = rows.some(row => row.required && row.result !== 'Not applicable');
  const areas = Object.fromEntries([...new Set(rows.map(row => row.area))].sort().map(area => [
    area, mechanicalMetrics(rows.filter(row => row.area === area)),
  ]));
  return {
    ...mechanicalMetrics(rows), areas,
    readiness: blockers.length ? 'Blocked' : pending.length || !requiredApplicable ? 'Pending' : 'Ready within tested scope',
    blockers, pending,
  };
}

function criterionRecords(criteria) {
  const seen = new Set();
  return array(criteria, 'criteria').map((input, index) => {
    const row = object(input, `criteria[${index}]`);
    const id = text(row.id, `criteria[${index}].id`);
    unique(seen, id, 'criterion ID');
    return {
      id,
      area: text(row.area, `${id}.area`),
      description: text(row.description, `${id}.description`),
      required: boolean(row.required, `${id}.required`),
      weight: weight(row.weight, `${id}.weight`, true),
      minScore: integer(row.minScore === undefined ? 2 : row.minScore, `${id}.minScore`, 0, 3),
    };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function scoreJudge(criteria, response) {
  const definitions = criterionRecords(criteria);
  const known = new Set(definitions.map(row => row.id));
  const ratings = new Map();
  const submitted = array(object(response, 'response').ratings, 'response.ratings');
  for (const [index, input] of submitted.entries()) {
    const row = object(input, `ratings[${index}]`);
    const id = text(row.criterionId, `ratings[${index}].criterionId`);
    if (!known.has(id)) throw new Error(`Unknown criterion ID: ${id}.`);
    if (ratings.has(id)) throw new Error(`Duplicate rating criterion ID: ${id}.`);
    const reason = text(row.reason, `${id}.reason`);
    const evidence = array(row.evidence, `${id}.evidence`).map((value, i) => text(value, `${id}.evidence[${i}]`));
    const evidenceSeen = new Set();
    for (const value of evidence) unique(evidenceSeen, value, 'evidence ID');
    const score = row.score === null ? null : integer(row.score, `${id}.score`, 0, 3);
    if (score !== null && !evidence.length) throw new Error(`${id} requires evidence for a non-null score.`);
    ratings.set(id, { score, evidence: [...evidence], reason });
  }
  const profile = definitions.map(definition => {
    const rating = ratings.get(definition.id);
    return {
      ...definition,
      score: rating ? rating.score : null,
      evidence: rating ? rating.evidence : [],
      reason: rating ? rating.reason : 'No rating was submitted.',
      status: !rating ? 'Missing' : rating.score === null ? 'Unknown' : rating.score < definition.minScore ? 'Below threshold' : 'Meets threshold',
    };
  });
  const scored = profile.filter(row => row.score !== null);
  const largest = profile.reduce((max, row) => Math.max(max, row.weight), 0);
  const sum = rows => rows.reduce((total, row) => total + row.weight / largest, 0);
  // Use the scored subset's scale to preserve an isolated tiny scored weight.
  const scoredLargest = scored.reduce((max, row) => Math.max(max, row.weight), 0);
  const scoredTotal = scored.reduce((total, row) => total + row.weight / scoredLargest, 0);
  const score = scored.length ? scored.reduce((total, row) => total + row.score * (row.weight / scoredLargest), 0) / scoredTotal : null;
  const ids = status => profile.filter(row => row.status === status).map(row => row.id);
  const requiredIds = status => profile.filter(row => row.required && row.status === status).map(row => row.id);
  return {
    advisoryOnly: true,
    score, scoreScale: { min: 0, max: 3 },
    coverage: profile.length ? 100 * (sum(scored) / sum(profile)) : null,
    profile,
    missing: ids('Missing'), unknown: ids('Unknown'), belowThreshold: ids('Below threshold'),
    requiredMissing: requiredIds('Missing'), requiredUnknown: requiredIds('Unknown'), requiredBelowThreshold: requiredIds('Below threshold'),
  };
}

function identity(input, name) {
  const value = object(input, name);
  return Object.fromEntries(['model', 'promptHash', 'rubricHash'].map(key => [key, text(value[key], `${name}.${key}`)]));
}

export function calibrate(labels, predictions) {
  object(labels, 'labels');
  object(predictions, 'predictions');
  const labelIdentity = identity(labels.identity, 'labels.identity');
  const predictionIdentity = identity(predictions.identity, 'predictions.identity');
  for (const key of Object.keys(labelIdentity)) {
    if (labelIdentity[key] !== predictionIdentity[key]) throw new Error(`Calibration identity mismatch: ${key}.`);
  }
  const criterionSet = new Set();
  for (const [index, value] of array(labels.criteria, 'labels.criteria').entries()) {
    unique(criterionSet, text(value, `labels.criteria[${index}]`), 'criterion ID');
  }
  if (!criterionSet.size) throw new Error('labels.criteria must not be empty.');
  const rawLimits = object(labels.limits, 'labels.limits');
  const limits = Object.fromEntries(['maxFalsePasses', 'maxFalseFailures'].map(key => [key, integer(rawLimits[key], `limits.${key}`, 0)]));
  const cases = new Map();
  for (const [index, input] of array(labels.cases, 'labels.cases').entries()) {
    const row = object(input, `labels.cases[${index}]`);
    const id = text(row.id, `labels.cases[${index}].id`);
    if (cases.has(id)) throw new Error(`Duplicate label case ID: ${id}.`);
    const criterionId = text(row.criterionId, `${id}.criterionId`);
    if (!criterionSet.has(criterionId)) throw new Error(`Unknown label criterion ID: ${criterionId}.`);
    if (row.labelSource !== 'human') throw new Error(`${id}.labelSource must be human.`);
    cases.set(id, { criterionId, expected: boolean(row.expected, `${id}.expected`) });
  }
  const actuals = new Map();
  for (const [index, input] of array(predictions.cases, 'predictions.cases').entries()) {
    const row = object(input, `predictions.cases[${index}]`);
    const id = text(row.id, `predictions.cases[${index}].id`);
    if (actuals.has(id)) throw new Error(`Duplicate prediction case ID: ${id}.`);
    if (!cases.has(id)) throw new Error(`Unknown prediction case ID: ${id}.`);
    if (row.criterionId !== cases.get(id).criterionId) throw new Error(`Case criterion mismatch: ${id}.`);
    const actual = row.actual === null ? null : boolean(row.actual, `${id}.actual`);
    actuals.set(id, actual);
  }
  for (const id of cases.keys()) if (!actuals.has(id)) throw new Error(`Missing prediction case ID: ${id}.`);
  const byCriterion = Object.fromEntries([...criterionSet].sort().map(id => [id, {
    truePasses: 0, trueFailures: 0, falsePasses: 0, falseFailures: 0,
    humanPositives: 0, humanNegatives: 0, abstentions: 0,
    abstainedPositives: 0, abstainedNegatives: 0, total: 0,
  }]));
  for (const [id, row] of cases) {
    const group = byCriterion[row.criterionId];
    const actual = actuals.get(id);
    group.total++;
    group[row.expected ? 'humanPositives' : 'humanNegatives']++;
    if (actual === null) {
      group.abstentions++;
      group[row.expected ? 'abstainedPositives' : 'abstainedNegatives']++;
    } else group[row.expected ? (actual ? 'truePasses' : 'falseFailures') : (actual ? 'falsePasses' : 'trueFailures')]++;
  }
  const totals = Object.fromEntries(Object.keys(Object.values(byCriterion)[0]).map(key => [key, 0]));
  for (const group of Object.values(byCriterion)) {
    for (const key of Object.keys(totals)) totals[key] += group[key];
    group.denominators = { falsePasses: group.humanNegatives, falseFailures: group.humanPositives, agreement: group.total };
    group.eligible = group.humanPositives >= 2 && group.humanNegatives >= 2 && group.abstentions === 0
      && group.falsePasses <= limits.maxFalsePasses && group.falseFailures <= limits.maxFalseFailures;
  }
  return {
    identity: labelIdentity, limits, criteria: [...criterionSet].sort(),
    eligible: Object.values(byCriterion).every(group => group.eligible),
    advisoryOnly: true, counts: totals, byCriterion,
  };
}
