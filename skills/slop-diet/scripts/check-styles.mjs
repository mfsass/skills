#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export function extractStyleBlocks(html) {
  return extractStyleBlocksWithLocations(html).map((block) => block.css);
}

function extractStyleBlocksWithLocations(html) {
  const mask = (text) => text.replace(/[^\r\n]/g, ' ');
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, mask);
  const withoutScripts = withoutComments.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, mask);
  return [...withoutScripts.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => ({
    css: match[1],
    offset: match.index + match[0].indexOf(match[1]),
  }));
}

export function loadPostcss(projectDirectory) {
  try {
    const requireFromProject = createRequire(path.join(path.resolve(projectDirectory), 'package.json'));
    return requireFromProject('postcss');
  } catch {
    return null;
  }
}

export function checkStyles({ files, projectDirectory }) {
  const observations = [];
  const postcss = loadPostcss(projectDirectory);
  if (!postcss) {
    return {
      status: 'Unknown',
      observations: files.map((file) => ({ file, status: 'Unknown', message: 'PostCSS is not available from the project directory.' })),
      limits: LIMITS,
    };
  }

  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch (error) {
      observations.push({ file, status: 'Unknown', message: `Cannot read input file: ${error.message}` });
      continue;
    }

    const isHtml = /\.html?$/i.test(file);
    const cssBlocks = isHtml ? extractStyleBlocksWithLocations(source) : [{ css: source, offset: 0 }];
    if (!cssBlocks.some((block) => block.css.trim())) {
      observations.push({ file, status: 'Unknown', message: isHtml ? 'No static style block contains CSS.' : 'CSS input is empty.' });
      continue;
    }

    let failure;
    for (const block of cssBlocks) {
      if (!block.css.trim()) continue;
      try {
        postcss.parse(block.css, { from: file });
      } catch (error) {
        const localLine = error.line ?? error.input?.line;
        const localColumn = error.column ?? error.input?.column;
        const prefix = source.slice(0, block.offset);
        const baseLine = (prefix.match(/\n/g) || []).length;
        const line = localLine ? baseLine + localLine : undefined;
        const column = localLine === 1 ? (prefix.length - prefix.lastIndexOf('\n') - 1) + (localColumn ?? 1) : localColumn;
        failure = {
          file,
          status: 'Fail',
          message: `${error.reason || error.message}${line ? ` at ${file}:${line}:${column ?? 1}` : ` in ${file}`}`,
          location: line ? { line, column: column ?? 1 } : undefined,
        };
        break;
      }
    }
    observations.push(failure ?? { file, status: 'Pass', message: `Parsed ${cssBlocks.length} CSS block${cssBlocks.length === 1 ? '' : 's'}.` });
  }

  const statuses = observations.map((item) => item.status);
  const status = statuses.includes('Fail') ? 'Fail' : statuses.includes('Unknown') ? 'Unknown' : 'Pass';
  return { status, observations, limits: LIMITS };
}

const LIMITS = [
  'HTML extraction supports static style blocks only.',
  'This check does not validate CSS that scripts generate or change at runtime.',
  'This check does not validate all HTML syntax or behavior.',
];

function usage() {
  return 'Usage: check-styles.mjs --project DIRECTORY INPUT.css|INPUT.html [INPUT.css|INPUT.html ...]';
}

const helpText = `Usage: check-styles.mjs --project DIRECTORY INPUT.css|INPUT.html [INPUT.css|INPUT.html ...]

Parse CSS files, or the static style blocks of HTML files, with the PostCSS found in the project directory.
Print a JSON report. This checks syntax only.
Exit 0: every input parsed (Pass).
Exit 1: a parse failed, or PostCSS is not installed in the project (status Unknown).
Exit 2: bad arguments or an unreadable input.
`;

export function parseArguments(args) {
  let projectDirectory;
  const files = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--project') {
      if (projectDirectory || !args[index + 1]) throw new Error(usage());
      projectDirectory = args[++index];
    } else if (args[index].startsWith('-')) {
      throw new Error(usage());
    } else {
      files.push(args[index]);
    }
  }
  if (!projectDirectory || files.length === 0) throw new Error(usage());
  for (const file of files) {
    if (!/\.css$|\.html?$/i.test(file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error(`Input must be an existing CSS or HTML file: ${file}`);
    }
  }
  if (!fs.existsSync(projectDirectory) || !fs.statSync(projectDirectory).isDirectory()) {
    throw new Error(`Project directory does not exist: ${projectDirectory}`);
  }
  return { projectDirectory, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).includes('--help')) { process.stdout.write(helpText); process.exit(0); }
    const result = checkStyles(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === 'Pass' ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
