import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  validateCatalog,
  validatePresignedUrl,
  createAwsAdapter,
  prepareDownloadNotification,
  sendDownloads,
} from './download-links.mjs';

// Pure catalog/signature policy tests plus Node integration with the real AWS
// adapter and shared Lark sender. Only the process/HTTP boundaries are mocked.
const bucket = 'fixture-xcode-downloads';
const region = 'ap-northeast-1';
const time = Date.parse('2026-10-27T03:04:05Z');
const now = () => time;
const env = {
  PATH: '/fixture/bin',
  HOME: '/fixture/home',
  RABBY_MOBILE_BUILD_BUCKET: bucket,
  RABBY_MOBILE_LARK_CHAT_URL:
    'https://open.larksuite.com/open-apis/bot/v2/hook/fixture-hook',
  RABBY_MOBILE_LARK_CHAT_SECRET: 'fixture-notification-secret',
};

function entry(overrides = {}) {
  const result = {
    version: '27.1',
    build: '27A9275',
    architecture: 'arm64',
    filename: 'Xcode_27.1.xip',
    bytes: 2027369056,
    sha256: 'a'.repeat(64),
    uploadedAt: '2026-10-27T00:00:00Z',
    source: 'https://developer.apple.com/download/all/',
    signature: 'Apple Software',
    ...overrides,
  };
  result.key = `_private/toolchains/apple/xcode/${result.version}-${result.build}-${result.architecture}-${result.sha256}/${result.filename}`;
  return result;
}

function catalog(entries = [entry()]) {
  return { schemaVersion: 1, entries };
}

function signedUrl(
  value,
  { selectedRegion = region, selectedBucket = bucket, pathStyle = false } = {},
) {
  const url = new URL(
    pathStyle
      ? `https://s3.${selectedRegion}.amazonaws.com/${selectedBucket}/${value.key}`
      : `https://${selectedBucket}.s3.${selectedRegion}.amazonaws.com/${value.key}`,
  );
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set(
    'X-Amz-Credential',
    `AKIAEXAMPLE1234567890/20261027/${selectedRegion}/s3/aws4_request`,
  );
  url.searchParams.set('X-Amz-Date', '20261027T030405Z');
  url.searchParams.set('X-Amz-Expires', '3600');
  url.searchParams.set('X-Amz-SignedHeaders', 'host');
  url.searchParams.set('X-Amz-Signature', 'b'.repeat(64));
  return url.href;
}

function head(value, overrides = {}) {
  return {
    ContentLength: value.bytes,
    Metadata: { sha256: value.sha256 },
    ServerSideEncryption: 'aws:kms',
    ...overrides,
  };
}

test('the checked-in catalog contains valid verified archive entries', async () => {
  const actual = JSON.parse(
    await fs.readFile(new URL('./catalog.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(validateCatalog(actual), actual);
});

function fakeAws(
  entries,
  {
    location = region,
    changeHead = value => value,
    changeUrl = value => value,
    childEnvironment = env,
  } = {},
) {
  const calls = [];
  const adapter = createAwsAdapter({
    env: childEnvironment,
    now,
    async execute(args, childEnv) {
      calls.push({ args, env: childEnv });
      if (args[1] === 'get-bucket-location')
        return JSON.stringify({ LocationConstraint: location });
      const value = entries.find(candidate =>
        args[1] === 'head-object'
          ? candidate.key === args[args.indexOf('--key') + 1]
          : args[2] === `s3://${bucket}/${candidate.key}`,
      );
      assert.ok(value, 'only the catalog object may be addressed');
      if (args[1] === 'head-object')
        return JSON.stringify(changeHead(head(value)));
      assert.deepEqual(args.slice(0, 2), ['s3', 'presign']);
      const selectedRegion =
        location === null
          ? 'us-east-1'
          : location === 'EU'
          ? 'eu-west-1'
          : location;
      return `${changeUrl(signedUrl(value, { selectedRegion }))}\n`;
    },
  });
  return { adapter, calls };
}

test('catalog validates exact immutable Apple entries and supports up to sixteen identities', () => {
  const entries = Array.from({ length: 16 }, (_, index) =>
    entry({
      build: `27A${1000 + index}`,
      architecture: index % 2 ? 'universal' : 'arm64',
      uploadedAt: '2026-10-27T00:00:00.123Z',
    }),
  );
  const original = catalog(entries);
  assert.deepEqual(validateCatalog(original), original);
  assert.notEqual(validateCatalog(original).entries[0], original.entries[0]);
  assert.deepEqual(
    validateCatalog(catalog([entry({ versionId: 'fixture-version+/=' })])),
    catalog([entry({ versionId: 'fixture-version+/=' })]),
  );
});

test('catalog rejects empty, duplicate, traversal, unbounded and non-Apple records', () => {
  for (const invalid of [
    null,
    [],
    {},
    { ...catalog(), extra: true },
    catalog([]),
    { ...catalog(), schemaVersion: 2 },
    catalog(
      Array.from({ length: 17 }, (_, i) => entry({ build: `27A${1000 + i}` })),
    ),
    catalog([entry(), entry()]),
  ])
    assert.throws(() => validateCatalog(invalid), /catalog/);
  const changes = [
    { version: '27.1\n' },
    { version: '../27' },
    { build: '27A9275\n' },
    { architecture: 'x86_64' },
    { filename: '../Xcode_27.1.xip' },
    { filename: 'Xcode_.._27.1.xip' },
    { filename: 'Xcode_27.1.xip?secret=1' },
    { filename: 'Xcode_27.1.xip\n' },
    { bytes: 0 },
    { bytes: '2027369056' },
    { bytes: Number.MAX_SAFE_INTEGER + 1 },
    { bytes: 1.5 },
    { sha256: 'a'.repeat(64) + '\n' },
    { sha256: 'A'.repeat(64) },
    { uploadedAt: '2026-02-31T00:00:00Z' },
    { uploadedAt: '2026-10-27T00:00:00Z\n' },
    { source: 'https://example.test/Xcode.xip' },
    { signature: 'unverified' },
    { versionId: '' },
    { versionId: null },
    { versionId: 'version\n' },
    { unexpected: true },
  ];
  for (const change of changes)
    assert.throws(() => validateCatalog(catalog([entry(change)])), /catalog/);
  for (const key of [
    '_private/other/file.xip',
    `s3://${bucket}/${entry().key}`,
    `${entry().key}\n`,
    `${entry().key}/../file.xip`,
  ])
    assert.throws(
      () => validateCatalog(catalog([{ ...entry(), key }])),
      /catalog/,
    );
  const missing = entry();
  delete missing.signature;
  assert.throws(() => validateCatalog(catalog([missing])), /catalog/);
  assert.throws(
    () =>
      validateCatalog(catalog([entry(), entry({ sha256: 'c'.repeat(64) })])),
    /duplicate/,
  );
});

test('signed URL validation binds exact regional S3 key, credential scope, lifetime and GET shape', () => {
  const value = entry();
  for (const pathStyle of [false, true]) {
    const url = signedUrl(value, { pathStyle });
    assert.deepEqual(
      validatePresignedUrl(url, { bucket, entry: value, region, now }),
      {
        url,
        expiresAt: '2026-10-27T04:04:05.000Z',
      },
    );
  }
  const temporary = new URL(signedUrl(value));
  temporary.searchParams.set('X-Amz-Security-Token', 'fixture/session+token==');
  temporary.searchParams.set('x-id', 'GetObject');
  assert.equal(
    validatePresignedUrl(temporary.href, { bucket, entry: value, region, now })
      .url,
    temporary.href,
  );
  const invalid = [];
  for (const [key, next] of [
    ['X-Amz-Algorithm', 'AWS-HMAC-SHA1'],
    ['X-Amz-Expires', '7200'],
    ['X-Amz-Expires', '03600'],
    ['X-Amz-SignedHeaders', 'host;x-custom'],
    ['X-Amz-Signature', 'not-a-signature'],
    ['X-Amz-Date', '20260231T030405Z'],
    ['X-Amz-Date', '20261026T030405Z'],
    ['X-Amz-Date', '20261028T030405Z'],
    [
      'X-Amz-Credential',
      'AKIAEXAMPLE1234567890/20261027/us-east-1/s3/aws4_request',
    ],
    [
      'X-Amz-Credential',
      'AKIAEXAMPLE1234567890/20261026/ap-northeast-1/s3/aws4_request',
    ],
    ['X-Amz-Security-Token', ''],
    ['x-id', 'PutObject'],
    ['versionId', 'unsigned-version'],
    ['response-content-disposition', 'attachment'],
  ]) {
    const url = new URL(signedUrl(value));
    url.searchParams.set(key, next);
    invalid.push(url.href);
  }
  const duplicate = new URL(signedUrl(value));
  duplicate.searchParams.append('X-Amz-Expires', '3600');
  invalid.push(duplicate.href);
  const missing = new URL(signedUrl(value));
  missing.searchParams.delete('X-Amz-Signature');
  invalid.push(missing.href);
  const valid = signedUrl(value);
  invalid.push(
    valid.replace('https:', 'http:'),
    valid.replace(bucket, 'other-bucket'),
    valid.replace('amazonaws.com', 'amazonaws.com.attacker.test'),
    valid.replace(value.key, `${value.key}other`),
    valid.replace('https://', 'https://user:password@'),
    `${valid}#fragment`,
    `${valid}\n`,
    ` ${valid}`,
    'https://example.test/file',
    valid.replace('amazonaws.com/', 'amazonaws.com:8443/'),
  );
  for (const url of invalid)
    assert.throws(
      () => validatePresignedUrl(url, { bucket, entry: value, region, now }),
      /Invalid presigned/,
    );
  assert.throws(
    () =>
      validatePresignedUrl(valid, {
        bucket,
        entry: entry({ versionId: 'v1' }),
        region,
        now,
      }),
    /Invalid presigned/,
  );
});

test('AWS adapter discovers the region once, checks all HEADs, then signs only the catalog', async () => {
  const entries = [
    entry(),
    entry({
      version: '26.3',
      build: '17C529',
      filename: 'Xcode_26.3_Apple_silicon.xip',
    }),
  ];
  const { adapter, calls } = fakeAws(entries);
  const message = await prepareDownloadNotification(catalog(entries), {
    adapter,
    now,
  });
  assert.deepEqual(
    calls.map(call => call.args[1]),
    ['get-bucket-location', 'head-object', 'head-object', 'presign', 'presign'],
  );
  for (const { args } of calls) {
    assert.equal(args[args.indexOf('--region') + 1], region);
    assert.equal(
      args[args.indexOf('--endpoint-url') + 1],
      `https://s3.${region}.amazonaws.com`,
    );
    assert.equal(args[args.indexOf('--profile') + 1], 'default');
    assert.ok(args.includes('--no-cli-pager'));
    assert.ok(args.includes('--no-cli-auto-prompt'));
    assert.ok(args.includes('--cli-connect-timeout'));
    assert.ok(args.includes('--cli-read-timeout'));
    assert.ok(!args.includes('--no-verify-ssl'));
    assert.ok(!args.includes('--debug'));
  }
  for (const { args } of calls.filter(call => call.args[1] === 'presign'))
    assert.equal(args[args.indexOf('--expires-in') + 1], '3600');
  for (const value of entries) {
    const body = message.lines.join('\n');
    for (const text of [
      value.version,
      value.build,
      value.architecture,
      value.filename,
      String(value.bytes),
      value.sha256,
      signedUrl(value),
      '2026-10-27T04:04:05.000Z',
    ])
      assert.ok(body.includes(text));
  }
});

test('region discovery handles AWS legacy values and refuses unknown provider partitions', async () => {
  for (const location of [null, 'EU', 'us-west-2', 'ap-northeast-1']) {
    const { adapter } = fakeAws([entry()], { location });
    const result = await adapter.presign(entry());
    assert.ok(result.url.startsWith('https://fixture-xcode-downloads.s3.'));
  }
  for (const location of [
    '',
    'cn-north-1',
    'us-gov-west-1',
    'ap-northeast-1\n',
    'https://attacker.test',
  ]) {
    const { adapter, calls } = fakeAws([entry()], { location });
    await assert.rejects(adapter.head(entry()), /region/);
    assert.equal(calls.length, 1);
  }
});

test('HEAD must match full bytes and SHA metadata; multipart ETag is not a checksum substitute', async () => {
  const changes = [
    { ContentLength: 1 },
    { ContentLength: String(entry().bytes) },
    { Metadata: {} },
    { Metadata: { sha256: 'c'.repeat(64) } },
    { Metadata: {}, ETag: entry().sha256 },
    { DeleteMarker: true },
    { ServerSideEncryption: 'unsupported' },
    { SSECustomerAlgorithm: 'AES256' },
  ];
  for (const change of changes) {
    const { adapter, calls } = fakeAws([entry()], {
      changeHead: value => ({ ...value, ...change }),
    });
    await assert.rejects(
      prepareDownloadNotification(catalog(), { adapter, now }),
      /does not match/,
    );
    assert.ok(!calls.some(call => call.args[1] === 'presign'));
  }
  const { adapter } = fakeAws([entry()], {
    changeHead: value => ({
      ...value,
      ETag: 'multipart-not-file-sha-3',
    }),
  });
  await adapter.head(entry());
});

test('missing or downgraded SSE-KMS blocks every link and notification', async () => {
  for (const encryption of [undefined, null, '', 'AES256', 'aws:kms:dsse']) {
    const { adapter, calls } = fakeAws([entry()], {
      changeHead: value => ({ ...value, ServerSideEncryption: encryption }),
    });
    let posted = 0;
    await assert.rejects(
      sendDownloads(catalog(), {
        env,
        adapter,
        now,
        async fetchImpl() {
          posted++;
          return new Response('{"code":0}');
        },
      }),
      /does not match/,
    );
    assert.equal(posted, 0);
    assert.ok(!calls.some(call => call.args[1] === 'presign'));
  }
});

test('an unversioned catalog rejects a newly versioned object without signing or notifying', async () => {
  for (const versionId of ['new-object-version', 'null']) {
    const { adapter, calls } = fakeAws([entry()], {
      changeHead: value => ({ ...value, VersionId: versionId }),
    });
    let posted = 0;
    await assert.rejects(
      sendDownloads(catalog(), {
        env,
        adapter,
        now,
        async fetchImpl() {
          posted++;
          return new Response('{"code":0}');
        },
      }),
      /does not match/,
    );
    assert.equal(posted, 0);
    assert.ok(!calls.some(call => call.args[1] === 'presign'));
  }
});

test('version ID is pinned on HEAD but unsupported signing fails before any request, never latest fallback', async () => {
  const value = entry({ versionId: 'fixture-version' });
  const { adapter, calls } = fakeAws([value], {
    changeHead: result => ({ ...result, VersionId: value.versionId }),
  });
  await adapter.head(value);
  assert.equal(
    calls[1].args[calls[1].args.indexOf('--version-id') + 1],
    value.versionId,
  );
  await assert.rejects(adapter.presign(value), /cannot sign version-pinned/);
  assert.equal(calls.length, 2);
  const untouched = fakeAws([value]);
  await assert.rejects(
    prepareDownloadNotification(catalog([value]), {
      adapter: untouched.adapter,
      now,
    }),
    /cannot sign version-pinned/,
  );
  assert.equal(untouched.calls.length, 0);
  const drifted = fakeAws([value], {
    changeHead: result => ({ ...result, VersionId: 'other-version' }),
  });
  await assert.rejects(drifted.adapter.head(value), /does not match/);
});

test('AWS process environment uses default profile and never inherits webhook, token or endpoint overrides', async () => {
  const childEnvironment = {
    ...env,
    AWS_PROFILE: 'unexpected',
    AWS_ACCESS_KEY_ID: 'synthetic-key',
    AWS_SECRET_ACCESS_KEY: 'synthetic-secret',
    AWS_SESSION_TOKEN: 'synthetic-session',
    AWS_ENDPOINT_URL: 'https://attacker.test',
    AWS_SHARED_CREDENTIALS_FILE: '/unexpected/credentials',
    GITHUB_TOKEN: 'synthetic-github',
    HTTPS_PROXY: 'http://127.0.0.1:7890',
  };
  const { adapter, calls } = fakeAws([entry()], { childEnvironment });
  await adapter.head(entry());
  for (const call of calls) {
    assert.equal(call.env.AWS_PROFILE, 'default');
    assert.equal(call.env.AWS_EC2_METADATA_DISABLED, 'true');
    assert.equal(call.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS, 'true');
    assert.equal(call.env.AWS_MAX_ATTEMPTS, '2');
    assert.equal(call.env.HTTPS_PROXY, childEnvironment.HTTPS_PROXY);
    for (const name of [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
      'AWS_ENDPOINT_URL',
      'AWS_SHARED_CREDENTIALS_FILE',
      'GITHUB_TOKEN',
      'RABBY_MOBILE_LARK_CHAT_URL',
      'RABBY_MOBILE_LARK_CHAT_SECRET',
    ])
      assert.equal(call.env[name], undefined);
  }
});

test('untrusted response text, process failures and invalid presigned URLs produce safe fixed errors', async () => {
  for (const response of ['private-invalid-json', 'x'.repeat(65537), '{}']) {
    const adapter = createAwsAdapter({
      env,
      now,
      execute: async () => response,
    });
    await assert.rejects(
      adapter.head(entry()),
      error =>
        !error.message.includes(response) && /Invalid AWS/.test(error.message),
    );
  }
  const adapter = createAwsAdapter({
    env,
    now,
    execute: async () => {
      throw new Error(
        `private-error ${signedUrl(entry())} ${
          env.RABBY_MOBILE_LARK_CHAT_SECRET
        }`,
      );
    },
  });
  await assert.rejects(adapter.head(entry()), {
    message: 'AWS Xcode download operation failed',
  });
  const invalid = fakeAws([entry()], {
    changeUrl: () => `https://attacker.test/private-token`,
  });
  await assert.rejects(invalid.adapter.presign(entry()), {
    message: 'Invalid presigned Xcode download URL',
  });
  for (const value of [
    undefined,
    's3://fixture',
    'a',
    'bucket..invalid',
    '192.168.0.1',
    'bucket\n',
  ])
    assert.throws(
      () => createAwsAdapter({ env: { RABBY_MOBILE_BUILD_BUCKET: value } }),
      /bucket/,
    );
});

test('one real shared Lark sender carries every validated link only in the HTTP body', async () => {
  const entries = [entry(), entry({ version: '26.3', build: '17C529' })];
  const { adapter } = fakeAws(entries);
  let posted = 0;
  const result = await sendDownloads(catalog(entries), {
    env,
    adapter,
    now,
    async fetchImpl(url, options) {
      posted++;
      assert.equal(url, env.RABBY_MOBILE_LARK_CHAT_URL);
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal);
      const body = JSON.parse(options.body);
      assert.equal(body.msg_type, 'post');
      assert.ok(body.sign);
      const lines = body.content.post.zh_cn.content
        .flat()
        .map(part => part.text)
        .join('\n');
      for (const value of entries) {
        assert.ok(lines.includes(signedUrl(value)));
        assert.ok(lines.includes(value.sha256));
      }
      return new Response('{"code":0}');
    },
  });
  assert.equal(posted, 1);
  assert.deepEqual(result, { count: 2 });
  assert.ok(!JSON.stringify(result).includes('X-Amz-'));
});

test('no partial notification is sent after HEAD/signing failure, and Lark failure is not retried', async () => {
  let posted = 0;
  const fetchImpl = async () => {
    posted++;
    return new Response('{"code":0}');
  };
  const invalidHead = fakeAws([entry()], {
    changeHead: value => ({ ...value, ContentLength: 1 }),
  });
  await assert.rejects(
    sendDownloads(catalog(), {
      env,
      adapter: invalidHead.adapter,
      now,
      fetchImpl,
    }),
  );
  const invalidUrl = fakeAws([entry()], {
    changeUrl: () => 'invalid-private-value',
  });
  await assert.rejects(
    sendDownloads(catalog(), {
      env,
      adapter: invalidUrl.adapter,
      now,
      fetchImpl,
    }),
  );
  assert.equal(posted, 0);
  for (const outcome of [
    new Response('{"code":3}'),
    new Response('invalid-body'),
    new Response('denied', { status: 403 }),
    new Error(`private-error ${signedUrl(entry())}`),
  ]) {
    const { adapter } = fakeAws([entry()]);
    let attempts = 0;
    await assert.rejects(
      sendDownloads(catalog(), {
        env,
        adapter,
        now,
        async fetchImpl() {
          attempts++;
          if (outcome instanceof Error) throw outcome;
          return outcome;
        },
      }),
      {
        message:
          'Xcode download notification failed; check delivery before retrying',
      },
    );
    assert.equal(attempts, 1);
  }
});

test('CLI success prints only a fixed receipt, without writing URLs to Actions files', async t => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'xcode-download-links-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'output');
  const summary = path.join(directory, 'summary');
  await fs.writeFile(output, 'existing-output\n');
  await fs.writeFile(summary, 'existing-summary\n');
  const source = `
    import assert from 'node:assert/strict';
    const { main, createAwsAdapter } = await import(${JSON.stringify(
      new URL('./download-links.mjs', import.meta.url).href,
    )});
    const catalog = ${JSON.stringify(catalog())};
    const env = ${JSON.stringify(env)};
    let delivered = 0;
    const adapter = createAwsAdapter({ env, now: () => ${time}, execute: async args => {
      if (args[1] === 'get-bucket-location') return ${JSON.stringify(
        JSON.stringify({ LocationConstraint: region }),
      )};
      if (args[1] === 'head-object') return ${JSON.stringify(
        JSON.stringify(head(entry())),
      )};
      if (args[1] === 'presign') return ${JSON.stringify(
        signedUrl(entry()) + '\n',
      )};
      throw new Error('Unexpected command');
    }});
    await main([], { env, adapter, now: () => ${time}, readCatalog: async () => catalog, fetchImpl: async (url, options) => {
      delivered++; assert.equal(url, env.RABBY_MOBILE_LARK_CHAT_URL);
      assert.ok(options.body.includes('X-Amz-Signature'));
      return new Response('{"code":0}');
    }});
    assert.equal(delivered, 1);
  `;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', source],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_STEP_SUMMARY: summary,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    'Xcode download notification delivered (1 entries)\n',
  );
  assert.equal(result.stderr, '');
  assert.equal(await fs.readFile(output, 'utf8'), 'existing-output\n');
  assert.equal(await fs.readFile(summary, 'utf8'), 'existing-summary\n');
});

test('CLI rejects arguments with safe output and importing never signs or sends', () => {
  const script = fileURLToPath(
    new URL('./download-links.mjs', import.meta.url),
  );
  const result = spawnSync(
    process.execPath,
    [script, 'private-arbitrary-bucket'],
    { encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(
    result.stderr,
    'Xcode download notification failed; inspect configuration and delivery before retrying\n',
  );
  const imported = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `globalThis.fetch = () => { throw new Error('Unexpected network'); }; await import(${JSON.stringify(
        new URL('./download-links.mjs', import.meta.url).href,
      )});`,
    ],
    { encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(imported.stdout, '');
  assert.equal(imported.stderr, '');
});

test('manual workflow has no inputs or public link outputs and uses the existing private sender secrets', async () => {
  const workflow = await fs.readFile(
    new URL(
      '../../.github/workflows/xcode_toolchain_downloads.yml',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(workflow, /on:\s*\n\s+workflow_dispatch:\s*\n\s*permissions:/);
  assert.match(
    workflow,
    /runs-on: \[self-hosted, macOS, ARM64, mobile-local\]/,
  );
  assert.match(workflow, /AWS_PROFILE: default/);
  assert.match(workflow, /AWS_EC2_METADATA_DISABLED: 'true'/);
  assert.match(
    workflow,
    /RABBY_MOBILE_BUILD_BUCKET: \$\{\{ secrets\.RABBY_MOBILE_BUILD_BUCKET \}\}/,
  );
  assert.match(
    workflow,
    /secrets\.RABBY_MOBILE_LARK_CHAT_URL \|\| secrets\.LARK_CHAT_URL/,
  );
  assert.match(
    workflow,
    /secrets\.RABBY_MOBILE_LARK_CHAT_SECRET \|\| secrets\.LARK_CHAT_SECRET/,
  );
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /shell: bash --noprofile --norc -eo pipefail \{0\}/);
  assert.match(
    workflow,
    /run: node scripts\/xcode-toolchains\/download-links\.mjs/,
  );
  assert.doesNotMatch(
    workflow,
    /inputs:|workflow_call:|push:|schedule:|pull_request:|upload-artifact|GITHUB_OUTPUT|GITHUB_STEP_SUMMARY|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|s3 ls|no-verify-ssl|--debug/,
  );
  const helper = await fs.readFile(
    new URL('./download-links.mjs', import.meta.url),
    'utf8',
  );
  assert.match(helper, /from '\.\.\/ios-startup-smoke\/notify\.mjs'/);
  assert.match(helper, /timeout: 45_000/);
  assert.match(helper, /shell: false/);
  assert.doesNotMatch(
    helper,
    /GITHUB_OUTPUT|GITHUB_STEP_SUMMARY|writeFile|appendFile|console\.log\([^\n]*(?:url|message|signed)/i,
  );
});
