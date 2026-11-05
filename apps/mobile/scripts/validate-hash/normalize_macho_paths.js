#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const PATH_REPLACEMENTS = [
  {
    // Xcode can be installed as Xcode.app or Xcode-<version>.app.
    pattern: /\/Applications\/Xcode[^\0\s"']*/g,
    token: '/__rabby_xcode__',
  },
  {
    // Build-machine user paths can appear in compiler/debug strings.
    pattern: /\/Users\/[^\0\s"']*/g,
    token: '/__rabby_user__',
  },
  {
    // Validation worktree paths can appear in compiler strings.
    pattern: /\/(?:private\/)?tmp\/validate-rabby-mobile-[^\0\s"']*/g,
    token: '/__rabby_repo__',
  },
];

/**
 * Normalize only known volatile absolute paths in a Mach-O binary while
 * preserving every other byte. The replacement is padded/truncated to the
 * original path length so section sizes, load commands and data stay intact.
 */
function normalizeMachoPaths(input) {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let text = source.toString('latin1');

  for (const { pattern, token } of PATH_REPLACEMENTS) {
    text = text.replace(pattern, match =>
      token.padEnd(match.length, ' ').slice(0, match.length),
    );
  }

  const output = Buffer.from(text, 'latin1');
  if (output.length !== source.length) {
    throw new Error('normalized Mach-O path length changed');
  }
  return output;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: normalize_macho_paths.js <macho-file>');
    process.exit(1);
  }

  const input = fs.readFileSync(file);
  const output = normalizeMachoPaths(input);
  if (!output.equals(input)) {
    fs.writeFileSync(file, output);
  }
}

if (require.main === module) {
  main();
}

module.exports = { normalizeMachoPaths };
