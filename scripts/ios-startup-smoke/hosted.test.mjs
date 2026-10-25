import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { matrix, summarize, verifyArchive } from './hosted.mjs';

test('pins hosted ARM64 targets, preserving iOS16 on Xcode26 and rejecting arbitrary inputs', () => {
  const rows = matrix('16,17,18,26,27', '27.1').include;
  assert.equal(rows.length, 5);
  assert.equal(rows[0].runner, 'macos-26');
  assert.equal(rows[0].xcode, '26.3');
  assert.equal(rows[4].runner, 'xcode-27');
  assert.throws(() => matrix('16,19', '26.3'));
  assert.throws(() => matrix('16', 'latest'));
});

test('aggregate requires all requested versions and one identical commit/binary/JS receipt', () => {
  const metadata = {
    sourceCommit: 'commit',
    executableSha256: 'app',
    jsBundleSha256: 'js',
  };
  const reports = matrix('16,17,18,26,27', '26.3').include.map(target => ({
    commit: 'commit',
    appHash: 'app',
    jsHash: 'js',
    passed: true,
    results: [
      {
        major: target.major,
        version: target.runtime,
        testXcode: { version: target.xcode },
        status: 'passed',
      },
    ],
  }));
  const check = input => summarize('16,17,18,26,27', 'commit', metadata, input);
  assert.equal(check(reports).passed, true);
  assert.equal(check(reports.slice(1)).passed, false);
  assert.equal(check([...reports, reports[0]]).passed, false);
  for (const field of ['commit', 'appHash', 'jsHash']) {
    assert.equal(
      check([{ ...reports[0], [field]: 'drift' }, ...reports.slice(1)]).passed,
      false,
    );
  }
  assert.equal(
    summarize('16', 'commit', metadata, reports.slice(0, 1)).fullCoverage,
    false,
  );
  assert.equal(summarize('16', 'commit', undefined, []).passed, false);
});

test('transport verifies archive digest, bytes and source before extraction', async t => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-startup-archive-'),
  );
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const zip = Buffer.from('fixture');
  const metadata = {
    sourceCommit: 'commit',
    platform: 'iphonesimulator',
    configuration: 'Regression',
    archive: {
      file: 'RabbyMobile-simulator.zip',
      bytes: zip.length,
      sha256: createHash('sha256').update(zip).digest('hex'),
    },
  };
  await fs.writeFile(path.join(dir, metadata.archive.file), zip);
  await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata));
  await verifyArchive(dir, 'commit');
  await assert.rejects(verifyArchive(dir, 'wrong'), /receipt/);
  await fs.appendFile(path.join(dir, metadata.archive.file), 'tamper');
  await assert.rejects(verifyArchive(dir, 'commit'), /receipt/);
});
