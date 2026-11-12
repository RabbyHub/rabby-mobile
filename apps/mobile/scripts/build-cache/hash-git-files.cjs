#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');

// Preserve the existing git ls-files text protocol, including core.quotePath,
// duplicate index entries, and quoted names which the shell did not unquote.
// Changing this to -z would change existing cache keys for those repositories.
function hashGitFiles(repoRoot, pathspecs) {
  if (typeof repoRoot !== 'string' || !repoRoot) {
    throw new Error('repository argument required');
  }
  const git = spawnSync('git', ['-C', repoRoot, 'ls-files', ...pathspecs], {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (git.error || git.status !== 0) {
    throw new Error('git ls-files failed');
  }

  const lines = [];
  let start = 0;
  for (let index = 0; index < git.stdout.length; index++) {
    if (git.stdout[index] === 10) {
      lines.push(git.stdout.subarray(start, index));
      start = index + 1;
    }
  }
  // sort also terminates a final unterminated line with a newline.
  if (start < git.stdout.length) lines.push(git.stdout.subarray(start));
  lines.sort(Buffer.compare); // LC_ALL=C sort: bytes, not JS UTF-16/locale order.

  const aggregate = createHash('sha256');
  const rootPrefix = Buffer.from(`${repoRoot}/`);
  const readBuffer = Buffer.allocUnsafe(1024 * 1024);
  for (const relativePath of lines) {
    if (!relativePath.length) continue;
    const file = Buffer.concat([rootPrefix, relativePath]);
    let stat;
    try {
      stat = fs.statSync(file); // Like shell -f, follow a symlink to its target.
    } catch (error) {
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) continue;
      throw new Error('file metadata failed');
    }
    if (!stat.isFile()) continue;

    const contents = createHash('sha256');
    let descriptor;
    try {
      descriptor = fs.openSync(file, 'r');
      if (!fs.fstatSync(descriptor).isFile()) {
        throw new Error('file changed while opening');
      }
      let bytes;
      while (
        (bytes = fs.readSync(
          descriptor,
          readBuffer,
          0,
          readBuffer.length,
          null,
        )) > 0
      ) {
        contents.update(readBuffer.subarray(0, bytes));
      }
    } catch {
      throw new Error('file read failed');
    } finally {
      if (descriptor !== undefined) fs.closeSync(descriptor);
    }

    aggregate.update(relativePath);
    aggregate.update(':');
    // shasum/sha256sum prefix an escaped filename's output with a backslash;
    // the old awk '{print $1}' retained that prefix as part of file_hash.
    if (file.includes(10) || file.includes(92)) aggregate.update('\\');
    aggregate.update(contents.digest('hex'));
    aggregate.update('\n');
  }
  return aggregate.digest('hex');
}

module.exports = { hashGitFiles };

if (require.main === module) {
  try {
    const [repoRoot, ...pathspecs] = process.argv.slice(2);
    // Never publish a partial/fallback digest when Git or a file read fails.
    process.stdout.write(`${hashGitFiles(repoRoot, pathspecs)}\n`);
  } catch {
    // Git diagnostics and filenames can contain private data. Keep stderr fixed.
    process.stderr.write('hash-git-files: unable to hash Git inputs\n');
    process.exitCode = 1;
  }
}
