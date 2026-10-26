import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  selectSource,
  validateProbeSource,
  verifyProbeArchive,
} from './probe.mjs';

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
  assert.equal(source.sourceType, 'artifact');
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
  for (const field of ['repository', 'runId', 'runAttempt']) {
    await fs.writeFile(
      path.join(appDir, 'metadata.json'),
      JSON.stringify({
        ...metadata,
        producer: { ...metadata.producer, [field]: 'wrong' },
      }),
    );
    await assert.rejects(verifyProbeArchive(appDir, source), /producer/);
  }
  await fs.writeFile(
    path.join(appDir, 'metadata.json'),
    JSON.stringify(metadata),
  );
  const harnessCommit = 'd'.repeat(40);
  const report = {
    commit: source.sourceCommit,
    sourceCommit: source.sourceCommit,
    harnessCommit,
    mode: 'probe',
    environment: 'mobile-local',
    qualificationPassed: false,
    passed: true,
    buildMetadata: metadata,
    appHash: metadata.executableSha256,
    jsHash: metadata.jsBundleSha256,
    results: [
      {
        major: 16,
        version: '16.4',
        testXcode: { version: '27.1' },
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
          EXECUTION_ENVIRONMENT: 'mobile-local',
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

function s3Source() {
  const { run, artifact } = fixture();
  const source = selectSource(artifact, run, '123', '789');
  return {
    ...source,
    sourceType: 's3',
    archiveKey: `_private/rabby-mobile/ios-simulator/${source.sourceCommit}/123/1/archive.json`,
    runConclusion: 'unknown',
  };
}

test('source discriminator is strict while old resolved GitHub selections remain compatible', () => {
  const { run, artifact } = fixture();
  const source = selectSource(artifact, run, '123', '789');
  const { sourceType: _type, ...legacy } = source;
  assert.deepEqual(validateProbeSource(legacy), source);
  assert.deepEqual(validateProbeSource(s3Source()), s3Source());
  for (const invalid of [
    null,
    [],
    { ...source, sourceType: 'latest' },
    { ...source, runId: 123 },
    { ...source, runAttempt: '01' },
    { ...source, artifactId: '0' },
    { ...source, sourceCommit: [source.sourceCommit] },
    { ...source, sourceCommit: source.sourceCommit + '\n' },
    { ...source, repository: 'fork/rabby-mobile' },
    { ...source, artifactName: 'latest' },
    { ...source, runConclusion: 'unknown' },
    { ...source, archiveKey: s3Source().archiveKey },
    { ...s3Source(), archiveKey: '../archive.json' },
    { ...s3Source(), runId: '124' },
    { ...s3Source(), sourceCommit: 'e'.repeat(40) },
    { ...s3Source(), artifactName: `ios-startup-app-${source.sourceCommit}-2` },
    { ...s3Source(), runConclusion: 'success' },
    { ...s3Source(), relayArtifactId: '999' },
  ])
    assert.throws(() => validateProbeSource(invalid));
});

// Real CLI/filesystem coverage. Intercept fetch in the child so a future
// accidental GitHub lookup fails the test without making a network request.
function offlineCli(args, environment = {}, fixtures = {}) {
  const moduleUrl = new URL('./probe.mjs', import.meta.url).href;
  return spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const fixtures = ${JSON.stringify(fixtures)};
       const seen = new Set();
       let unexpected = false;
       globalThis.fetch = async url => {
         if (!Object.hasOwn(fixtures, url) || seen.has(url)) {
           unexpected = true;
           throw new Error('Network forbidden in offline probe test');
         }
         seen.add(url);
         return { ok: true, json: async () => fixtures[url] };
       };
       process.on('exit', () => {
         if (unexpected || seen.size !== Object.keys(fixtures).length) process.exitCode = 71;
       });
       const { main } = await import(${JSON.stringify(moduleUrl)});
       await main(JSON.parse(process.argv[1]));`,
      JSON.stringify(args),
    ],
    {
      encoding: 'utf8',
      timeout: 30000,
      env: {
        ...process.env,
        GITHUB_TOKEN: '',
        GH_TOKEN: '',
        PROBE_SOURCE: '',
        GITHUB_STEP_SUMMARY: '',
        EXECUTION_ENVIRONMENT: 'mobile-local',
        ...environment,
      },
    },
  );
}

test('GitHub resolution preserves original identity and emits separate transport IDs', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-probe-resolve-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { artifact, run } = fixture();
  const output = path.join(directory, 'outputs');
  const result = offlineCli(
    ['resolve'],
    {
      GITHUB_OUTPUT: output,
      GITHUB_TOKEN: 'test-fixture-not-a-real-token',
      SOURCE_RUN_ID: '123',
      SOURCE_ARTIFACT_ID: '789',
      REQUESTED_MAJORS: '18',
    },
    {
      'https://api.github.com/repos/RabbyHub/rabby-mobile/actions/artifacts/789':
        artifact,
      'https://api.github.com/repos/RabbyHub/rabby-mobile/actions/runs/123':
        run,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const values = Object.fromEntries(
    (await fs.readFile(output, 'utf8'))
      .trim()
      .split('\n')
      .map(line => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  assert.equal(values.artifact_id, '789');
  assert.equal(values.artifact_run_id, '123');
  assert.deepEqual(
    JSON.parse(values.source),
    selectSource(artifact, run, '123', '789'),
  );
  assert.equal(JSON.parse(values.matrix).include[0].runtime, '18.3.1');
});

test('matrix-only CLI needs neither a source nor GitHub and preserves the selected environment', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-probe-matrix-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const originalEnvironment = { ...process.env };
  for (const environment of ['mobile-local', 'hosted']) {
    const output = path.join(directory, environment);
    const result = offlineCli(['matrix'], {
      GITHUB_OUTPUT: output,
      REQUESTED_MAJORS: '18',
      EXECUTION_ENVIRONMENT: environment,
    });
    assert.equal(result.status, 0, result.stderr);
    const lines = (await fs.readFile(output, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 1);
    assert.ok(lines[0].startsWith('matrix='));
    const selected = JSON.parse(lines[0].slice('matrix='.length));
    assert.equal(selected.include.length, 1);
    assert.equal(selected.include[0].environment, environment);
    assert.equal(
      selected.include[0].runtime,
      environment === 'hosted' ? '18.5' : '18.3.1',
    );
  }
  assert.deepEqual({ ...process.env }, originalEnvironment);
});

test('S3 probe verifies and summarizes an archived original producer entirely offline, never the relay', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rabby-s3-probe-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const originalEnvironment = { ...process.env };
  const source = s3Source();
  const appDir = path.join(directory, 'ios-startup-app-receipt');
  await fs.mkdir(appDir);
  const archive = Buffer.from('offline archived app transport fixture');
  const metadata = {
    schemaVersion: 2,
    sourceCommit: source.sourceCommit,
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
      headCommit: source.sourceCommit,
      changedFiles: ['generated.css'],
    },
    producer: {
      repository: source.repository,
      runId: source.runId,
      runAttempt: source.runAttempt,
    },
  };
  const metadataFile = path.join(appDir, 'metadata.json');
  await fs.writeFile(path.join(appDir, metadata.archive.file), archive);
  await fs.writeFile(metadataFile, JSON.stringify(metadata));
  const env = {
    PROBE_SOURCE: JSON.stringify(source),
    // This current workflow run only transports the old app. It did not build it.
    GITHUB_RUN_ID: '999',
    GITHUB_RUN_ATTEMPT: '8',
    STARTUP_RESULT: 'success',
  };
  const verified = offlineCli(['verify', appDir], env);
  assert.equal(verified.status, 0, verified.stderr);
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(appDir, 'probe-source.json'), 'utf8'),
    ),
    source,
  );
  const harnessCommit = 'd'.repeat(40);
  const report = {
    commit: source.sourceCommit,
    sourceCommit: source.sourceCommit,
    harnessCommit,
    mode: 'probe',
    environment: 'mobile-local',
    qualificationPassed: false,
    passed: true,
    buildMetadata: metadata,
    appHash: metadata.executableSha256,
    jsHash: metadata.jsBundleSha256,
    results: [
      {
        major: 18,
        version: '18.3.1',
        testXcode: { version: '27.1' },
        status: 'passed',
      },
    ],
  };
  const testDir = path.join(directory, 'ios-startup-probe-test-18/tests');
  await fs.mkdir(testDir, { recursive: true });
  await fs.writeFile(
    path.join(testDir, 'results.json'),
    JSON.stringify(report),
  );
  const summary = offlineCli(['summary', directory, '18', harnessCommit], env);
  assert.equal(summary.status, 0, summary.stderr);
  const result = JSON.parse(
    await fs.readFile(path.join(directory, 'summary.json'), 'utf8'),
  );
  assert.equal(result.passed, true);
  assert.equal(result.qualificationPassed, false);
  assert.equal(result.fullCoverage, false);
  assert.equal(result.harnessCommit, harnessCommit);
  assert.deepEqual(result.artifactSource, source);
  assert.match(summary.stdout, /Storage: S3 archive/);
  assert.ok(summary.stdout.includes(`Archive key: ${source.archiveKey}`));
  assert.match(summary.stdout, /build run: 123; attempt: 1; artifact: 789/);
  assert.match(summary.stdout, /original run: unknown/);
  assert.match(summary.stdout, /diagnostic only/);
  assert.doesNotMatch(summary.stdout, /artifact: 999/);

  await fs.writeFile(
    metadataFile,
    JSON.stringify({
      ...metadata,
      producer: { ...metadata.producer, runId: '999', runAttempt: '8' },
    }),
  );
  const relay = offlineCli(['verify', appDir], env);
  assert.notEqual(relay.status, 0);
  assert.match(relay.stderr, /producer/);
  await fs.writeFile(metadataFile, JSON.stringify(metadata));
  const invalidSelection = offlineCli(['verify', appDir], {
    ...env,
    PROBE_SOURCE: JSON.stringify({ ...source, runId: '999' }),
  });
  assert.notEqual(invalidSelection.status, 0);
  await fs.appendFile(path.join(appDir, metadata.archive.file), 'tamper');
  const corrupt = offlineCli(['summary', directory, '18', harnessCommit], env);
  assert.notEqual(corrupt.status, 0);
  assert.match(corrupt.stderr, /receipt/);
  assert.deepEqual({ ...process.env }, originalEnvironment);
});

test('probe workflow has no Rabby build and consumes only an explicitly selected artifact', async () => {
  const workflow = await fs.readFile(
    new URL('../../.github/workflows/ios_simulator_probe.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /source_run_id:/);
  assert.match(workflow, /source_artifact_id:/);
  assert.match(workflow, /actions: read/);
  assert.equal(
    [
      ...workflow.matchAll(
        /artifact-ids: \$\{\{ needs\.resolve\.outputs\.artifact_id \}\}/g,
      ),
    ].length,
    2,
  );
  assert.equal(
    [
      ...workflow.matchAll(
        /run-id: \$\{\{ needs\.resolve\.outputs\.artifact_run_id \}\}/g,
      ),
    ].length,
    2,
  );
  assert.doesNotMatch(
    workflow,
    /build-ios-simulator|deploy-ios|pod install|yarn install|bundle install/,
  );
  assert.doesNotMatch(
    workflow,
    /\n  push:|40200867375|12603038211|feat\/ios-simulator-startup-ci/,
  );
  assert.match(workflow, /execution_environment:/);
  assert.match(workflow, /default: 'mobile-local'/);
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
  for (const source of [producer, workflow]) {
    assert.match(source, /path: \.ios-simulator-ci\s+clean: false/);
    assert.match(source, /working-directory: \.ios-simulator-ci/);
    assert.match(source, /'rabby-ios-simulator-mobile-local'/);
    assert.match(source, /cancel-in-progress: false\s+queue: max/);
    assert.match(source, /max-parallel:.*1 \|\| 5/);
    assert.match(source, /provision_args\+=\(--check-only\)/);
    assert.match(source, /--execution-environment "\$EXECUTION_ENVIRONMENT"/);
    assert.doesNotMatch(
      source,
      /git clean|git reset --hard|shutdown all|xcode-select -s/,
    );
    for (const setup of source.matchAll(
      /- uses: maxim-lobanov\/setup-xcode[^\n]*\n([^]*?)(?=\n      -|$)/g,
    ))
      assert.match(setup[1], /if:.*== 'hosted'/);
  }
  assert.match(producer, /toolchain\.mjs "\$BUILD_XCODE" --build/);
  assert.match(
    producer,
    /ruby\/setup-ruby[^\n]*\n\s+if: inputs.execution_environment == 'hosted'/,
  );
});
