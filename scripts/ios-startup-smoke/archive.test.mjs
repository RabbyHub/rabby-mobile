// Node transport contracts: real files, shared receipt verification and hashes;
// only the external AWS CLI/S3 boundary is substituted. Not native startup proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createAwsAdapter,
  fetchArchive,
  uploadArchive,
  validateArchiveSource,
} from './archive.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t, status = 'modified') {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-archive-test-'),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'input');
  await fs.mkdir(input);
  const env = {
    RABBY_MOBILE_BUILD_BUCKET: 'fixture-build-artifacts',
    GITHUB_REPOSITORY: 'RabbyHub/rabby-mobile',
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
    ARCHIVE_JOB_STARTED_AT: '20261026125055',
    SOURCE_COMMIT: 'a'.repeat(40),
    SOURCE_ARTIFACT_ID: '456',
    SOURCE_REF_NAME: 'publish/0.6.95',
  };
  const zip = Buffer.from(
    'unsigned simulator transport fixture, not executable',
  );
  const metadata = {
    schemaVersion: 2,
    sourceCommit: env.SOURCE_COMMIT,
    platform: 'iphonesimulator',
    configuration: 'Regression',
    architectures: ['arm64'],
    executableSha256: 'b'.repeat(64),
    jsBundleSha256: 'c'.repeat(64),
    archive: {
      file: 'RabbyMobile-simulator.zip',
      bytes: zip.length,
      sha256: sha256(zip),
    },
    sourceProvenance: {
      status,
      headCommit: env.SOURCE_COMMIT,
      changedFiles: status === 'modified' ? ['generated.css'] : [],
    },
    producer: {
      repository: env.GITHUB_REPOSITORY,
      runId: '123',
      runAttempt: '2',
    },
  };
  await fs.writeFile(path.join(input, metadata.archive.file), zip);
  const saveMetadata = () =>
    fs.writeFile(path.join(input, 'metadata.json'), JSON.stringify(metadata));
  await saveMetadata();
  const objects = new Map();
  const calls = [];
  const adapter = {
    async put(key, file, descriptor) {
      calls.push(['put', key]);
      if (objects.has(key))
        throw Object.assign(new Error('already exists'), {
          code: 'PreconditionFailed',
        });
      const bytes = await fs.readFile(file);
      assert.equal(sha256(bytes), descriptor.sha256);
      assert.equal(bytes.length, descriptor.bytes);
      objects.set(key, bytes);
    },
    async get(key, file, maximum) {
      calls.push(['get', key, maximum]);
      if (!objects.has(key))
        throw Object.assign(new Error('not found'), { code: 'NoSuchKey' });
      // Match the real adapter's one-extra-byte bounded Range behavior.
      await fs.writeFile(file, objects.get(key).subarray(0, maximum + 1));
    },
  };
  return {
    directory,
    input,
    env,
    zip,
    metadata,
    saveMetadata,
    objects,
    calls,
    adapter,
  };
}

test('upload commits index last and fetch preserves original source and modified provenance without GitHub', async t => {
  const f = await fixture(t);
  const index = await uploadArchive(f.input, f);
  assert.deepEqual(
    f.calls.map(([operation, key]) => [operation, key.split('/').at(-1)]),
    [
      ['put', 'RabbyMobile-simulator.zip'],
      ['get', 'RabbyMobile-simulator.zip'],
      ['put', 'metadata.json'],
      ['get', 'metadata.json'],
      ['put', 'archive.json'],
      ['get', 'archive.json'],
    ],
  );
  assert.equal(
    index.source.archiveKey,
    '_private/rabby-mobile/ios-simulator/123-20261026125055/archive.json',
  );
  assert.equal(index.schemaVersion, 2);
  assert.equal(index.source.archiveRunId, '123');
  assert.equal(index.source.archiveJobStartedAt, f.env.ARCHIVE_JOB_STARTED_AT);
  assert.deepEqual(index.git, {
    repository: 'RabbyHub/rabby-mobile',
    commit: f.env.SOURCE_COMMIT,
    refName: 'publish/0.6.95',
    commitUrl: `https://github.com/RabbyHub/rabby-mobile/commit/${f.env.SOURCE_COMMIT}`,
  });
  assert.equal(index.source.runConclusion, 'unknown');
  assert.equal(validateArchiveSource(index.source), index.source);
  const target = path.join(f.directory, 'fetch');
  // No GITHUB_TOKEN, run API, or artifact availability participates in fetch.
  const source = await fetchArchive(index.source.archiveKey, target, {
    env: { RABBY_MOBILE_BUILD_BUCKET: f.env.RABBY_MOBILE_BUILD_BUCKET },
    adapter: f.adapter,
  });
  assert.deepEqual(source, index.source);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(target, 'archive.json'))).git,
    index.git,
  );
  assert.deepEqual(
    await fs.readFile(path.join(target, 'RabbyMobile-simulator.zip')),
    f.zip,
  );
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(target, 'metadata.json'))),
    f.metadata,
  );
  assert.equal(f.objects.size, 3);
});

test('same-byte upload replay is idempotent and original producer is independent of uploader run', async t => {
  const f = await fixture(t, 'clean');
  f.env.SOURCE_RUN_ID = '123';
  f.env.SOURCE_RUN_ATTEMPT = '2';
  f.env.GITHUB_RUN_ID = '9999';
  f.env.GITHUB_RUN_ATTEMPT = '7';
  f.env.GITHUB_REF_NAME = 'feat/upload-probe';
  const first = await uploadArchive(f.input, f);
  const before = [...f.objects].map(([key, bytes]) => [key, sha256(bytes)]);
  const second = await uploadArchive(f.input, f);
  assert.deepEqual(second, first);
  assert.deepEqual(
    [...f.objects].map(([key, bytes]) => [key, sha256(bytes)]),
    before,
  );
  assert.equal(first.source.runId, '123');
  assert.equal(first.source.runAttempt, '2');
  assert.equal(first.source.archiveRunId, '9999');
  assert.equal(first.git.refName, 'publish/0.6.95');
  assert.equal(
    first.source.archiveKey,
    '_private/rabby-mobile/ios-simulator/9999-20261026125055/archive.json',
  );
  assert.equal(f.calls.filter(([operation]) => operation === 'get').length, 6);
});

test('a new upload job gets a separate locator while retaining the original build producer', async t => {
  const f = await fixture(t, 'clean');
  f.env.SOURCE_RUN_ID = '123';
  f.env.SOURCE_RUN_ATTEMPT = '2';
  const first = await uploadArchive(f.input, f);
  const original = [...f.objects].map(([key, bytes]) => [key, sha256(bytes)]);
  // Re-run of the same workflow has the same run ID but a fresh job timestamp.
  f.env.GITHUB_RUN_ATTEMPT = '3';
  f.env.ARCHIVE_JOB_STARTED_AT = '20261027000102';
  const second = await uploadArchive(f.input, f);
  assert.equal(
    second.source.archiveKey,
    '_private/rabby-mobile/ios-simulator/123-20261027000102/archive.json',
  );
  // A standalone upload probe uses its own run ID, not the producer's run ID.
  f.env.GITHUB_RUN_ID = '4567';
  const third = await uploadArchive(f.input, f);
  assert.equal(
    third.source.archiveKey,
    '_private/rabby-mobile/ios-simulator/4567-20261027000102/archive.json',
  );
  for (const index of [second, third]) {
    for (const key of ['runId', 'runAttempt', 'sourceCommit', 'artifactId'])
      assert.equal(index.source[key], first.source[key]);
    assert.equal(index.objects.archive.sha256, first.objects.archive.sha256);
  }
  assert.equal(f.objects.size, 9);
  for (const [key, hash] of original)
    assert.equal(sha256(f.objects.get(key)), hash);
});

test('job timestamp is required and validates real UTC calendar dates before S3 access', async t => {
  const f = await fixture(t);
  for (const value of [
    undefined,
    '',
    '2026-10-26T12:50:55Z',
    '202610261250',
    '202610261250550',
    '20261026125055\n',
    '20260229125055',
    '20260431125055',
    '20261301125055',
    '20261000235055',
    '20261026240000',
    '20261026126000',
    '20261026125060',
  ]) {
    f.env.ARCHIVE_JOB_STARTED_AT = value;
    await assert.rejects(uploadArchive(f.input, f), /timestamp/);
    assert.equal(f.calls.length, 0);
  }
  f.env.ARCHIVE_JOB_STARTED_AT = '20280229235959';
  const index = await uploadArchive(f.input, f);
  assert.equal(index.source.archiveJobStartedAt, '20280229235959');
});

test('unknown original ref stays null and malformed refs never enter outputs or S3', async t => {
  const f = await fixture(t);
  for (const value of [
    'branch\ninjected=value',
    'branch\rname',
    'bad\0ref',
    'a'.repeat(1025),
  ]) {
    f.env.SOURCE_REF_NAME = value;
    await assert.rejects(uploadArchive(f.input, f), /Git ref/);
    assert.equal(f.calls.length, 0);
  }
  delete f.env.SOURCE_REF_NAME;
  f.env.GITHUB_REF_NAME = 'uploader-not-original';
  const index = await uploadArchive(f.input, f);
  assert.equal(index.git.refName, null);
  assert.equal(index.git.commit, f.metadata.sourceCommit);
});

test('first PUT success with denied payload GET cannot publish an index and can recover by replay', async t => {
  for (const name of ['RabbyMobile-simulator.zip', 'metadata.json']) {
    const f = await fixture(t);
    const originalGet = f.adapter.get;
    f.adapter.get = async (...args) => {
      if (args[0].endsWith(`/${name}`))
        throw Object.assign(new Error('read denied'), { code: 'AccessDenied' });
      return originalGet(...args);
    };
    await assert.rejects(
      uploadArchive(f.input, f),
      /readback failed \(AccessDenied\)/,
    );
    assert.equal(
      [...f.objects.keys()].some(key => key.endsWith('/archive.json')),
      false,
    );
    assert.equal(f.objects.size, name.endsWith('.zip') ? 1 : 2);
    f.adapter.get = originalGet;
    await uploadArchive(f.input, f);
    assert.equal(f.objects.size, 3);
  }
});

test('published index must also pass readback; denial is a failed upload with no remote deletion', async t => {
  const f = await fixture(t);
  const originalGet = f.adapter.get;
  f.adapter.get = async (...args) => {
    if (args[0].endsWith('/archive.json'))
      throw Object.assign(new Error('read denied'), { code: 'AccessDenied' });
    return originalGet(...args);
  };
  await assert.rejects(
    uploadArchive(f.input, f),
    /readback failed \(AccessDenied\)/,
  );
  assert.equal(f.objects.size, 3);
  f.adapter.get = originalGet;
  await uploadArchive(f.input, f);
  assert.equal(f.objects.size, 3);
});

test('first successful PUT with corrupted readback blocks index publication', async t => {
  const f = await fixture(t);
  const originalGet = f.adapter.get;
  f.adapter.get = async (...args) => {
    await originalGet(...args);
    if (args[0].endsWith('.zip')) await fs.writeFile(args[1], 'bad bytes');
  };
  await assert.rejects(uploadArchive(f.input, f), /conflicts/);
  assert.equal(f.objects.size, 1);
});

test('conflicting immutable object fails without an index or overwriting the conflict', async t => {
  const f = await fixture(t);
  const key =
    '_private/rabby-mobile/ios-simulator/123-20261026125055/RabbyMobile-simulator.zip';
  f.objects.set(key, Buffer.from('conflict'));
  await assert.rejects(uploadArchive(f.input, f), /conflicts/);
  assert.equal(f.objects.size, 1);
  assert.equal(f.objects.get(key).toString(), 'conflict');
});

test('failed metadata upload leaves only a recoverable incomplete prefix, never a usable index', async t => {
  const f = await fixture(t);
  const originalPut = f.adapter.put;
  f.adapter.put = async (...args) => {
    if (args[0].endsWith('/metadata.json'))
      throw Object.assign(new Error('denied'), { code: 'AccessDenied' });
    return originalPut(...args);
  };
  await assert.rejects(uploadArchive(f.input, f), /denied/);
  assert.equal(f.objects.size, 1);
  assert.equal([...f.objects.keys()][0].endsWith('.zip'), true);
  f.adapter.put = originalPut;
  await uploadArchive(f.input, f);
  assert.equal(f.objects.size, 3);
});

test('missing, corrupt, symlinked and oversized input is rejected before any S3 write', async t => {
  for (const failure of ['missing', 'corrupt', 'symlink', 'oversized']) {
    const f = await fixture(t);
    const zip = path.join(f.input, f.metadata.archive.file);
    if (failure === 'missing') await fs.unlink(zip);
    if (failure === 'corrupt') await fs.appendFile(zip, 'tamper');
    if (failure === 'symlink') {
      await fs.rename(zip, path.join(f.directory, 'real.zip'));
      await fs.symlink(path.join(f.directory, 'real.zip'), zip);
    }
    if (failure === 'oversized')
      await fs.writeFile(
        path.join(f.input, 'metadata.json'),
        ' '.repeat(1024 * 1024 + 1),
      );
    await assert.rejects(uploadArchive(f.input, f));
    assert.equal(f.calls.length, 0);
  }
});

test('cross-producer and cross-commit inputs fail before publishing', async t => {
  for (const key of ['repository', 'runId', 'runAttempt', 'sourceCommit']) {
    const f = await fixture(t);
    if (key === 'sourceCommit') f.metadata.sourceCommit = 'd'.repeat(40);
    else f.metadata.producer[key] = 'different';
    await f.saveMetadata();
    await assert.rejects(uploadArchive(f.input, f), /producer/);
    assert.equal(f.calls.length, 0);
  }
  const f = await fixture(t);
  f.env.SOURCE_RUN_ID = '123'; // A partial override cannot borrow current attempt.
  await assert.rejects(uploadArchive(f.input, f), /identifier/);
  assert.equal(f.calls.length, 0);
});

test('strict source and key validation rejects arbitrary locations, traversal and identity drift', async t => {
  const f = await fixture(t);
  const { source } = await uploadArchive(f.input, f);
  for (const key of [
    's3://another-bucket/archive.json',
    `https://example.test/${source.archiveKey}`,
    source.archiveKey.replace('/123-', '/0123-'),
    source.archiveKey.replace('/123-', '/9007199254740992-'),
    source.archiveKey.replace('/123-', '/../'),
    source.archiveKey.replace('20261026125055', '20260230125055'),
    `_private/rabby-mobile/ios-simulator/${source.sourceCommit}/123/2/archive.json`,
    source.archiveKey + '?query=x',
    source.archiveKey.replace('_private/', 'public/'),
    source.archiveKey + '\n',
  ]) {
    assert.throws(() => validateArchiveSource({ ...source, archiveKey: key }));
    const prior = f.calls.length;
    await assert.rejects(fetchArchive(key, path.join(f.directory, 'bad'), f));
    assert.equal(f.calls.length, prior);
  }
  for (const change of [
    { runConclusion: 'success' },
    { artifactId: '01' },
    { runId: '0123' },
    { runAttempt: '0' },
    { archiveRunId: '124' },
    { archiveJobStartedAt: '20261026125056' },
    { sourceCommit: 'b'.repeat(40) },
    { repository: 'another/repo' },
    { artifactName: 'latest' },
    { extra: true },
  ])
    assert.throws(() => validateArchiveSource({ ...source, ...change }));
});

test('fetch rejects tampered index, objects and receipt producer before exposing files', async t => {
  for (const failure of [
    'missing',
    'bad-json',
    'large-index',
    'key',
    'index-producer',
    'index-commit',
    'index-archive-run',
    'index-job-time',
    'index-schema',
    'index-git',
    'index-git-commit',
    'index-git-repository',
    'index-git-url',
    'index-git-ref',
    'zip',
    'metadata',
    'receipt-producer',
  ]) {
    const f = await fixture(t);
    const index = await uploadArchive(f.input, f);
    const key = index.source.archiveKey;
    if (failure === 'missing') f.objects.delete(key);
    if (failure === 'bad-json')
      f.objects.set(key, Buffer.from('{ secret garbage'));
    if (failure === 'large-index') f.objects.set(key, Buffer.alloc(16385, ' '));
    if (failure === 'key') index.objects.archive.key = '../outside';
    if (failure === 'index-producer') index.source.runId = '999';
    if (failure === 'index-commit') {
      index.source.sourceCommit = 'd'.repeat(40);
      index.source.artifactName = `ios-startup-app-${index.source.sourceCommit}-2`;
    }
    if (failure === 'index-archive-run') index.source.archiveRunId = '999';
    if (failure === 'index-job-time')
      index.source.archiveJobStartedAt = '20261026125056';
    if (failure === 'index-schema') index.schemaVersion = 1;
    if (failure === 'index-git') delete index.git;
    if (failure === 'index-git-commit') index.git.commit = 'd'.repeat(40);
    if (failure === 'index-git-repository') index.git.repository = 'other/repo';
    if (failure === 'index-git-url')
      index.git.commitUrl = 'https://example.test/';
    if (failure === 'index-git-ref')
      index.git.refName = 'branch\ninjected=value';
    if (failure === 'zip')
      f.objects.set(index.objects.archive.key, Buffer.from('tampered'));
    if (failure === 'metadata')
      f.objects.set(index.objects.metadata.key, Buffer.from('tampered'));
    if (failure === 'receipt-producer') {
      const metadata = {
        ...f.metadata,
        producer: { ...f.metadata.producer, runId: '999' },
      };
      const bytes = Buffer.from(JSON.stringify(metadata));
      f.objects.set(index.objects.metadata.key, bytes);
      index.objects.metadata.sha256 = sha256(bytes);
      index.objects.metadata.bytes = bytes.length;
    }
    if (
      failure.startsWith('index-') ||
      ['key', 'receipt-producer'].includes(failure)
    )
      f.objects.set(key, Buffer.from(JSON.stringify(index)));
    const target = path.join(f.directory, 'fetch');
    await assert.rejects(fetchArchive(key, target, f));
    assert.deepEqual(await fs.readdir(target), []);
  }
});

test('fetch refuses to replace an existing destination', async t => {
  const f = await fixture(t);
  const index = await uploadArchive(f.input, f);
  await assert.rejects(
    fetchArchive(index.source.archiveKey, f.input, f),
    /empty/,
  );
  assert.deepEqual(
    await fs.readFile(path.join(f.input, f.metadata.archive.file)),
    f.zip,
  );
});

test('native AWS adapter uses bounded streaming download and conditional checksum put only', async t => {
  const f = await fixture(t);
  const calls = [];
  const adapter = createAwsAdapter({
    env: f.env,
    execute: async (args, env) => {
      calls.push(args);
      assert.equal(env, f.env);
      if (args[1] === 'get-object') await fs.writeFile(args.at(-1), 'body');
      return '{}';
    },
  });
  const descriptor = { bytes: f.zip.length, sha256: sha256(f.zip) };
  await adapter.put(
    'exact/key',
    path.join(f.input, f.metadata.archive.file),
    descriptor,
  );
  await adapter.get('exact/key', path.join(f.directory, 'download'), 4);
  assert.deepEqual(
    calls.map(args => args.slice(0, 2)),
    [
      ['s3api', 'put-object'],
      ['s3api', 'get-object'],
    ],
  );
  assert.equal(calls[0][calls[0].indexOf('--if-none-match') + 1], '*');
  assert.equal(
    calls[0][calls[0].indexOf('--checksum-sha256') + 1],
    Buffer.from(descriptor.sha256, 'hex').toString('base64'),
  );
  assert.equal(calls[1][calls[1].indexOf('--range') + 1], 'bytes=0-4');
  assert.equal(calls[1].at(-1), path.join(f.directory, 'download'));
  for (const args of calls) {
    for (const forbidden of [
      '--acl',
      '--no-verify-ssl',
      '--endpoint-url',
      '--debug',
    ])
      assert.equal(args.includes(forbidden), false);
    assert.equal(args[args.indexOf('--cli-connect-timeout') + 1], '15');
    assert.equal(args[args.indexOf('--cli-read-timeout') + 1], '60');
  }
  assert.throws(() =>
    createAwsAdapter({
      env: { RABBY_MOBILE_BUILD_BUCKET: 's3://wrong/location' },
    }),
  );
  assert.throws(() =>
    createAwsAdapter({ env: { RABBY_MOBILE_BUILD_BUCKET: 'valid-bucket\n' } }),
  );
});

test('CLI sanitizes AWS authentication and unknown failures without printing stderr or emitting success', async t => {
  const f = await fixture(t);
  const bin = path.join(f.directory, 'bin');
  await fs.mkdir(bin);
  const cli = fileURLToPath(new URL('./archive.mjs', import.meta.url));
  const key =
    '_private/rabby-mobile/ios-simulator/123-20261026125055/archive.json';
  for (const code of [
    'InvalidAccessKeyId',
    'AccessDenied',
    'UnknownSecretCode',
  ]) {
    await fs.writeFile(
      path.join(bin, 'aws'),
      `#!${process.execPath}\nconsole.error('An error occurred (${code}) when calling GetObject: synthetic-secret-must-not-escape'); process.exit(1);\n`,
      { mode: 0o700 },
    );
    const output = path.join(f.directory, `${code}-output`);
    const result = spawnSync(
      process.execPath,
      [cli, 'fetch', key, path.join(f.directory, code)],
      {
        env: {
          PATH: bin,
          RABBY_MOBILE_BUILD_BUCKET: f.env.RABBY_MOBILE_BUILD_BUCKET,
          GITHUB_OUTPUT: output,
        },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(
      result.stderr,
      /synthetic-secret-must-not-escape|UnknownSecretCode/,
    );
    assert.match(
      result.stderr,
      new RegExp(code === 'UnknownSecretCode' ? 'CliFailed' : code),
    );
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  }
});
