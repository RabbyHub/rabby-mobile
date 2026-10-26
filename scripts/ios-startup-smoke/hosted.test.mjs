import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  matrix,
  buildRunner,
  localRunner,
  summarize,
  verifyArchive,
  validateReceipt,
} from './hosted.mjs';

const commit = 'a'.repeat(40);
function receipt() {
  return {
    schemaVersion: 2,
    sourceCommit: commit,
    platform: 'iphonesimulator',
    configuration: 'Regression',
    architectures: ['arm64'],
    executableSha256: 'b'.repeat(64),
    jsBundleSha256: 'c'.repeat(64),
    archive: {
      file: 'RabbyMobile-simulator.zip',
      bytes: 7,
      sha256: 'd'.repeat(64),
    },
    sourceProvenance: { status: 'clean', headCommit: commit, changedFiles: [] },
    producer: {
      repository: 'RabbyHub/rabby-mobile',
      runId: '123',
      runAttempt: '1',
    },
  };
}

test('pins hosted ARM64 targets, preserving iOS16 on Xcode26 and rejecting arbitrary inputs', () => {
  const rows = matrix('16,17,18,26,27', '27.1', 'hosted').include;
  assert.equal(rows.length, 5);
  assert.equal(rows[0].runner, 'macos-26');
  assert.equal(rows[0].xcode, '26.3');
  assert.equal(rows[4].runner, 'xcode-27');
  assert.throws(() => matrix('16,19', '26.3', 'hosted'));
  assert.throws(() => matrix('16', 'latest'));
});

test('defaults to mobile-local with App compiler27.1 and only iOS16 harness26.3', () => {
  const rows = matrix('16,17,18,26,27').include;
  assert.deepEqual(buildRunner('27.1'), [
    'self-hosted',
    'macOS',
    'ARM64',
    'mobile-local',
    'mobile-ios-simulator',
  ]);
  assert.deepEqual(
    rows.map(row => row.runtime),
    ['16.4', '17.5', '18.3.1', '26.2', '27.0'],
  );
  for (const row of rows) {
    assert.deepEqual(row.runner, localRunner);
    assert.equal(row.xcode, row.major === 16 ? '26.3' : '27.1');
    assert.equal(row.environment, 'mobile-local');
  }
  assert.throws(() => matrix('16', '26.3'), /mobile-local requires/);
  assert.throws(() => matrix('16', '27.1', 'auto'), /explicitly/);
  assert.equal(buildRunner('26.3', 'hosted'), 'macos-26');
  assert.equal(buildRunner('27.1', 'hosted'), 'xcode-27');
});

test('matrix CLI emits JSON runs-on values for both explicit execution environments', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-runner-matrix-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const environment of ['mobile-local', 'hosted']) {
    const output = path.join(directory, environment);
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./hosted.mjs', import.meta.url)),
        'matrix',
        '16,27',
        '27.1',
        environment,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_OUTPUT: output },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const outputs = Object.fromEntries(
      (await fs.readFile(output, 'utf8'))
        .trim()
        .split('\n')
        .map(line => {
          const index = line.indexOf('=');
          return [line.slice(0, index), JSON.parse(line.slice(index + 1))];
        }),
    );
    assert.deepEqual(outputs.build_runner, buildRunner('27.1', environment));
    assert.deepEqual(outputs.matrix, matrix('16,27', '27.1', environment));
  }
});

test('aggregate requires all requested versions and one identical commit/binary/JS receipt', () => {
  const metadata = receipt();
  const reports = matrix('16,17,18,26,27').include.map(target => ({
    commit,
    sourceCommit: commit,
    buildMetadata: metadata,
    harnessCommit: commit,
    mode: 'qualification',
    environment: 'mobile-local',
    appHash: metadata.executableSha256,
    jsHash: metadata.jsBundleSha256,
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
  const check = input => summarize('16,17,18,26,27', commit, metadata, input);
  assert.equal(check(reports).passed, true);
  assert.equal(
    check([
      {
        ...reports[0],
        results: [{ ...reports[0].results[0], testXcode: { version: '27.1' } }],
      },
      ...reports.slice(1),
    ]).passed,
    false,
  );
  const hostedReports = reports.map(report => ({
    ...report,
    environment: 'hosted',
    results: [
      {
        ...report.results[0],
        version: matrix('16,17,18,26,27', '27.1', 'hosted').include.find(
          target => target.major === report.results[0].major,
        ).runtime,
        testXcode: { version: report.results[0].major < 27 ? '26.3' : '27.1' },
      },
    ],
  }));
  assert.equal(
    summarize('16,17,18,26,27', commit, metadata, hostedReports, {
      environment: 'hosted',
    }).passed,
    true,
  );
  assert.equal(check(hostedReports).passed, false);
  assert.equal(check(reports.slice(1)).passed, false);
  assert.equal(check([...reports, reports[0]]).passed, false);
  for (const field of [
    'commit',
    'sourceCommit',
    'buildMetadata',
    'appHash',
    'jsHash',
    'environment',
  ]) {
    assert.equal(
      check([{ ...reports[0], [field]: 'drift' }, ...reports.slice(1)]).passed,
      false,
    );
  }
  assert.equal(
    summarize('16', commit, metadata, reports.slice(0, 1)).fullCoverage,
    false,
  );
  assert.equal(summarize('16', commit, undefined, []).passed, false);
  const probeReports = reports.map(report => ({
    ...report,
    mode: 'probe',
    qualificationPassed: false,
    harnessCommit: 'e'.repeat(40),
  }));
  const probe = summarize('16,17,18,26,27', commit, metadata, probeReports, {
    probe: true,
    harnessCommit: 'e'.repeat(40),
  });
  assert.equal(probe.passed, true);
  assert.equal(probe.qualificationPassed, false);
  assert.equal(check(probeReports).passed, false);
  assert.equal(
    summarize('16,17,18,26,27', commit, metadata, reports, { probe: true })
      .passed,
    false,
  );
});

test('transport verifies archive digest, bytes and source before extraction', async t => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-startup-archive-'),
  );
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const zip = Buffer.from('fixture');
  const metadata = {
    ...receipt(),
    archive: {
      file: 'RabbyMobile-simulator.zip',
      bytes: zip.length,
      sha256: createHash('sha256').update(zip).digest('hex'),
    },
  };
  await fs.writeFile(path.join(dir, metadata.archive.file), zip);
  await fs.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata));
  await verifyArchive(dir, commit);
  await assert.rejects(verifyArchive(dir, 'wrong'), /receipt/);
  await fs.appendFile(path.join(dir, metadata.archive.file), 'tamper');
  await assert.rejects(verifyArchive(dir, commit), /receipt/);
});

test('modified source artifacts require explicit probe and exact producer binding', () => {
  const metadata = receipt();
  metadata.sourceProvenance.status = 'modified';
  metadata.sourceProvenance.changedFiles = ['apps/mobile/generated.css'];
  assert.throws(() => validateReceipt(metadata, commit), /diagnostic-only/);
  validateReceipt(metadata, commit, {
    probe: true,
    producer: metadata.producer,
  });
  assert.throws(
    () =>
      validateReceipt(metadata, commit, {
        probe: true,
        producer: { ...metadata.producer, runId: '124' },
      }),
    /producer/,
  );
  metadata.sourceProvenance.status = 'clean';
  assert.throws(
    () => validateReceipt(metadata, commit, { probe: true }),
    /Inconsistent/,
  );
  assert.throws(
    () =>
      validateReceipt({ ...receipt(), schemaVersion: 1 }, commit, {
        probe: true,
      }),
    /receipt/,
  );
});
