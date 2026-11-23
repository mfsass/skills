// Repo checks that need no network and no agent: manifests, versions and skill front matter.
// Run: node .github/scripts/check-repo.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const errors = [];
const fail = (msg) => errors.push(msg);
const json = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(`${path}: invalid JSON (${e.message})`); return {}; } };

// Marketplace entries point at real plugins with matching names.
const market = json('.claude-plugin/marketplace.json');
for (const plugin of market.plugins ?? []) {
  const manifest = join(plugin.source, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) { fail(`${plugin.name}: ${manifest} is missing`); continue; }
  const p = json(manifest);
  if (p.name !== plugin.name) fail(`${manifest}: name "${p.name}" does not match marketplace entry "${plugin.name}"`);
  if (!/^\d+\.\d+\.\d+$/.test(p.version ?? '')) fail(`${manifest}: version must be x.y.z`);
  if (!readFileSync('CHANGELOG.md', 'utf8').includes(`## [${p.version}]`)) fail(`CHANGELOG.md has no "## [${p.version}]" section for ${p.name}`);
}

// Every skill: front matter name equals the folder, description present and short enough.
for (const name of readdirSync('skills')) {
  const file = join('skills', name, 'SKILL.md');
  if (!existsSync(file)) { fail(`skills/${name}: SKILL.md is missing`); continue; }
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
  const field = (key) => new RegExp(`^${key}:\s*"?(.*?)"?\s*$`, 'm').exec(front)?.[1]?.trim();
  if (field('name') !== name) fail(`${file}: name "${field('name')}" must equal the folder name "${name}"`);
  const description = field('description') ?? '';
  if (!description) fail(`${file}: description is missing`);
  if (description.length > 1024) fail(`${file}: description is ${description.length} characters (max 1024)`);
}

if (errors.length) { console.error(errors.map((e) => `FAIL ${e}`).join('\n')); process.exit(1); }
console.log('PASS repo checks');
