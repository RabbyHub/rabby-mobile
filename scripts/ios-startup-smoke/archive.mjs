// Transport only: never extracts or executes an app, and never changes S3 ACLs.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { verifyArchive } from './hosted.mjs';

const repository = 'RabbyHub/rabby-mobile';
const prefix = '_private/rabby-mobile/ios-simulator/';
const archiveFile = 'RabbyMobile-simulator.zip';
const limits = { index: 16384, metadata: 1024 * 1024, archive: 2 * 1024 ** 3 };
const sourceKeys = [
  'sourceType',
  'archiveKey',
  'archiveRunId',
  'archiveJobStartedAt',
  'repository',
  'runId',
  'runAttempt',
  'artifactId',
  'sourceCommit',
  'artifactName',
  'runConclusion',
];

class ArchiveError extends Error {}

function requireThat(condition, message) {
  if (!condition) throw new ArchiveError(message);
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key))
  );
}

function id(value) {
  requireThat(
    typeof value === 'string' &&
      /^[1-9][0-9]*$/.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      String(Number(value)) === value,
    'Expected a canonical positive GitHub identifier',
  );
  return value;
}

function jobTimestamp(value) {
  requireThat(
    typeof value === 'string' && /^[1-9][0-9]{13}$/.exec(value)?.[0] === value,
    'Expected a UTC job timestamp in YYYYMMDDHHmmss format',
  );
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
    6,
    8,
  )}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}.000Z`;
  const date = new Date(iso);
  requireThat(
    Number.isFinite(date.getTime()) && date.toISOString() === iso,
    'Invalid UTC job timestamp',
  );
  return value;
}

export function validateGitRefName(value) {
  if (value == null) return null;
  requireThat(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 1024 &&
      !/[\x00-\x20\x7f]/.test(value),
    'Invalid original build Git ref name',
  );
  return value;
}

function gitReference(source, refName) {
  return {
    repository: source.repository,
    commit: source.sourceCommit,
    refName: validateGitRefName(refName),
    commitUrl: `https://github.com/${source.repository}/commit/${source.sourceCommit}`,
  };
}

function keyIdentity(key) {
  requireThat(typeof key === 'string', 'Invalid simulator archive key');
  const match = key.match(
    /^_private\/rabby-mobile\/ios-simulator\/([1-9][0-9]*)-([0-9]{14})\/archive\.json$/,
  );
  requireThat(match && match[0] === key, 'Invalid simulator archive key');
  return {
    archiveRunId: id(match[1]),
    archiveJobStartedAt: jobTimestamp(match[2]),
  };
}

export function validateArchiveSource(source) {
  requireThat(exactKeys(source, sourceKeys), 'Invalid S3 source fields');
  const selected = keyIdentity(source.archiveKey);
  requireThat(
    source.sourceType === 's3' &&
      source.repository === repository &&
      source.runConclusion === 'unknown' &&
      ['archiveRunId', 'archiveJobStartedAt'].every(
        key => source[key] === selected[key],
      ) &&
      typeof source.sourceCommit === 'string' &&
      /^[a-f0-9]{40}$/.exec(source.sourceCommit)?.[0] === source.sourceCommit &&
      source.artifactName ===
        `ios-startup-app-${source.sourceCommit}-${source.runAttempt}`,
    'S3 source identity does not match its archive key',
  );
  id(source.artifactId);
  id(source.runId);
  id(source.runAttempt);
  return source;
}

function sourceFromEnvironment(env) {
  requireThat(env.GITHUB_REPOSITORY === repository, 'Unexpected repository');
  const override =
    env.SOURCE_RUN_ID !== undefined || env.SOURCE_RUN_ATTEMPT !== undefined;
  const runId = id(override ? env.SOURCE_RUN_ID : env.GITHUB_RUN_ID);
  const runAttempt = id(
    override ? env.SOURCE_RUN_ATTEMPT : env.GITHUB_RUN_ATTEMPT,
  );
  const sourceCommit = env.SOURCE_COMMIT;
  // Bind the locator to this upload job; keep the original build producer below.
  // Never use upload completion time or silently invent a missing job timestamp.
  const archiveRunId = id(env.GITHUB_RUN_ID);
  const archiveJobStartedAt = jobTimestamp(env.ARCHIVE_JOB_STARTED_AT);
  return validateArchiveSource({
    sourceType: 's3',
    archiveKey: `${prefix}${archiveRunId}-${archiveJobStartedAt}/archive.json`,
    archiveRunId,
    archiveJobStartedAt,
    repository,
    runId,
    runAttempt,
    artifactId: id(env.SOURCE_ARTIFACT_ID),
    sourceCommit,
    artifactName: `ios-startup-app-${sourceCommit}-${runAttempt}`,
    runConclusion: 'unknown',
  });
}

function bucketFromEnvironment(env) {
  const bucket = env.RABBY_MOBILE_BUILD_BUCKET;
  requireThat(
    typeof bucket === 'string' &&
      /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.exec(bucket)?.[0] === bucket &&
      !bucket.includes('..') &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(bucket),
    'Expected a configured S3 bucket name, not a URL',
  );
  return bucket;
}

async function regularFile(file, maximum) {
  const stat = await fs.lstat(file);
  requireThat(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maximum,
    'Invalid or oversized archive transport file',
  );
  return stat;
}

async function digestFile(file, maximum) {
  const stat = await regularFile(file, maximum);
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    requireThat(bytes <= maximum, 'Archive transport file exceeded its bound');
    hash.update(chunk);
  }
  requireThat(
    bytes === stat.size,
    'Archive transport file changed during hashing',
  );
  return { bytes, sha256: hash.digest('hex') };
}

async function readJson(file, maximum) {
  await regularFile(file, maximum);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    throw new ArchiveError('Invalid archive transport JSON');
  }
}

function producer(source) {
  return {
    repository: source.repository,
    runId: source.runId,
    runAttempt: source.runAttempt,
  };
}

async function verifyReceipt(directory, source) {
  // Bound JSON before the existing shared verifier reads it.
  await regularFile(path.join(directory, 'metadata.json'), limits.metadata);
  await regularFile(path.join(directory, archiveFile), limits.archive);
  try {
    return await verifyArchive(directory, source.sourceCommit, {
      probe: true,
      producer: producer(source),
    });
  } catch {
    throw new ArchiveError(
      'Simulator receipt, producer or archive hash mismatch',
    );
  }
}

function validateIndex(index, key) {
  requireThat(
    exactKeys(index, ['schemaVersion', 'kind', 'source', 'git', 'objects']) &&
      index.schemaVersion === 2 &&
      index.kind === 'rabby-ios-simulator-archive',
    'Invalid S3 archive index',
  );
  validateArchiveSource(index.source);
  requireThat(
    exactKeys(index.git, ['repository', 'commit', 'refName', 'commitUrl']),
    'Invalid archive Git reference fields',
  );
  const expectedGit = gitReference(index.source, index.git.refName);
  requireThat(
    Object.keys(expectedGit).every(key => index.git[key] === expectedGit[key]),
    'Archive Git reference does not match its original build source',
  );
  requireThat(
    index.source.archiveKey === key &&
      exactKeys(index.objects, ['archive', 'metadata']),
    'Archive index identity mismatch',
  );
  const root = key.slice(0, -'archive.json'.length);
  for (const [kind, filename] of [
    ['archive', archiveFile],
    ['metadata', 'metadata.json'],
  ]) {
    const item = index.objects[kind];
    requireThat(
      exactKeys(item, ['key', 'sha256', 'bytes']) &&
        item.key === root + filename &&
        typeof item.sha256 === 'string' &&
        item.sha256.length === 64 &&
        /^[a-f0-9]{64}$/.test(item.sha256) &&
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= limits[kind],
      'Invalid archive object identity or bounds',
    );
  }
  return index;
}

const allowedCodes = new Set([
  'PreconditionFailed',
  'ConditionalRequestConflict',
  'AccessDenied',
  'InvalidAccessKeyId',
  'ExpiredToken',
  'InvalidToken',
  'SignatureDoesNotMatch',
  'NoSuchKey',
  'NoSuchBucket',
  'InvalidRange',
  'RequestTimeTooSkewed',
  'SlowDown',
  'ServiceUnavailable',
  'RequestTimeout',
]);

function awsFailure(stderr) {
  const match = stderr.match(/An error occurred \(([A-Za-z0-9]+)\)/);
  const code = allowedCodes.has(match?.[1]) ? match[1] : 'CliFailed';
  const error = new ArchiveError(`AWS archive operation failed (${code})`);
  error.code = code;
  return error;
}

async function executeAws(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('aws', args, {
      env: {
        ...env,
        AWS_PAGER: '',
        AWS_CLI_AUTO_PROMPT: 'off',
        AWS_RETRY_MODE: 'standard',
        AWS_MAX_ATTEMPTS: '2',
        AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '',
      exceeded = false,
      timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 10 * 60 * 1000);
    for (const [stream, append] of [
      [
        child.stdout,
        value => {
          stdout += value;
        },
      ],
      [
        child.stderr,
        value => {
          stderr += value;
        },
      ],
    ]) {
      stream.setEncoding('utf8');
      stream.on('data', value => {
        if (exceeded) return;
        append(value);
        if (stdout.length + stderr.length > 128 * 1024) {
          exceeded = true;
          child.kill('SIGKILL');
        }
      });
    }
    child.on('error', () => {
      clearTimeout(timer);
      reject(new ArchiveError('AWS CLI could not start'));
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut || exceeded)
        reject(
          new ArchiveError(
            'AWS archive operation exceeded its execution bound',
          ),
        );
      else if (code !== 0) reject(awsFailure(stderr));
      else resolve(stdout);
    });
  });
}

export function createAwsAdapter({
  env = process.env,
  execute = executeAws,
} = {}) {
  const bucket = bucketFromEnvironment(env);
  const common = [
    '--no-cli-pager',
    '--output',
    'json',
    '--cli-connect-timeout',
    '15',
    '--cli-read-timeout',
    '60',
  ];
  return {
    async put(key, file, descriptor) {
      await execute(
        [
          's3api',
          'put-object',
          ...common,
          '--bucket',
          bucket,
          '--key',
          key,
          '--body',
          file,
          '--if-none-match',
          '*',
          '--checksum-algorithm',
          'SHA256',
          '--checksum-sha256',
          Buffer.from(descriptor.sha256, 'hex').toString('base64'),
          '--content-length',
          String(descriptor.bytes),
        ],
        env,
      );
    },
    async get(key, file, maximum) {
      // Request at most maximum+1 bytes; detect oversized objects, including JSON.
      // The CLI streams the body directly to disk; no archive enters stdout/RAM.
      await execute(
        [
          's3api',
          'get-object',
          ...common,
          '--bucket',
          bucket,
          '--key',
          key,
          '--range',
          `bytes=0-${maximum}`,
          file,
        ],
        env,
      );
      await regularFile(file, maximum);
    },
  };
}

async function putImmutable(adapter, key, file, descriptor, temporary) {
  try {
    await adapter.put(key, file, descriptor);
  } catch (error) {
    if (error.code !== 'PreconditionFailed') throw error;
  }
  // A successful first PUT must prove read access and exact stored bytes too.
  // Never publish the index until both payloads have passed this readback.
  const stored = path.join(temporary, 'stored-object');
  try {
    await adapter.get(key, stored, descriptor.bytes);
  } catch (error) {
    const code = allowedCodes.has(error.code) ? error.code : 'ReadbackFailed';
    throw new ArchiveError(`AWS archive readback failed (${code})`);
  }
  const actual = await digestFile(stored, descriptor.bytes);
  requireThat(
    actual.bytes === descriptor.bytes && actual.sha256 === descriptor.sha256,
    'Stored immutable S3 object conflicts with this archive',
  );
}

export async function uploadArchive(
  directory,
  { env = process.env, adapter } = {},
) {
  const source = sourceFromEnvironment(env);
  // Display-only branch/tag name from the original build context, never the
  // uploader checkout. Commit and repository remain bound to the receipt.
  const git = gitReference(source, env.SOURCE_REF_NAME || null);
  bucketFromEnvironment(env);
  adapter ||= createAwsAdapter({ env });
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-simulator-upload-'),
  );
  try {
    for (const [name, maximum] of [
      [archiveFile, limits.archive],
      ['metadata.json', limits.metadata],
    ]) {
      await regularFile(path.join(directory, name), maximum);
      await fs.copyFile(path.join(directory, name), path.join(temporary, name));
    }
    await verifyReceipt(temporary, source);
    const root = source.archiveKey.slice(0, -'archive.json'.length);
    const index = {
      schemaVersion: 2,
      kind: 'rabby-ios-simulator-archive',
      source,
      git,
      objects: {},
    };
    for (const [kind, name] of [
      ['archive', archiveFile],
      ['metadata', 'metadata.json'],
    ]) {
      index.objects[kind] = {
        key: root + name,
        ...(await digestFile(path.join(temporary, name), limits[kind])),
      };
    }
    validateIndex(index, source.archiveKey);
    const indexFile = path.join(temporary, 'archive.json');
    await fs.writeFile(indexFile, JSON.stringify(index, null, 2) + '\n');
    for (const [kind, name] of [
      ['archive', archiveFile],
      ['metadata', 'metadata.json'],
    ]) {
      const descriptor = index.objects[kind];
      await putImmutable(
        adapter,
        descriptor.key,
        path.join(temporary, name),
        descriptor,
        temporary,
      );
    }
    // This is the commit marker. Partial uploads have no usable archive index.
    await putImmutable(
      adapter,
      source.archiveKey,
      indexFile,
      await digestFile(indexFile, limits.index),
      temporary,
    );
    return index;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

export async function fetchArchive(
  key,
  directory,
  { env = process.env, adapter } = {},
) {
  keyIdentity(key);
  bucketFromEnvironment(env);
  adapter ||= createAwsAdapter({ env });
  // A caller must supply a fresh directory; never overwrite a previous receipt.
  await fs.mkdir(directory, { recursive: true });
  requireThat(
    (await fs.lstat(directory)).isDirectory() &&
      !(await fs.lstat(directory)).isSymbolicLink() &&
      (await fs.readdir(directory)).length === 0,
    'Archive destination must be an empty real directory',
  );
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rabby-simulator-fetch-'),
  );
  try {
    const indexFile = path.join(temporary, 'archive.json');
    await adapter.get(key, indexFile, limits.index);
    const index = validateIndex(await readJson(indexFile, limits.index), key);
    for (const [kind, name] of [
      ['metadata', 'metadata.json'],
      ['archive', archiveFile],
    ]) {
      const expected = index.objects[kind];
      const file = path.join(temporary, name);
      await adapter.get(expected.key, file, expected.bytes);
      const actual = await digestFile(file, expected.bytes);
      requireThat(
        actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
        'Downloaded S3 object does not match its archive index',
      );
    }
    await verifyReceipt(temporary, index.source);
    for (const name of [archiveFile, 'metadata.json', 'archive.json']) {
      await fs.copyFile(
        path.join(temporary, name),
        path.join(directory, name),
        fs.constants.COPYFILE_EXCL,
      );
    }
    return index.source;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

export async function main([action, ...args], env = process.env) {
  if (action === 'upload' && args.length === 1) {
    const index = await uploadArchive(args[0], { env });
    if (env.GITHUB_OUTPUT)
      await fs.appendFile(
        env.GITHUB_OUTPUT,
        `archive_key=${index.source.archiveKey}\n`,
      );
    if (env.GITHUB_STEP_SUMMARY)
      await fs.appendFile(
        env.GITHUB_STEP_SUMMARY,
        `\nSimulator archive (diagnostic, not a qualification result):\n\ns3://${bucketFromEnvironment(
          env,
        )}/${index.source.archiveKey}\n`,
      );
    console.log(`Simulator archive saved: ${index.source.archiveKey}`);
    return;
  }
  if (action === 'fetch' && args.length === 2) {
    const source = await fetchArchive(args[0], args[1], { env });
    if (env.GITHUB_OUTPUT)
      await fs.appendFile(
        env.GITHUB_OUTPUT,
        `source=${JSON.stringify(source)}\n`,
      );
    console.log('Simulator archive fetched and verified (diagnostic only)');
    return;
  }
  throw new ArchiveError(
    'Use upload <directory> or fetch <archive-key> <empty-directory>',
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(error => {
    console.error(
      error instanceof ArchiveError
        ? error.message
        : 'Simulator archive operation failed',
    );
    process.exitCode = 1;
  });
}
