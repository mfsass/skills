#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
function need(v,message){if(!v)throw Error(message)}
function canonical(v){if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';if(object(v))return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
export const manifestHash=v=>createHash('sha256').update(canonical(v)).digest('hex');
function outcome(pair,choice){if(choice==='a')return pair[0];if(choice==='b')return pair[1];if(choice==='tie')return'tie';return'unknown'}
function pairsEqual(a,b){return Array.isArray(a)&&a.length===2&&a[0]===b[0]&&a[1]===b[1]}
export function scorePreferenceRuns(bundle){
 need(object(bundle)&&Array.isArray(bundle.runs),'Provide a bundle with a runs array.');
 const target=bundle.targets;
 need(object(target),'Provide explicit pilot targets.');
 for(const k of ['minimumUniqueValidationPairs','minimumFamilies','minimumBatches'])need(Number.isSafeInteger(target[k])&&target[k]>0,`Provide a positive integer ${k}.`);
 for(const k of ['minimumScoredCoverage','minimumExactAgreement'])need(Number.isFinite(target[k])&&target[k]>=0&&target[k]<=1,`Provide ${k} from zero through one.`);
 const seenRuns=new Set(),seenPairs=new Set(),rows=[],controls=[],repeats=[],conditions={},families=new Set(),batches=new Set();let identityHash=null,missing=0,afterReveal=0,duplicatePairs=0;
 for(const run of bundle.runs){
  const {manifest:m,predictions:p,human:h}=run;need(object(m)&&text(m.studyId)&&Array.isArray(m.cases)&&Array.isArray(m.candidates),'Provide a valid manifest.');need(!seenRuns.has(m.studyId),'Study IDs must be unique.');seenRuns.add(m.studyId);
  if(m.targetsHash!==undefined)need(m.targetsHash===manifestHash(target),'Pilot targets differ from the frozen manifest.');const hash=manifestHash(m);need(object(p)&&p.manifestHash===hash,'Predictions must match the manifest hash.');need(object(h)&&h.manifestHash===hash&&h.studyId===m.studyId,'Human records must match the study and manifest.');
  need(object(p.identity)&&['model','promptHash','examplesHash'].every(k=>text(p.identity[k])),'Declare the judge model, prompt hash, and examples hash.');
  const identity=manifestHash(p.identity);if(identityHash===null)identityHash=identity;need(identityHash===identity,'Do not pool different judge identities.');
  const candidates=new Map();for(const c of m.candidates){need(object(c)&&text(c.id)&&text(c.sourceSHA256)&&!candidates.has(c.id),'Candidates need unique IDs and source hashes.');candidates.set(c.id,c)}
  need(Array.isArray(p.cases),'Predictions need a cases array.');const predictions=new Map();for(const r of p.cases){need(object(r)&&text(r.id)&&!predictions.has(r.id),'Prediction IDs must be unique.');need(['a','b','tie','unknown'].includes(r.choice),'Use a, b, tie, or unknown predictions.');predictions.set(r.id,r)}
  const human=h.latestBlindVotes??h.ballots??{};need(object(human),'Human ballots must be an object.');const ids=new Set();const normalized=new Map();
  for(const c of m.cases){
   need(object(c)&&text(c.id)&&text(c.family)&&!ids.has(c.id),'Cases need unique IDs and a family.');ids.add(c.id);need(['validation','control','repeat'].includes(c.kind),'Use validation, control, or repeat cases.');need(Array.isArray(c.pair)&&c.pair.length===2&&new Set(c.pair).size===2&&c.pair.every(id=>candidates.has(id)),'Case pairs must reference two candidates.');
   const pred=predictions.get(c.id);need(pred&&pairsEqual(pred.pair,c.pair),'Every prediction must preserve its declared pair.');
   if(m.requireArtifactObservations)need(Array.isArray(pred.observations),'This manifest requires artifact observations.');if(pred.observations!==undefined){need(Array.isArray(pred.observations)&&pred.observations.length===2,'Supply two artifact observations.');for(let i=0;i<2;i++){const o=pred.observations[i],candidate=candidates.get(c.pair[i]);need(o.candidateId===candidate.id,'Artifact observations must preserve pair order.');if(candidate.headline)need(String(o.headline).replace(/\s+/g,' ').trim()===candidate.headline.replace(/\s+/g,' ').trim(),'An observed headline differs from its bound artifact.')}}
   const actual=outcome(c.pair,pred.choice);normalized.set(c.id,actual);
   if(c.kind==='control'){need(c.expected==='tie'||c.pair.includes(c.expected),'Controls need an explicit expected outcome.');controls.push({id:c.id,studyId:m.studyId,pass:actual===c.expected,expected:c.expected,actual});continue}
   if(c.kind==='repeat'){need(text(c.repeatOf)&&c.repeatOf!==c.id&&m.cases.some(x=>x.id===c.repeatOf&&x.kind!=='repeat'),'Repeats need an existing reference case other than a repeat.');repeats.push({id:c.id,studyId:m.studyId,reference:c.repeatOf,actual,referenceActual:null});continue}
   const pairKey=c.family+'|'+c.pair.map(id=>candidates.get(id).sourceSHA256).sort().join('|');if(seenPairs.has(pairKey)){duplicatePairs++;continue}seenPairs.add(pairKey);
   const vote=human[c.id];if(!vote){missing++;rows.push({id:c.id,family:c.family,studyId:m.studyId,actual,expected:null,pair:c.pair});continue}
   need(object(vote)&&Array.isArray(vote.sides)&&vote.sides.length===2&&[...vote.sides].sort().join('|')===[...c.pair].sort().join('|'),'A human ballot changes its candidate pair.');need(['a','b','tie','unknown','neither'].includes(vote.choice),'A human choice is invalid.');need(typeof vote.afterReveal==='boolean','Record whether each vote follows reveal.');if(vote.afterReveal){afterReveal++;continue}
   const expected=outcome(vote.sides,vote.choice);rows.push({id:c.id,family:c.family,studyId:m.studyId,actual,expected,pair:c.pair});
   if(expected!=='unknown'){families.add(c.family);batches.add(m.studyId)}
   for(const id of c.pair){const cand=candidates.get(id);if(cand.condition!=='candidate')continue;const opponent=candidates.get(c.pair.find(x=>x!==id));const key=(cand.version??'unspecified')+' / '+(opponent.condition??opponent.id);const tally=conditions[key]??={preferred:0,otherPreferred:0,ties:0,unknown:0,comparisons:0,mechanicalFailures:0};tally.comparisons++;if(cand.mechanicalStatus!=='Pass')tally.mechanicalFailures++;if(expected==='unknown')tally.unknown++;else if(expected==='tie')tally.ties++;else if(expected===id)tally.preferred++;else tally.otherPreferred++}
  }
  need(predictions.size===ids.size&&[...predictions.keys()].every(id=>ids.has(id)),'Predictions contain missing or extra cases.');need(Object.keys(human).every(id=>ids.has(id)),'Human ballots contain an unknown case.');
  for(const r of repeats.filter(r=>r.studyId===m.studyId))r.referenceActual=normalized.get(r.reference);
 }
 const labeled=rows.filter(r=>r.expected!==null&&r.expected!=='unknown'),scored=labeled.filter(r=>r.actual!=='unknown'),matches=scored.filter(r=>r.actual===r.expected),abstentions=labeled.length-scored.length;
 const coverage=labeled.length?scored.length/labeled.length:null,agreement=scored.length?matches.length/scored.length:null;
 const orderChecks=repeats.map(r=>({...r,pass:r.actual!=='unknown'&&r.actual===r.referenceActual}));
 const byFamily={};for(const family of [...new Set(rows.map(r=>r.family))]){const data=labeled.filter(r=>r.family===family),evaluated=data.filter(r=>r.actual!=='unknown');byFamily[family]={humanAssessable:data.length,scored:evaluated.length,matches:evaluated.filter(r=>r.actual===r.expected).length,abstentions:data.length-evaluated.length}}
 const byHumanOutcome={};for(const kind of ['a','b','tie']){const data=labeled.filter(r=>(r.expected==='tie'?'tie':r.expected===r.pair[0]?'a':'b')===kind);byHumanOutcome[kind]={humanLabels:data.length,scored:data.filter(r=>r.actual!=='unknown').length,matches:data.filter(r=>r.actual===r.expected).length}}
 const reasons=[];if(missing||afterReveal)reasons.push('Complete fresh human labels for every planned validation case.');if(labeled.length<target.minimumUniqueValidationPairs)reasons.push('More fresh human-labeled pairs are required.');if(families.size<target.minimumFamilies)reasons.push('More task families are required.');if(batches.size<target.minimumBatches)reasons.push('More fresh batches are required.');if(coverage===null||coverage<target.minimumScoredCoverage)reasons.push('Scored coverage is below the target.');if(agreement===null||agreement<target.minimumExactAgreement)reasons.push('Exact agreement is below the target.');if(!controls.length||controls.some(c=>!c.pass))reasons.push('Control checks are missing or fail.');if(!orderChecks.length||orderChecks.some(c=>!c.pass))reasons.push('Order checks are missing or fail.');
 return{advisoryOnly:true,identityHash,eligibleForOwnerPilot:reasons.length===0,reasons,targets:target,counts:{plannedUniqueValidation:seenPairs.size,humanAssessable:labeled.length,scored:scored.length,matches:matches.length,disagreements:scored.length-matches.length,abstentions,humanAbstentions:rows.filter(r=>r.expected==='unknown').length,missing,afterReveal,duplicatePairs,families:families.size,batches:batches.size},scoredCoverage:coverage,exactAgreement:agreement,byFamily,byHumanOutcome,controls,orderChecks,designPreferences:conditions,note:'These checks establish declared arithmetic and record alignment. They do not authenticate human authorship or prove general reliability.'};
}
export async function main(args=process.argv.slice(2)){
 if(args.includes('--help')||!args.length){console.log('Usage: node score-preferences.mjs BUNDLE.json [--out REPORT.json]\nUse frozen predictions and matching human exports. Results remain advisory.\nExit 0: the bundle meets the pilot targets (or --help). Exit 1: it does not (see reasons). Exit 2: invalid input.');return 0}
 const index=args.indexOf('--out');need(args.length===(index<0?1:3)&&index!==0,'Provide one bundle and an optional --out path.');const bundle=JSON.parse(await readFile(resolve(args[0]),'utf8'));const report=scorePreferenceRuns(bundle);if(index>=0)await writeFile(resolve(args[index+1]),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));return report.eligibleForOwnerPilot?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().then(code=>{process.exitCode=code}).catch(e=>{console.error(e.message);process.exitCode=2});
