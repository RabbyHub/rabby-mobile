#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const PLACEHOLDERS = {
  repo: '/__rabby_repo__',
  xcodeDeveloper: '/__rabby_xcode_developer__',
  xcodeApp: '/__rabby_xcode_app__',
  exportDir: '/__rabby_hashcheck_export__',
};

function normalizeAsmPaths(content, options = {}) {
  const replacements = [];
  const add = (from, to) => {
    if (from) replacements.push([from, to]);
  };

  add(options.repoRootAlt, PLACEHOLDERS.repo);
  add(options.repoRoot, PLACEHOLDERS.repo);
  add(options.developerDir, PLACEHOLDERS.xcodeDeveloper);
  add(options.exportDir, PLACEHOLDERS.exportDir);

  replacements.sort((a, b) => b[0].length - a[0].length);

  let result = content;
  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }

  // xcode-select can point at a different install than the one whose paths were
  // embedded in the binary. Normalize every Xcode app/developer path.
  result = result.replace(
    /\/Applications\/Xcode[^/\s"']*\.app\/Contents\/Developer/g,
    PLACEHOLDERS.xcodeDeveloper,
  );
  result = result.replace(
    /\/Applications\/Xcode[^/\s"']*\.app/g,
    PLACEHOLDERS.xcodeApp,
  );

  // The validation workspace is cloned under /tmp; macOS may resolve it as
  // /private/tmp in compiler output.
  result = result.replace(
    /\/(?:private\/)?tmp\/validate-rabby-mobile-[A-Za-z0-9._-]+/g,
    PLACEHOLDERS.repo,
  );

  return result;
}

function parseArgs(argv) {
  const file = argv[0];
  const options = {};

  if (!file || file === '-h' || file === '--help') {
    console.error(
      'Usage: normalize_asm_paths.js <asm-file> [--repo-root <path>] [--repo-root-alt <path>] [--developer-dir <path>] [--export-dir <path>]',
    );
    process.exit(file ? 0 : 1);
  }

  for (let i = 1; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--repo-root':
        options.repoRoot = value;
        break;
      case '--repo-root-alt':
        options.repoRootAlt = value;
        break;
      case '--developer-dir':
        options.developerDir = value;
        break;
      case '--export-dir':
        options.exportDir = value;
        break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }

  return { file, options };
}

function main() {
  const { file, options } = parseArgs(process.argv.slice(2));
  const content = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, normalizeAsmPaths(content, options));
}

if (require.main === module) {
  main();
}

module.exports = { normalizeAsmPaths, PLACEHOLDERS };
