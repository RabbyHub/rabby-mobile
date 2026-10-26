import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { selectSource, verifyProbeArchive } from './probe.mjs';

function fixture() {
  const sha = 'a'.repeat(40);
  const run = {
    id: 123,
    status: 'completed',
    conclusion: 'failure',
    run_attempt: 2,
    path: '.github/workflows/ios_simulator_startup.yml',
    event: 'push',
    head_sha: sha,
    repository: { id: 456, full_name: 'RabbyHub/rabby-mobile' },
    head_repository: { id: 456, full_name: 'RabbyHub/rabby-mobile' },
  };
  const artifact = {
    id: 789,
    expired: false,
    name: `ios-startup-app-${sha}-1`,
    workflow_run: {
      id: 123,
      head_sha: sha,
      repository_id: 456,
      head_repository_id: 456,
    },
  };
  return { run, artifact };
}

test('selects exact immutable artifact, including a retained earlier failed attempt', () => {
  const { run, artifact } = fixture();
  const source = selectSource(artifact, run, '123', '789');
  assert.equal(source.runConclusion, 'failure');
  assert.equal(source.runAttempt, '1');
  assert.equal(source.artifactId, '789');
  assert.equal(source.sourceCommit, run.head_sha);
});

test('rejects expired, foreign, wrong-workflow, ambiguous or drifted artifact selections', () => {
  const mutations = [
    f => {
      f.artifact.expired = true;
    },
    f => {
      f.run.status = 'in_progress';
    },
    f => {
      f.run.path = '.github/workflows/feature_test.yml';
    },
    f => {
      f.run.event = 'pull_request';
    },
    f => {
      f.run.repository.full_name = 'other/repo';
    },
    f => {
      f.run.head_repository.full_name = 'fork/repo';
    },
    f => {
      f.run.head_repository.id = 999;
    },
    f => {
      delete f.run.run_attempt;
    },
    f => {
      f.run.run_attempt = '2';
    },
    f => {
      f.artifact.workflow_run.id = 999;
    },
    f => {
      f.artifact.workflow_run.head_repository_id = 999;
    },
    f => {
      f.artifact.workflow_run.head_sha = 'b'.repeat(40);
    },
    f => {
      f.artifact.name = `ios-startup-app-${f.run.head_sha}`;
    },
    f => {
      f.artifact.name = `ios-startup-app-${f.run.head_sha}-3`;
    },
    f => {
      f.artifact.id = 790;
    },
    f => {
      f.run.id = 124;
    },
  ];
  for (const mutate of mutations) {
    const f = fixture();
    mutate(f);
    assert.throws(() => selectSource(f.artifact, f.run, '123', '789'));
  }
  const f = fixture();
  for (const value of [
    'latest',
    '../123',
    '123\nartifact=evil',
    '123\n',
    '0',
    '-1',
    '99999999999999999999',
  ])
    assert.throws(() => selectSource(f.artifact, f.run, value, '789'));
});

test('probe verifies the original producer and reports a new harness without qualifying modified source', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-artifact-probe-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { run, artifact } = fixture();
  const source = selectSource(artifact, run, '123', '789');
  const appDir = path.join(directory, 'ios-startup-app-receipt');
  await fs.mkdir(appDir);
  // A transport fixture, not a real app or a native launch claim.
  const archive = Buffer.from('simulator archive transport fixture');
  const metadata = {
    schemaVersion: 2,
    sourceCommit: run.head_sha,
    xcode: 'Xcode 26.3',
    platform: 'iphonesimulator',
    configuration: 'Regression',
    architectures: ['arm64'],
    executableSha256: 'b'.repeat(64),
    jsBundleSha256: 'c'.repeat(64),
    archive: {
      file: 'RabbyMobile-simulator.zip',
      bytes: archive.length,
      sha256: createHash('sha256').update(archive).digest('hex'),
    },
    sourceProvenance: {
      status: 'modified',
      headCommit: run.head_sha,
      changedFiles: ['generated.css'],
    },
    producer: {
      repository: source.repository,
      runId: source.runId,
      runAttempt: source.runAttempt,
    },
  };
  await fs.writeFile(path.join(appDir, metadata.archive.file), archive);
  await fs.writeFile(
    path.join(appDir, 'metadata.json'),
    JSON.stringify(metadata),
  );
  await verifyProbeArchive(appDir, source);
  for (const field of ['repository', 'runId', 'runAttempt'])
    await assert.rejects(
      verifyProbeArchive(appDir, { ...source, [field]: 'wrong' }),
      /producer/,
    );
  const harnessCommit = 'd'.repeat(40);
  const report = {
    commit: source.sourceCommit,
    sourceCommit: source.sourceCommit,
    harnessCommit,
    mode: 'probe',
    qualificationPassed: false,
    passed: true,
    buildMetadata: metadata,
    appHash: metadata.executableSha256,
    jsHash: metadata.jsBundleSha256,
    results: [
      {
        major: 16,
        version: '16.4',
        testXcode: { version: '26.3' },
        status: 'passed',
      },
    ],
  };
  const testDir = path.join(directory, 'ios-startup-probe-test-16/tests');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(
    path.join(testDir, 'results.json'),
    JSON.stringify(report),
  );
  const summarize = () =>
    spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./probe.mjs', import.meta.url)),
        'summary',
        directory,
        '16',
        harnessCommit,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PROBE_SOURCE: JSON.stringify(source),
          STARTUP_RESULT: 'success',
          GITHUB_STEP_SUMMARY: '',
        },
      },
    );
  const success = summarize();
  assert.equal(success.status, 0, success.stderr);
  const result = JSON.parse(
    await fs.readFile(path.join(directory, 'summary.json'), 'utf8'),
  );
  assert.equal(result.passed, true);
  assert.equal(result.qualificationPassed, false);
  assert.equal(result.fullCoverage, false);
  assert.equal(result.harnessCommit, harnessCommit);
  assert.equal(result.artifactSource.artifactId, '789');
  assert.match(success.stdout, /diagnostic only/);
  await fs.writeFile(
    path.join(testDir, 'results.json'),
    JSON.stringify({ ...report, harnessCommit: run.head_sha }),
  );
  assert.notEqual(summarize().status, 0);
  await fs.appendFile(path.join(appDir, metadata.archive.file), 'tamper');
  await assert.rejects(verifyProbeArchive(appDir, source), /receipt/);
});

test('probe workflow has no Rabby build and consumes only an explicitly selected artifact', async () => {
  const workflow = await fs.readFile(
    new URL('../../.github/workflows/ios_simulator_probe.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /source_run_id:/);
  assert.match(workflow, /source_artifact_id:/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /artifact-ids:.*artifactId/);
  assert.match(workflow, /run-id:.*runId/);
  assert.doesNotMatch(
    workflow,
    /build-ios-simulator|deploy-ios|pod install|yarn install|bundle install|self-hosted/,
  );
  const producer = await fs.readFile(
    new URL(
      '../../.github/workflows/ios_simulator_startup.yml',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(
    producer,
    /name: ios-startup-app-\$\{\{ github.sha \}\}-\$\{\{ github.run_attempt \}\}\s+retention-days: 30/,
  );
  assert.doesNotMatch(producer, /feat\/ios-simulator-startup-ci/);
  assert.match(producer, /'publish\/\*'/);
});
