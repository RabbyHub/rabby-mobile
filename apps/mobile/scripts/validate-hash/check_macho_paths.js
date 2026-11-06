#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const CANONICAL_XCODE_DEVELOPER = '/Applications/Xcode.app/Contents/Developer';
const XCODE_PATH_RE = /\/Applications\/Xcode[^\0\s"']*/g;

function findEmbeddedXcodePaths(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return [...buffer.toString('latin1').matchAll(XCODE_PATH_RE)].map(
    match => match[0],
  );
}

/**
 * Framework binaries are hashed intact. Xcode may be installed as Xcode.app
 * or Xcode-<version>.app, so require every embedded Xcode path to use the
 * canonical install path; a rebuilt framework with another path fails closed.
 */
function assertCanonicalXcodePaths(input) {
  for (const xcodePath of findEmbeddedXcodePaths(input)) {
    if (
      !xcodePath.startsWith(`${CANONICAL_XCODE_DEVELOPER}/`) &&
      xcodePath !== CANONICAL_XCODE_DEVELOPER
    ) {
      throw new Error(
        'framework embeds a non-canonical Xcode path; rebuild it with /Applications/Xcode.app',
      );
    }
  }
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: check_macho_paths.js <macho-file>');
    process.exit(1);
  }
  try {
    assertCanonicalXcodePaths(fs.readFileSync(file));
  } catch (error) {
    console.error(`${error.message}: ${file}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertCanonicalXcodePaths,
  findEmbeddedXcodePaths,
  CANONICAL_XCODE_DEVELOPER,
};
