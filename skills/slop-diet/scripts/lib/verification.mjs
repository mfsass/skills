import { scoreJudge } from './scoring.mjs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function need(condition, message) {
  if (!condition) throw new Error(message);
}

function stringList(value, name) {
  need(Array.isArray(value) && value.every(nonempty), `${name} must contain nonempty strings.`);
  need(new Set(value).size === value.length, `${name} must not contain duplicate values.`);
  return value;
}

export function verificationStatus({ mechanical, judgment } = {}) {
  const blocked = [];
  const pending = [];
  if (!mechanical) {
    pending.push('Mechanical results are missing.');
  } else {
    for (const id of mechanical.blockers ?? []) blocked.push(`Required mechanical check failed: ${id}.`);
    if (mechanical.readiness === 'Blocked' && !blocked.length) {
      blocked.push('Mechanical readiness is Blocked.');
    }
    for (const id of mechanical.pending ?? []) pending.push(`Required mechanical check is unknown: ${id}.`);
    if (mechanical.readiness === 'Pending' && !pending.length) {
      pending.push('No applicable required mechanical check has a result.');
    }
  }
  if (!judgment) {
    pending.push('Judgment results are missing.');
  } else {
    for (const row of judgment.profile ?? []) {
      if (!row.required) continue;
      if (row.score === null || row.score === undefined) {
        pending.push(`Required judgment has no score: ${row.id}.`);
      } else if (row.score < row.minScore) {
        blocked.push(`Required judgment is below its threshold: ${row.id}.`);
      }
    }
  }
  return {
    status: blocked.length ? 'Blocked' : pending.length ? 'Pending' : 'Reviewed within declared scope',
    reasons: [...blocked, ...pending],
    advisoryOnly: true,
  };
}

export function validateReviewEvidence({ criteria, response, evidence, results = [] }) {
  // Check the existing rating contract before checking optional evidence policies.
  scoreJudge(criteria, response);
  need(Array.isArray(evidence), 'evidence must be an array.');
  need(Array.isArray(results), 'results must be an array.');
  const artifacts = new Map();
  for (const item of evidence) {
    need(item && nonempty(item.id), 'Each evidence artifact must have a nonempty ID.');
    need(!artifacts.has(item.id), `Duplicate evidence ID: ${item.id}.`);
    artifacts.set(item.id, item);
  }
  const definitions = new Map(criteria.map(row => [row.id, row]));
  const metadata = (item, key) => item[key] ?? item.metadata?.[key];
  for (const rating of response.ratings) {
    const cited = rating.evidence.map(id => {
      need(artifacts.has(id), `Rating ${rating.criterionId} references evidence outside this run: ${id}.`);
      return artifacts.get(id);
    });
    if (rating.score === null) continue;
    const criterion = definitions.get(rating.criterionId);
    const kinds = criterion.evidenceKinds === undefined ? [] : stringList(criterion.evidenceKinds, `${criterion.id}.evidenceKinds`);
    const contexts = criterion.contexts === undefined ? [] : stringList(criterion.contexts, `${criterion.id}.contexts`);
    const checks = criterion.checkIds === undefined ? [] : stringList(criterion.checkIds, `${criterion.id}.checkIds`);
    const states = criterion.states === undefined ? [] : stringList(criterion.states, `${criterion.id}.states`);
    for (const key of ['requireObservation', 'requireComponentCapture']) {
      if (criterion[key] !== undefined) {
        need(typeof criterion[key] === 'boolean', `${criterion.id}.${key} must be a boolean.`);
      }
    }
    for (const kind of kinds) {
      need(cited.some(item => metadata(item, 'kind') === kind), `${criterion.id} requires cited evidence of kind ${kind}.`);
    }
    const suitable = item => (!kinds.length || kinds.includes(metadata(item, 'kind')))
      && (!criterion.requireComponentCapture
        || (metadata(item, 'kind') === 'screenshot' && metadata(item, 'region') === 'component'));
    for (const context of contexts) {
      need(cited.some(item => metadata(item, 'contextId') === context
        && suitable(item)),
      `${criterion.id} requires suitable cited evidence for context ${context}.`);
    }
    if (criterion.requireComponentCapture) {
      need(cited.some(item => metadata(item, 'kind') === 'screenshot' && metadata(item, 'region') === 'component'),
        `${criterion.id} requires a cited screenshot of the component.`);
    }
    for (const state of states) {
      need(cited.some(item => metadata(item, 'state') === state && suitable(item)),
        `${criterion.id} requires suitable cited evidence for state ${state}.`);
    }
    if (criterion.requireObservation) {
      const visual = cited.filter(item => ['screenshot', 'recording'].includes(metadata(item, 'kind')));
      need(Array.isArray(rating.observations), `${criterion.id}.observations must be an array.`);
      for (const observation of rating.observations) {
        need(observation && nonempty(observation.evidenceId) && nonempty(observation.detail),
          `${criterion.id} requires an evidence ID and detail for each observation.`);
        need(rating.evidence.includes(observation.evidenceId), `${criterion.id} references an observation outside its cited evidence.`);
      }
      for (const item of visual) {
        need(rating.observations.some(row => row.evidenceId === item.id),
          `${criterion.id} requires an observation for evidence ${item.id}.`);
      }
    }
    if (rating.score >= (criterion.minScore ?? 2)) {
      const failed = results.find(row => checks.includes(row.checkId) && row.result === 'Fail');
      need(!failed, `${criterion.id} cannot meet its threshold because mechanical check ${failed?.checkId} failed.`);
    }
  }
  return true;
}
