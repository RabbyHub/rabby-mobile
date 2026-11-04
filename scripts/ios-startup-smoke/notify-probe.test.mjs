import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { matrix } from './hosted.mjs';
import { validateProbeSource } from './probe.mjs';
import { createNotification, sendNotification } from './notify.mjs';
import { writeNotificationReport } from './notification-report.mjs';

// Unit evidence/formatting coverage and real Node summary/notification integration.
// Only HTTP is mocked; these transport fixtures do not prove native App startup.
const appCommit = 'a'.repeat(40);
const harnessCommit = 'd'.repeat(40);
const majors = '16,17,18,26,27';

function sourceFixture(type = 's3') {
  const source = {
    sourceType: 'artifact',
    repository: 'RabbyHub/rabby-mobile',
    runId: '123',
    runAttempt: '1',
    artifactId: '789',
    sourceCommit: appCommit,
    artifactName: `ios-startup-app-${appCommit}-1`,
    runConclusion: 'failure',
  };
  if (type === 's3') {
    Object.assign(source, {
      sourceType: 's3',
      archiveKey:
        '_private/rabby-mobile/ios-simulator/999-20261026125055/archive.json',
      archiveRunId: '999',
      archiveJobStartedAt: '20261026125055',
      runConclusion: 'unknown',
    });
  }
  return validateProbeSource(source);
}

function fixture({
  selected = majors,
  environment = 'mobile-local',
  type = 's3',
} = {}) {
  const source = sourceFixture(type);
  const rows = matrix(selected, '27.1', environment).include.map(
    ({ major, runtime, xcode }) => ({
      major,
      runtime,
      xcode,
      status: 'passed',
    }),
  );
  const report = {
    commit: appCommit,
    harnessCommit,
    mode: 'probe',
    environment,
    fullCoverage: rows.length === 5,
    passed: true,
    qualificationPassed: false,
    rows,
    artifactSource: structuredClone(source),
    buildXcode: 'Xcode 27.1\nBuild version 27A9275',
  };
  return {
    source,
    envelope: { schemaVersion: 1, runId: '456', runAttempt: '2', report },
    needs: Object.fromEntries(
      ['resolve', 'startup', 'summary'].map(name => [
        name,
        { result: 'success' },
      ]),
    ),
    env: {
      NOTIFICATION_MODE: 'probe',
      GITHUB_REPOSITORY: 'RabbyHub/rabby-mobile',
      GITHUB_SHA: harnessCommit,
      GITHUB_RUN_ID: '456',
      GITHUB_RUN_ATTEMPT: '2',
      GITHUB_REF_NAME: 'feat/new-test-harness',
      EXECUTION_ENVIRONMENT: environment,
      REQUESTED_MAJORS: selected,
    },
  };
}

function environment(input) {
  return {
    ...input.env,
    PROBE_SOURCE: JSON.stringify(input.source),
    STARTUP_NEEDS: JSON.stringify(input.needs),
    STARTUP_REPORT: JSON.stringify(input.envelope),
  };
}

function notification(input = fixture()) {
  return createNotification(environment(input));
}

function assertProbe(message) {
  assert.match(message.title, /Probe|复测|诊断/i);
  assert.doesNotMatch(message.title, /资格.*通过|源码.*通过|完整启动检查通过/);
}

function assertNotPassed(message) {
  assertProbe(message);
  assert.match(message.title, /未通过|未完成|缺少|未知/);
  assert.doesNotMatch(message.title, /完整.*通过|所选.*通过/);
}

test('full S3 Probe reports original App and current harness separately, never a new build or upload', () => {
  const input = fixture();
  const message = notification(input);
  assertProbe(message);
  assert.match(message.title, /通过/);
  const text = message.lines.join('\n');
  assert.ok(text.includes(appCommit));
  assert.ok(text.includes(harnessCommit));
  assert.ok(text.includes(input.source.archiveKey));
  assert.match(text, /123/);
  assert.ok(text.includes('/actions/runs/456/attempts/2'));
  assert.match(text, /27\.1/);
  assert.match(text, /不.*资格|不.*当前.*源码|诊断/);
  assert.doesNotMatch(text, /构建：成功|S3 归档：成功|上传：成功/);
  for (const row of input.envelope.report.rows) {
    assert.ok(
      message.lines.some(
        line =>
          line.includes(`iOS ${row.runtime}`) &&
          line.includes(row.xcode) &&
          line.includes('通过'),
      ),
    );
  }
});

test('GitHub artifact Probe preserves its failed producer and needs no S3 archive or build job', () => {
  const input = fixture({ type: 'artifact' });
  const message = notification(input);
  assertProbe(message);
  assert.match(message.title, /通过/);
  const text = message.lines.join('\n');
  assert.ok(text.includes(appCommit));
  assert.match(text, /123/);
  assert.match(text, /789/);
  assert.doesNotMatch(text, /私有归档 key：|构建：成功|S3 归档：成功/);
});

test('partial Probe stays diagnostic and is explicitly not full matrix coverage', () => {
  const input = fixture({ selected: '16,27' });
  const message = notification(input);
  assertProbe(message);
  assert.match(message.title, /部分|所选/);
  assert.match(message.lines.join('\n'), /部分|不是完整/);
  assert.equal(message.lines.filter(line => line.startsWith('iOS ')).length, 2);
  input.envelope.report.qualificationPassed = true;
  assertNotPassed(notification(input));
});

test('Startup-only inputs cannot override the archived App compiler or suppress Probe validation', () => {
  const input = fixture();
  input.env.BUILD_XCODE = '26.3';
  input.env.BUILD_ONLY = 'true';
  const message = notification(input);
  assertProbe(message);
  assert.match(message.title, /通过/);
  assert.match(message.lines.join('\n'), /App Xcode：Xcode 27\.1/);
  assert.equal(message.lines.filter(line => line.startsWith('iOS ')).length, 5);
  assert.doesNotMatch(message.title, /构建完成/);
  input.needs.startup.result = 'skipped';
  assertNotPassed(notification(input));
  delete input.envelope.report.buildXcode;
  assert.match(notification(input).lines.join('\n'), /App Xcode：未知/);
});

test('invalid or absent source stays unknown instead of assigning the harness SHA to the App', () => {
  const input = fixture();
  for (const source of [
    undefined,
    null,
    {},
    { ...input.source, repository: 'fork/rabby-mobile' },
    { ...input.source, runId: '0123' },
    { ...input.source, archiveKey: '../archive.json' },
    { ...input.source, archiveRunId: '998' },
    { ...input.source, relayArtifactId: '456' },
  ]) {
    const message = createNotification({
      ...environment(input),
      PROBE_SOURCE: JSON.stringify(source),
    });
    assertNotPassed(message);
    const text = message.lines.join('\n');
    assert.match(text, /App.*未知|App.*缺少/);
    assert.ok(
      text.includes(harnessCommit),
      'the harness still has a known identity',
    );
    assert.ok(
      !text.includes(appCommit),
      'unvalidated App identity must not be displayed',
    );
    assert.ok(
      !message.lines.some(
        line =>
          /App.*(?:commit|源码|来源)/i.test(line) &&
          line.includes(harnessCommit),
      ),
    );
  }
  assertNotPassed(
    createNotification({ ...environment(input), PROBE_SOURCE: '{' }),
  );
});

test('positive report cannot cross current run, App commit, harness commit, mode or source identity', () => {
  const mutations = [
    value => (value.runId = '123'),
    value => (value.report.commit = harnessCommit),
    value => (value.report.harnessCommit = appCommit),
    value => (value.report.mode = 'qualification'),
    value => (value.report.qualificationPassed = true),
    value => (value.report.environment = 'hosted'),
    value => (value.report.artifactSource.runId = '124'),
    value => (value.report.artifactSource.artifactId = '790'),
    value => (value.report.artifactSource.runAttempt = '2'),
    value =>
      (value.report.artifactSource.archiveKey =
        '_private/rabby-mobile/ios-simulator/998-20261026125055/archive.json'),
    value => (value.report.artifactSource.runConclusion = 'success'),
    value => delete value.report.artifactSource,
    value => delete value.report.harnessCommit,
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input.envelope);
    assertNotPassed(notification(input));
  }
});

test('Probe rejects missing, malformed or future evidence and identifies a retained earlier attempt', () => {
  const input = fixture();
  for (const evidence of [
    undefined,
    '',
    '{',
    'null',
    '[]',
    'x'.repeat(16385),
  ]) {
    assertNotPassed(
      createNotification({ ...environment(input), STARTUP_REPORT: evidence }),
    );
  }
  for (const attempt of ['0', '3', '1.5', '1\n', 1]) {
    input.envelope.runAttempt = attempt;
    assertNotPassed(notification(input));
  }
  input.envelope.runAttempt = '1';
  const message = notification(input);
  assertProbe(message);
  assert.match(message.title, /通过/);
  assert.match(message.lines.join('\n'), /证据.*第 1 次尝试/);
});

test('requested runtime, test Xcode, row status and aggregate flags stay fail-closed', () => {
  const mutations = [
    report => report.rows.pop(),
    report => report.rows.push({ ...report.rows[0] }),
    report => (report.rows[1] = { ...report.rows[0] }),
    report => (report.rows[0].runtime = '16.5'),
    report => (report.rows[0].xcode = '27.1'),
    report => (report.rows[0].status = 'success'),
    report => (report.fullCoverage = false),
    report => (report.passed = false),
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input.envelope.report);
    assertNotPassed(notification(input));
  }
  const hosted = fixture({ environment: 'hosted' });
  assert.match(notification(hosted).title, /通过/);
  hosted.envelope.report.rows.find(row => row.major === 18).runtime = '18.3.1';
  assertNotPassed(notification(hosted));
});

test('resolve, startup and summary must succeed even when stored rows passed', () => {
  for (const job of ['resolve', 'startup', 'summary']) {
    for (const result of ['failure', 'cancelled', 'skipped', 'unknown']) {
      const input = fixture();
      input.needs[job].result = result;
      assertNotPassed(notification(input));
    }
  }
  const input = fixture();
  input.needs.build = { result: 'success' };
  input.needs.archive = { result: 'success' };
  delete input.needs.resolve;
  assertNotPassed(notification(input));
});

test('a valid failed Probe report keeps passed and missing rows distinct without inferring an App crash', () => {
  const input = fixture();
  input.envelope.report.rows[0].status = 'failed-or-missing';
  input.envelope.report.passed = false;
  input.needs.startup.result = 'failure';
  input.needs.summary.result = 'failure';
  const message = notification(input);
  assertNotPassed(message);
  assert.match(message.lines.join('\n'), /iOS 16\.4.*未通过|iOS 16\.4.*缺失/);
  assert.match(message.lines.join('\n'), /iOS 17\.5.*通过/);
  assert.match(message.lines.join('\n'), /不等于 App 崩溃/);
});

test('Probe uses the existing sender protocol, not an alternate or network-connected test lane', async () => {
  const message = notification();
  let requests = 0;
  await sendNotification(message, {
    env: {
      LARK_CHAT_URL:
        'https://open.larksuite.com/open-apis/bot/v2/hook/synthetic-probe-only',
      LARK_CHAT_SECRET: 'synthetic-probe-secret',
    },
    fetchImpl: async (_url, options) => {
      requests++;
      assert.equal(options.redirect, 'error');
      const payload = JSON.parse(options.body);
      assert.equal(payload.msg_type, 'post');
      assert.equal(payload.content.post.zh_cn.title, message.title);
      assert.deepEqual(
        payload.content.post.zh_cn.content,
        message.lines.map(text => [{ tag: 'text', text }]),
      );
      return new Response('{"code":0}');
    },
  });
  assert.equal(requests, 1);
});

test('shared report writer preserves Probe source/harness identity and never upgrades qualification', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-probe-notify-writer-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = fixture();
  const output = path.join(directory, 'outputs');
  await writeNotificationReport(input.envelope.report, {
    ...input.env,
    GITHUB_OUTPUT: output,
  });
  const line = (await fs.readFile(output, 'utf8')).trim();
  assert.ok(line.startsWith('notification_report='));
  const envelope = JSON.parse(line.slice('notification_report='.length));
  assert.deepEqual(envelope, input.envelope);
  assert.match(
    createNotification({
      ...environment(input),
      STARTUP_REPORT: JSON.stringify(envelope),
    }).title,
    /通过/,
  );
});

test('shared report writer bounds Actions output and omits internal report details', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-probe-notify-bounds-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = fixture();
  const output = path.join(directory, 'outputs');
  const sentinel = 'synthetic-internal-build-log-not-for-notification';
  await writeNotificationReport(
    {
      ...input.envelope.report,
      buildMetadata: { log: sentinel },
      sourceProvenance: { details: sentinel },
      rows: input.envelope.report.rows.map(row => ({ ...row, log: sentinel })),
    },
    { ...input.env, GITHUB_OUTPUT: output },
  );
  assert.ok(!(await fs.readFile(output, 'utf8')).includes(sentinel));
  const oversizedOutput = path.join(directory, 'oversized-output');
  await assert.rejects(
    writeNotificationReport(
      { ...input.envelope.report, buildXcode: 'x'.repeat(16385) },
      { ...input.env, GITHUB_OUTPUT: oversizedOutput },
    ),
    /limit/i,
  );
  await assert.rejects(fs.stat(oversizedOutput), { code: 'ENOENT' });
});

test('real Probe summary exports success and failure through the shared notification contract offline', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-probe-notify-cli-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = fixture({ selected: '16' });
  const appDir = path.join(directory, 'ios-startup-app-receipt');
  const testDir = path.join(directory, 'ios-startup-probe-test-16/tests');
  await fs.mkdir(appDir);
  await fs.mkdir(testDir, { recursive: true });
  // Same bounded archive/receipt fixture as probe.test.mjs; not a native app.
  const archive = Buffer.from('offline archived app transport fixture');
  const metadata = {
    schemaVersion: 2,
    sourceCommit: appCommit,
    xcode: input.envelope.report.buildXcode,
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
      headCommit: appCommit,
      changedFiles: ['generated.css'],
    },
    producer: {
      repository: input.source.repository,
      runId: input.source.runId,
      runAttempt: input.source.runAttempt,
    },
  };
  await fs.writeFile(path.join(appDir, metadata.archive.file), archive);
  await fs.writeFile(
    path.join(appDir, 'metadata.json'),
    JSON.stringify(metadata),
  );
  const report = {
    commit: appCommit,
    sourceCommit: appCommit,
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
        testXcode: { version: '26.3' },
        status: 'passed',
      },
    ],
  };
  for (const passed of [true, false]) {
    await fs.writeFile(
      path.join(testDir, 'results.json'),
      JSON.stringify({ ...report, passed }),
    );
    const output = path.join(directory, `outputs-${passed}`);
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `globalThis.fetch = () => { process.stderr.write('FORBIDDEN NETWORK'); throw new Error('Network disabled'); };
       const { main } = await import(${JSON.stringify(
         new URL('./probe.mjs', import.meta.url).href,
       )});
       try { await main(JSON.parse(process.argv[1])); } catch (error) { console.error(error.message); process.exitCode = 1; }`,
        JSON.stringify(['summary', directory, '16', harnessCommit]),
      ],
      {
        encoding: 'utf8',
        timeout: 10000,
        env: {
          ...environment(input),
          GITHUB_OUTPUT: output,
          STARTUP_RESULT: passed ? 'success' : 'failure',
        },
      },
    );
    assert.equal(result.status, passed ? 0 : 1, result.stderr);
    assert.doesNotMatch(result.stderr, /FORBIDDEN NETWORK/);
    const line = (await fs.readFile(output, 'utf8'))
      .split('\n')
      .find(value => value.startsWith('notification_report='));
    assert.ok(
      line,
      'summary must publish notification evidence before returning failure',
    );
    const envelope = JSON.parse(line.slice('notification_report='.length));
    assert.equal(envelope.report.commit, appCommit);
    assert.equal(envelope.report.harnessCommit, harnessCommit);
    assert.equal(envelope.report.mode, 'probe');
    assert.equal(envelope.report.qualificationPassed, false);
    assert.equal(envelope.report.passed, passed);
    assert.equal(envelope.report.buildXcode, metadata.xcode);
    assert.deepEqual(envelope.report.artifactSource, input.source);
    input.envelope = envelope;
    input.needs.startup.result = passed ? 'success' : 'failure';
    input.needs.summary.result = passed ? 'success' : 'failure';
    const message = notification(input);
    assertProbe(message);
    if (passed) assert.match(message.title, /通过/);
    else assertNotPassed(message);
  }
});
