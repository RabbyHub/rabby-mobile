#!/usr/bin/env node
/**
 * Compare two attest.json files produced by two independent builders.
 *
 * Exit code 0 means: same toolchain, same normalization list, same hashes.
 */
import fs from 'node:fs';

const [aPath, bPath] = process.argv.slice(2);
if (!aPath || !bPath) {
  console.error('usage: compare.mjs <attest-a.json> <attest-b.json>');
  process.exit(2);
}

const a = JSON.parse(fs.readFileSync(aPath, 'utf8'));
const b = JSON.parse(fs.readFileSync(bPath, 'utf8'));

const failures = [];
const notes = [];

function compare(label, left, right) {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    failures.push(
      `${label}\n    A: ${JSON.stringify(left)}\n    B: ${JSON.stringify(
        right,
      )}`,
    );
  }
}

compare('platform', a.platform, b.platform);
compare('channel', a.channel, b.channel);
compare('commit', a.commit, b.commit);
compare('normalization', a.normalization, b.normalization);

// Paths are expected to differ (Xcode/SDK installation paths); everything else
// in the toolchain fingerprint must match.
const toolchainKeys = new Set([
  ...Object.keys(a.toolchain || {}),
  ...Object.keys(b.toolchain || {}),
]);
for (const key of toolchainKeys) {
  compare(`toolchain.${key}`, a.toolchain?.[key], b.toolchain?.[key]);
}

if (a.artifact || b.artifact) {
  compare('artifact.sha256', a.artifact?.sha256, b.artifact?.sha256);
  compare('artifact.size', a.artifact?.size, b.artifact?.size);
  compare(
    'artifact.bundle.sha256',
    a.artifact?.bundle?.sha256,
    b.artifact?.bundle?.sha256,
  );
}
if (a.tree || b.tree) {
  compare('tree.sha256', a.tree?.tree_sha256, b.tree?.tree_sha256);
  compare('tree.file_count', a.tree?.file_count, b.tree?.file_count);
}

if (a.builder?.host !== b.builder?.host) {
  notes.push(
    `built on different machines: ${a.builder?.host} vs ${b.builder?.host}`,
  );
}

if (failures.length) {
  console.error(`MISMATCH (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('MATCH');
for (const note of notes) console.log(`  note: ${note}`);
console.log(`  artifact: ${a.artifact?.sha256 || a.tree?.tree_sha256}`);
console.log(
  `  normalization: ${
    a.normalization.length ? a.normalization.join(', ') : 'none'
  }`,
);
