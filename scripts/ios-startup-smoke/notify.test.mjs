import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { matrix } from './hosted.mjs';
import { createNotification, sendNotification } from './notify.mjs';

// Unit coverage of evidence/presentation and the true HTTP boundary, plus
// Node CLI integration with the real summary owner. No native/App claim.
const commit = 'a'.repeat(40);
const majors = '16,17,18,26,27';
const archiveKey =
  '_private/rabby-mobile/ios-simulator/123-20261026123456/archive.json';
const webhook =
  'https://open.larksuite.com/open-apis/bot/v2/hook/synthetic-test-only';
const secret = 'synthetic-secret-never-a-real-credential';
const notifyCLI = fileURLToPath(new URL('./notify.mjs', import.meta.url));
const hostedCLI = fileURLToPath(new URL('./hosted.mjs', import.meta.url));

function fixture({ selected = majors, environment = 'mobile-local' } = {}) {
  const rows = matrix(selected, '27.1', environment).include.map(
    ({ major, runtime, xcode }) => ({
      major,
      runtime,
      xcode,
      status: 'passed',
    }),
  );
  const envelope = {
    schemaVersion: 1,
    runId: '123',
    runAttempt: '2',
    report: {
      commit,
      mode: 'qualification',
      environment,
      fullCoverage: rows.length === 5,
      passed: true,
      qualificationPassed: rows.length === 5,
      rows,
    },
  };
  const needs = Object.fromEntries(
    ['matrix', 'build', 'startup', 'summary', 'archive'].map(name => [
      name,
      { result: 'success' },
    ]),
  );
  needs.archive.outputs = { archive_key: archiveKey };
  const env = {
    GITHUB_REPOSITORY: 'RabbyHub/rabby-mobile',
    GITHUB_SHA: commit,
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_REF_NAME: 'feat/ios-simulator-startup-ci',
    EXECUTION_ENVIRONMENT: environment,
    BUILD_XCODE: '27.1',
    REQUESTED_MAJORS: selected,
    BUILD_ONLY: 'false',
  };
  return { env, envelope, needs };
}

function notification(input = fixture()) {
  return createNotification({
    ...input.env,
    STARTUP_REPORT: JSON.stringify(input.envelope),
    STARTUP_NEEDS: JSON.stringify(input.needs),
  });
}

function assertNotPassed(message) {
  assert.doesNotMatch(message.title, /完整启动检查通过|所选版本通过/);
  assert.match(message.title, /未通过|未完成|未验证/);
}

function safeError(error) {
  assert.ok(error instanceof Error);
  assert.doesNotMatch(
    error.message,
    /synthetic-test-only|synthetic-secret|upstream-secret-detail|open\.larksuite\.com|open\.feishu\.cn/,
  );
  assert.ok(error.message.length < 200);
  return true;
}

test('complete valid evidence names all exact local runtimes, toolchains and source/run links', () => {
  const input = fixture();
  const message = notification(input);
  assert.match(message.title, /完整启动检查通过/);
  for (const row of input.envelope.report.rows) {
    assert.ok(
      message.lines.some(
        line =>
          line.includes(`iOS ${row.runtime}`) &&
          line.includes(`Xcode ${row.xcode}`) &&
          line.includes('通过（两次冷启动）'),
      ),
    );
  }
  const text = message.lines.join('\n');
  assert.ok(
    text.includes(`https://github.com/RabbyHub/rabby-mobile/commit/${commit}`),
  );
  assert.ok(
    text.includes(
      'https://github.com/RabbyHub/rabby-mobile/actions/runs/123/attempts/2',
    ),
  );
  assert.ok(text.includes(archiveKey));
  assert.match(text, /mobile-local.*27\.1/);
});

test('defaults preserve the declared matrix, while hosted evidence uses its own exact runtime/toolchain', () => {
  const local = fixture();
  for (const name of [
    'EXECUTION_ENVIRONMENT',
    'BUILD_XCODE',
    'REQUESTED_MAJORS',
  ]) {
    delete local.env[name];
  }
  assert.match(notification(local).title, /完整启动检查通过/);
  const hosted = fixture({ environment: 'hosted' });
  assert.match(notification(hosted).title, /完整启动检查通过/);
  const text = notification(hosted).lines.join('\n');
  assert.match(text, /iOS 18\.5 · 测试 Xcode 26\.3/);
  hosted.envelope.report.rows.find(row => row.major === 18).runtime = '18.3.1';
  assertNotPassed(notification(hosted));
});

test('successful manual subset is explicitly partial, never full qualification', () => {
  const input = fixture({ selected: '16,27' });
  const message = notification(input);
  assert.match(message.title, /部分覆盖/);
  assert.doesNotMatch(message.title, /完整启动检查通过/);
  assert.match(message.lines.join('\n'), /不是完整启动验收/);
  assert.equal(message.lines.filter(line => line.startsWith('iOS ')).length, 2);
  input.envelope.report.qualificationPassed = true;
  assertNotPassed(notification(input));
});

test('build-only never consumes a positive startup report or claims any runtime passed', () => {
  const input = fixture();
  input.env.BUILD_ONLY = 'true';
  input.needs.startup.result = 'skipped';
  input.needs.archive.result = 'skipped';
  const message = notification(input);
  assert.match(message.title, /构建完成.*未验证启动/);
  assert.match(message.lines.join('\n'), /不代表任何 iOS 版本已通过/);
  assert.equal(message.lines.filter(line => line.startsWith('iOS ')).length, 0);
  input.needs.build.result = 'failure';
  assert.match(notification(input).title, /仅构建流程未通过/);
});

test('missing, malformed and oversized evidence cannot become a pass', () => {
  const input = fixture();
  for (const evidence of [
    undefined,
    '',
    '{',
    'null',
    '[]',
    'x'.repeat(16385),
  ]) {
    const message = createNotification({
      ...input.env,
      STARTUP_NEEDS: JSON.stringify(input.needs),
      STARTUP_REPORT: evidence,
    });
    assertNotPassed(message);
    assert.match(message.lines.join('\n'), /缺少有效证据/);
    assert.doesNotMatch(message.lines.join('\n'), /：通过（两次冷启动）/);
  }
});

test('report binds run, commit, qualification mode, environment and bounded attempt', () => {
  const mutations = [
    value => (value.schemaVersion = 2),
    value => (value.runId = '456'),
    value => (value.report.commit = 'b'.repeat(40)),
    value => (value.report.mode = 'probe'),
    value => (value.report.environment = 'hosted'),
    ...['0', '-1', '3', '1.5', '1\n', 1, undefined].map(
      attempt => value => (value.runAttempt = attempt),
    ),
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input.envelope);
    assertNotPassed(notification(input));
  }
  const older = fixture();
  older.envelope.runAttempt = '1';
  const message = notification(older);
  assert.match(message.title, /完整启动检查通过/);
  assert.match(message.lines.join('\n'), /证据来自本 run 第 1 次尝试/);
});

test('rows must match the exact requested set, runtime and test Xcode without duplicates', () => {
  const mutations = [
    rows => rows.pop(),
    rows => rows.push({ ...rows[0] }),
    rows => (rows[1] = { ...rows[0] }),
    rows => (rows[0].major = '16'),
    rows => (rows[0].runtime = '16.5'),
    rows => (rows[0].xcode = '27.1'),
    rows => (rows[0].status = 'success'),
    rows => (rows[0] = null),
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input.envelope.report.rows);
    assertNotPassed(notification(input));
  }
  const reversed = fixture();
  reversed.envelope.report.rows.reverse();
  assert.match(notification(reversed).title, /完整启动检查通过/);
});

test('aggregate flags must agree with coverage and individual results', () => {
  for (const key of ['passed', 'fullCoverage', 'qualificationPassed']) {
    const input = fixture();
    input.envelope.report[key] = false;
    assertNotPassed(notification(input));
  }
  const input = fixture();
  input.envelope.report.rows[0].status = 'failed-or-missing';
  assertNotPassed(notification(input));
  input.envelope.report.passed = false;
  input.envelope.report.qualificationPassed = false;
  input.needs.startup.result = 'failure';
  input.needs.summary.result = 'failure';
  const message = notification(input);
  assertNotPassed(message);
  assert.match(message.lines.join('\n'), /iOS 16\.4.*未通过或证据缺失/);
  assert.match(message.lines.join('\n'), /iOS 17\.5.*通过（两次冷启动）/);
  assert.match(message.lines.join('\n'), /不等于 App 崩溃/);
});

test('missing or unsuccessful required jobs override a positive report', () => {
  for (const job of ['matrix', 'build', 'startup', 'summary']) {
    for (const state of ['failure', 'cancelled', 'skipped', 'unexpected']) {
      const input = fixture();
      input.needs[job].result = state;
      assertNotPassed(notification(input));
    }
  }
  const input = fixture();
  for (const needs of [undefined, '{', 'null', '{}']) {
    assertNotPassed(
      createNotification({
        ...input.env,
        STARTUP_REPORT: JSON.stringify(input.envelope),
        STARTUP_NEEDS: needs,
      }),
    );
  }
});

test('archive failure stays independently visible without falsifying successful startup evidence', () => {
  const input = fixture();
  input.needs.archive.result = 'failure';
  const message = notification(input);
  assert.match(message.title, /完整启动检查通过.*归档未完成/);
  assert.match(message.lines.join('\n'), /S3 归档：失败/);
  assert.ok(!message.lines.join('\n').includes(archiveKey));
  input.needs.archive.result = 'success';
  input.needs.archive.outputs.archive_key =
    'https://example.invalid/public.zip';
  assert.ok(!notification(input).lines.join('\n').includes('example.invalid'));
  input.needs.archive.outputs.archive_key = `${archiveKey}\n`;
  assert.ok(
    !notification(input).lines.some(line => line.startsWith('私有归档 key：')),
  );
});

test('invalid matrix input remains failed and does not prevent notification', () => {
  for (const overrides of [
    { REQUESTED_MAJORS: '16,19' },
    { BUILD_XCODE: 'latest' },
    { EXECUTION_ENVIRONMENT: 'auto' },
  ]) {
    const input = fixture();
    Object.assign(input.env, overrides);
    const message = notification(input);
    assertNotPassed(message);
    assert.match(message.lines.join('\n'), /矩阵配置无效/);
  }
});

test('run context rejects invalid repository, commit or non-canonical IDs', () => {
  for (const overrides of [
    { GITHUB_REPOSITORY: 'someone/another-repository' },
    { GITHUB_SHA: 'not-a-commit' },
    { GITHUB_SHA: `${commit}\n` },
    { GITHUB_RUN_ID: '0' },
    { GITHUB_RUN_ID: '123\n' },
    { GITHUB_RUN_ID: '123/attempts/1' },
    { GITHUB_RUN_ID: '9007199254740992' },
    { GITHUB_RUN_ATTEMPT: '0' },
    { GITHUB_RUN_ATTEMPT: '1\n' },
    { GITHUB_RUN_ATTEMPT: '1.5' },
  ]) {
    const input = fixture();
    Object.assign(input.env, overrides);
    assert.throws(() => notification(input), /context/i);
  }
  const input = fixture();
  input.env.GITHUB_REF_NAME = `feat/first\nsecond\r\t${'x'.repeat(300)}`;
  const line = notification(input).lines[0];
  assert.doesNotMatch(line, /[\r\n\t]/);
  assert.ok(line.length < 260);
});

test('sender signs one bounded native POST using primary configuration, without redirects', async t => {
  const message = notification();
  const controller = new AbortController();
  const timeout = t.mock.method(AbortSignal, 'timeout', milliseconds => {
    assert.equal(milliseconds, 15000);
    return controller.signal;
  });
  const calls = [];
  const timestamp = 1793018096;
  await sendNotification(message, {
    env: {
      RABBY_MOBILE_LARK_CHAT_URL: webhook,
      RABBY_MOBILE_LARK_CHAT_SECRET: secret,
      LARK_CHAT_URL: 'https://example.invalid/not-the-selected-webhook',
      LARK_CHAT_SECRET: 'unused-fallback-secret',
    },
    now: () => timestamp * 1000 + 999,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ code: 0 }));
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(timeout.mock.callCount(), 1);
  assert.equal(calls[0].url, webhook);
  const options = calls[0].options;
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.equal(options.signal, controller.signal);
  assert.equal(options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(options.body);
  assert.equal(body.timestamp, timestamp);
  assert.equal(
    body.sign,
    createHmac('sha256', `${timestamp}\n${secret}`).digest('base64'),
  );
  assert.equal(body.msg_type, 'post');
  assert.equal(body.content.post.zh_cn.title, message.title);
  assert.deepEqual(
    body.content.post.zh_cn.content,
    message.lines.map(text => [{ tag: 'text', text }]),
  );
  assert.ok(!options.body.includes(secret));
});

test('sender supports the existing fallback names and both successful business-code forms', async () => {
  for (const result of [
    { code: 0 },
    { StatusCode: 0 },
    { code: 0, StatusCode: 0 },
  ]) {
    let calls = 0;
    await sendNotification(notification(), {
      env: {
        LARK_CHAT_URL: webhook.replace('open.larksuite.com', 'open.feishu.cn'),
        LARK_CHAT_SECRET: secret,
      },
      fetchImpl: async url => {
        calls++;
        assert.ok(url.startsWith('https://open.feishu.cn/'));
        return new Response(JSON.stringify(result));
      },
    });
    assert.equal(calls, 1);
  }
});

test('sender rejects missing secrets or non-webhook destinations before making a request', async () => {
  for (const env of [
    {},
    { LARK_CHAT_URL: webhook },
    ...[
      'http://open.larksuite.com/open-apis/bot/v2/hook/synthetic-test-only',
      'https://example.invalid/open-apis/bot/v2/hook/synthetic-test-only',
      'https://open.larksuite.com/another-path',
      `${webhook}?secret=synthetic-secret`,
      `${webhook}#synthetic-secret`,
      webhook.replace('https://', 'https://synthetic-secret@'),
    ].map(url => ({ LARK_CHAT_URL: url, LARK_CHAT_SECRET: secret })),
  ]) {
    let calls = 0;
    await assert.rejects(
      sendNotification(notification(), {
        env,
        fetchImpl: async () => {
          calls++;
          return new Response('{"code":0}');
        },
      }),
      safeError,
    );
    assert.equal(calls, 0);
  }
});

test('HTTP failure, malformed or oversized bodies and rejected business codes fail safely without retry', async () => {
  const responses = [
    () => new Response('upstream-secret-detail', { status: 403 }),
    () => new Response('upstream-secret-detail', { status: 500 }),
    () => new Response(null, { status: 204 }),
    () => new Response('upstream-secret-detail'),
    () => new Response('x'.repeat(16385)),
    ...[
      null,
      {},
      [],
      { code: 1 },
      { StatusCode: 1 },
      { code: '0' },
      { code: 0, StatusCode: 1 },
    ].map(result => () => new Response(JSON.stringify(result))),
  ];
  for (const response of responses) {
    let calls = 0;
    await assert.rejects(
      sendNotification(notification(), {
        env: { LARK_CHAT_URL: webhook, LARK_CHAT_SECRET: secret },
        fetchImpl: async () => {
          calls++;
          return response();
        },
      }),
      safeError,
    );
    assert.equal(calls, 1);
  }
});

test('transport and timeout errors do not leak upstream details or retry an ambiguous POST', async () => {
  for (const error of [
    new Error(`${webhook} ${secret} upstream-secret-detail`),
    new DOMException(`${webhook} ${secret}`, 'TimeoutError'),
    new DOMException(`${webhook} ${secret}`, 'AbortError'),
  ]) {
    let calls = 0;
    await assert.rejects(
      sendNotification(notification(), {
        env: { LARK_CHAT_URL: webhook, LARK_CHAT_SECRET: secret },
        fetchImpl: async () => {
          calls++;
          throw error;
        },
      }),
      safeError,
    );
    assert.equal(calls, 1);
  }
});

test('oversized messages are rejected locally without posting', async () => {
  let calls = 0;
  await assert.rejects(
    sendNotification(
      { title: 'Summary', lines: ['x'.repeat(20001)] },
      {
        env: { LARK_CHAT_URL: webhook, LARK_CHAT_SECRET: secret },
        fetchImpl: async () => {
          calls++;
          return new Response('{"code":0}');
        },
      },
    ),
    safeError,
  );
  assert.equal(calls, 0);
});

test('dry-run CLI renders without any webhook credentials or network access', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-notify-dry-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const guard = path.join(directory, 'network-guard.mjs');
  await fs.writeFile(
    guard,
    'globalThis.fetch = () => { process.stderr.write("FORBIDDEN NETWORK"); throw new Error("Network disabled"); };\n',
  );
  const input = fixture();
  const result = spawnSync(
    process.execPath,
    ['--import', guard, notifyCLI, 'send', '--dry-run'],
    {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...input.env,
        STARTUP_REPORT: JSON.stringify(input.envelope),
        STARTUP_NEEDS: JSON.stringify(input.needs),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), notification(input));
});

test('failed summary CLI still exports bound evidence consumed by the notifier', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-notify-summary-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const artifacts = path.join(directory, 'artifacts');
  const output = path.join(directory, 'github-output');
  await fs.mkdir(artifacts);
  const input = fixture();
  const result = spawnSync(
    process.execPath,
    [hostedCLI, 'summary', artifacts, majors, commit],
    {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...input.env,
        GITHUB_OUTPUT: output,
        BUILD_RESULT: 'success',
        STARTUP_RESULT: 'failure',
      },
    },
  );
  assert.equal(result.status, 1, result.stderr);
  const line = (await fs.readFile(output, 'utf8'))
    .split('\n')
    .find(value => value.startsWith('notification_report='));
  assert.ok(
    line,
    'failing summary must publish evidence before its nonzero exit',
  );
  const envelope = JSON.parse(line.slice('notification_report='.length));
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.runId, input.env.GITHUB_RUN_ID);
  assert.equal(envelope.runAttempt, input.env.GITHUB_RUN_ATTEMPT);
  assert.equal(envelope.report.commit, commit);
  assert.equal(envelope.report.passed, false);
  assert.equal(envelope.report.qualificationPassed, false);
  assert.equal(envelope.report.rows.length, 5);
  assert.ok(
    envelope.report.rows.every(row => row.status === 'failed-or-missing'),
  );
  assert.equal(
    JSON.parse(await fs.readFile(path.join(artifacts, 'summary.json'), 'utf8'))
      .passed,
    false,
  );
  input.envelope = envelope;
  input.needs.startup.result = 'failure';
  input.needs.summary.result = 'failure';
  const message = notification(input);
  assertNotPassed(message);
  assert.match(message.lines.join('\n'), /未通过或证据缺失/);
  assert.doesNotMatch(
    message.lines.join('\n'),
    /未取得与本 run\/commit\/矩阵匹配的汇总/,
  );
});
