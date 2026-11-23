// Repo checks that need no network and no agent: manifests, skill front matter,
// the directory edition's file rules and version sync. Run: node .github/scripts/check-repo.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const errors = [];
const fail = (msg) => errors.push(msg);
const json = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(`${path}: invalid JSON (${e.message})`); return {}; } };
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

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

// Directory editions: text and images only, small files, same version as the full skill.
if (existsSync('directory')) {
  for (const name of readdirSync('directory')) {
    const root = join('directory', name);
    const files = walk(root);
    if (files.length > 512) fail(`${root}: ${files.length} files (max 512)`);
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      if (!['.md', '.json', '.yaml', '.yml', '.png', ''].includes(ext) || (ext === '' && !file.endsWith('LICENSE'))) fail(`${file}: file type not allowed in the directory edition`);
      if (ext !== '.png' && statSync(file).size > 256 * 1024) fail(`${file}: over 256 KiB`);
    }
    const full = join('skills', name, '.claude-plugin', 'plugin.json');
    if (existsSync(full)) {
      const a = json(full).version, b = json(join(root, '.claude-plugin', 'plugin.json')).version;
      if (a !== b) fail(`${root}: version ${b} differs from ${full} version ${a}`);
    }
  }
}

if (errors.length) { console.error(errors.map((e) => `FAIL ${e}`).join('\n')); process.exit(1); }
console.log('PASS repo checks');
