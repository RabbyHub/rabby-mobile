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
    SOURCE_COMMIT: 'a'.repeat(40),
    SOURCE_ARTIFACT_ID: '456',
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
    `_private/rabby-mobile/ios-simulator/${f.env.SOURCE_COMMIT}/123/2/archive.json`,
  );
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
  const first = await uploadArchive(f.input, f);
  const before = [...f.objects].map(([key, bytes]) => [key, sha256(bytes)]);
  f.env.GITHUB_RUN_ID = '99999';
  const second = await uploadArchive(f.input, f);
  assert.deepEqual(second, first);
  assert.deepEqual(
    [...f.objects].map(([key, bytes]) => [key, sha256(bytes)]),
    before,
  );
  assert.equal(first.source.runId, '123');
  assert.equal(first.source.runAttempt, '2');
  assert.equal(f.calls.filter(([operation]) => operation === 'get').length, 6);
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
  const key = `_private/rabby-mobile/ios-simulator/${f.env.SOURCE_COMMIT}/123/2/RabbyMobile-simulator.zip`;
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
    source.archiveKey.replace('/123/', '/0123/'),
    source.archiveKey.replace('/123/', '/9007199254740992/'),
    source.archiveKey.replace('/123/', '/../'),
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
    { runId: '124' },
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
    if (['key', 'index-producer', 'receipt-producer'].includes(failure))
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
  const key = `_private/rabby-mobile/ios-simulator/${f.env.SOURCE_COMMIT}/123/2/archive.json`;
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
