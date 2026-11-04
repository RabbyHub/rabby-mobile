import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { sendNotification } from '../ios-startup-smoke/notify.mjs';

const executeFile = promisify(execFile);
const prefix = '_private/toolchains/apple/xcode/';
const expiresIn = 3600;
const maximumJsonBytes = 64 * 1024;
const bootstrapRegion = 'ap-northeast-1';
const catalogUrl = new URL('./catalog.json', import.meta.url);

class DownloadError extends Error {}

function fail(message) {
  throw new DownloadError(message);
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function matches(value, pattern, maximum) {
  return (
    typeof value === 'string' &&
    value.length <= maximum &&
    value.trim() === value &&
    pattern.test(value)
  );
}

function validTimestamp(value) {
  if (!matches(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/, 24))
    return false;
  const time = Date.parse(value);
  return (
    Number.isFinite(time) &&
    new Date(time).toISOString().replace('.000Z', 'Z') ===
      value.replace('.000Z', 'Z')
  );
}

export function validateCatalog(catalog) {
  if (
    !isObject(catalog) ||
    Object.keys(catalog).sort().join(',') !== 'entries,schemaVersion' ||
    catalog.schemaVersion !== 1 ||
    !Array.isArray(catalog.entries) ||
    catalog.entries.length < 1 ||
    catalog.entries.length > 16
  )
    fail('Invalid Xcode download catalog');
  const identities = new Set();
  const keys = new Set();
  const required = [
    'version',
    'build',
    'architecture',
    'filename',
    'bytes',
    'sha256',
    'key',
    'uploadedAt',
    'source',
    'signature',
  ];
  const entries = catalog.entries.map(entry => {
    if (
      !isObject(entry) ||
      required.some(key => !Object.hasOwn(entry, key)) ||
      Object.keys(entry).some(
        key => !required.includes(key) && key !== 'versionId',
      ) ||
      !matches(entry.version, /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/, 8) ||
      !matches(entry.build, /^\d{1,3}[A-Z]\d{1,6}[a-z]?$/, 11) ||
      !['arm64', 'universal'].includes(entry.architecture) ||
      !matches(
        entry.filename,
        /^Xcode_[A-Za-z0-9][A-Za-z0-9._-]*\.xip$/,
        128,
      ) ||
      entry.filename.includes('..') ||
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes <= 0 ||
      !matches(entry.sha256, /^[a-f0-9]{64}$/, 64) ||
      !validTimestamp(entry.uploadedAt) ||
      entry.source !== 'https://developer.apple.com/download/all/' ||
      entry.signature !== 'Apple Software' ||
      (Object.hasOwn(entry, 'versionId') &&
        !matches(entry.versionId, /^[A-Za-z0-9+/.=_-]+$/, 1024))
    )
      fail('Invalid Xcode download catalog entry');
    const identity = `${entry.version}-${entry.build}-${entry.architecture}`;
    if (
      entry.key !== `${prefix}${identity}-${entry.sha256}/${entry.filename}` ||
      identities.has(identity) ||
      keys.has(entry.key)
    )
      fail('Invalid or duplicate Xcode catalog object');
    identities.add(identity);
    keys.add(entry.key);
    return { ...entry };
  });
  return { schemaVersion: 1, entries };
}

function validateEntry(entry) {
  return validateCatalog({ schemaVersion: 1, entries: [entry] }).entries[0];
}

function bucketFromEnvironment(env) {
  const bucket = env.RABBY_MOBILE_BUILD_BUCKET;
  if (
    !matches(bucket, /^[a-z0-9][a-z0-9.-]+[a-z0-9]$/, 63) ||
    bucket.length < 3 ||
    bucket.includes('..') ||
    bucket.includes('.-') ||
    bucket.includes('-.') ||
    /^\d+\.\d+\.\d+\.\d+$/.test(bucket)
  )
    fail('Xcode download bucket is missing or invalid');
  return bucket;
}

function validateRegion(region) {
  if (
    !matches(
      region,
      /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|west|north|northeast|northwest|south|southeast|southwest)-[1-9]\d?$/,
      32,
    )
  )
    fail('Unsupported Xcode download bucket region');
  return region;
}

function parseJson(value) {
  try {
    if (
      typeof value !== 'string' ||
      Buffer.byteLength(value) > maximumJsonBytes
    )
      throw new Error();
    return JSON.parse(value);
  } catch {
    fail('Invalid AWS Xcode download response');
  }
}

function validateHead(entry, head) {
  // This archive's privacy contract depends on SSE-KMS excluding legacy OAI
  // access. Never issue links after an encryption downgrade or missing evidence.
  if (
    !isObject(head) ||
    head.ContentLength !== entry.bytes ||
    head.Metadata?.sha256 !== entry.sha256 ||
    head.DeleteMarker === true ||
    head.SSECustomerAlgorithm !== undefined ||
    head.ServerSideEncryption !== 'aws:kms' ||
    head.VersionId !== entry.versionId
  )
    fail('S3 Xcode object does not match the trusted catalog');
  return head;
}

function awsEnvironment(env) {
  const child = {};
  for (const name of [
    'PATH',
    'HOME',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'http_proxy',
    'https_proxy',
    'no_proxy',
  ])
    if (env[name] !== undefined) child[name] = env[name];
  return {
    ...child,
    AWS_PROFILE: 'default',
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: 'true',
    AWS_MAX_ATTEMPTS: '2',
    AWS_RETRY_MODE: 'standard',
    AWS_PAGER: '',
    AWS_CLI_AUTO_PROMPT: 'off',
  };
}

async function executeAws(args, env) {
  try {
    const result = await executeFile('aws', args, {
      env,
      encoding: 'utf8',
      shell: false,
      timeout: 45_000,
      killSignal: 'SIGKILL',
      maxBuffer: maximumJsonBytes,
    });
    return result.stdout;
  } catch {
    // CLI stderr and errors can contain credentials or a presigned URL.
    fail('AWS Xcode download operation failed');
  }
}

function canonicalSigningTime(value) {
  if (!matches(value, /^\d{8}T\d{6}Z$/, 16)) return NaN;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
    6,
    8,
  )}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
  return validTimestamp(iso) ? Date.parse(iso) : NaN;
}

export function validatePresignedUrl(
  raw,
  { bucket, entry, region, now = Date.now },
) {
  try {
    if (
      typeof raw !== 'string' ||
      raw.length > 8192 ||
      /[\x00-\x20\x7f]/.test(raw)
    )
      throw new Error();
    const url = new URL(raw);
    const virtualHost = `${bucket}.s3.${region}.amazonaws.com`;
    const pathHost = `s3.${region}.amazonaws.com`;
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      !(
        (url.hostname === virtualHost && url.pathname === `/${entry.key}`) ||
        (url.hostname === pathHost &&
          url.pathname === `/${bucket}/${entry.key}`)
      )
    )
      throw new Error();
    const params = url.searchParams;
    const required = [
      'X-Amz-Algorithm',
      'X-Amz-Credential',
      'X-Amz-Date',
      'X-Amz-Expires',
      'X-Amz-SignedHeaders',
      'X-Amz-Signature',
    ];
    const allowed = [...required, 'X-Amz-Security-Token', 'x-id'];
    if (
      [...params.keys()].some(
        key => !allowed.includes(key) || params.getAll(key).length !== 1,
      ) ||
      required.some(key => !params.has(key)) ||
      params.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' ||
      params.get('X-Amz-Expires') !== String(expiresIn) ||
      params.get('X-Amz-SignedHeaders') !== 'host' ||
      !matches(params.get('X-Amz-Signature'), /^[a-f0-9]{64}$/, 64) ||
      (params.has('x-id') && params.get('x-id') !== 'GetObject') ||
      (params.has('X-Amz-Security-Token') &&
        !matches(
          params.get('X-Amz-Security-Token'),
          /^[A-Za-z0-9+/=_-]+$/,
          4096,
        ))
    )
      throw new Error();
    const signedAt = canonicalSigningTime(params.get('X-Amz-Date'));
    const time = now();
    const scope = params.get('X-Amz-Credential').split('/');
    if (
      scope.length !== 5 ||
      !matches(scope[0], /^[A-Z0-9]{16,128}$/, 128) ||
      scope[1] !== params.get('X-Amz-Date').slice(0, 8) ||
      scope[2] !== region ||
      scope[3] !== 's3' ||
      scope[4] !== 'aws4_request' ||
      !Number.isFinite(signedAt) ||
      !Number.isFinite(time) ||
      signedAt < time - 300_000 ||
      signedAt > time + 60_000 ||
      entry.versionId !== undefined
    )
      throw new Error();
    return {
      url: raw,
      expiresAt: new Date(signedAt + expiresIn * 1000).toISOString(),
    };
  } catch {
    fail('Invalid presigned Xcode download URL');
  }
}

export function createAwsAdapter({
  env = process.env,
  execute = executeAws,
  now = Date.now,
} = {}) {
  const bucket = bucketFromEnvironment(env);
  const childEnv = awsEnvironment(env);
  const common = [
    '--profile',
    'default',
    '--no-cli-pager',
    '--no-cli-auto-prompt',
    '--cli-connect-timeout',
    '10',
    '--cli-read-timeout',
    '20',
  ];
  const regional = region => [
    '--region',
    region,
    '--endpoint-url',
    `https://s3.${region}.amazonaws.com`,
  ];
  let location;
  async function run(args) {
    try {
      return await execute(args, childEnv);
    } catch {
      fail('AWS Xcode download operation failed');
    }
  }
  function region() {
    location ||= (async () => {
      const response = parseJson(
        await run([
          's3api',
          'get-bucket-location',
          '--bucket',
          bucket,
          '--output',
          'json',
          ...common,
          ...regional(bootstrapRegion),
        ]),
      );
      if (!isObject(response) || !Object.hasOwn(response, 'LocationConstraint'))
        fail('Invalid AWS Xcode download response');
      return validateRegion(
        response.LocationConstraint === null
          ? 'us-east-1'
          : response.LocationConstraint === 'EU'
          ? 'eu-west-1'
          : response.LocationConstraint,
      );
    })();
    return location;
  }
  return {
    async head(value) {
      const entry = validateEntry(value);
      const selectedRegion = await region();
      const args = [
        's3api',
        'head-object',
        '--bucket',
        bucket,
        '--key',
        entry.key,
        '--output',
        'json',
        ...common,
        ...regional(selectedRegion),
      ];
      if (entry.versionId !== undefined)
        args.push('--version-id', entry.versionId);
      return validateHead(entry, parseJson(await run(args)));
    },
    async presign(value) {
      const entry = validateEntry(value);
      if (entry.versionId !== undefined)
        fail('AWS CLI cannot sign version-pinned Xcode download links');
      const selectedRegion = await region();
      const output = await run([
        's3',
        'presign',
        `s3://${bucket}/${entry.key}`,
        '--expires-in',
        String(expiresIn),
        ...common,
        ...regional(selectedRegion),
      ]);
      // AWS CLI writes one line. Never forward stdout to the workflow log.
      const url =
        typeof output === 'string' ? output.replace(/\r?\n$/, '') : output;
      return validatePresignedUrl(url, {
        bucket,
        entry,
        region: selectedRegion,
        now,
      });
    },
  };
}

export async function prepareDownloadNotification(
  catalog,
  { env = process.env, adapter, now = Date.now } = {},
) {
  const { entries } = validateCatalog(catalog);
  if (entries.some(entry => entry.versionId !== undefined))
    fail('AWS CLI cannot sign version-pinned Xcode download links');
  adapter ||= createAwsAdapter({ env, now });
  const lines = [
    '仅限内部使用；链接有效期 3600 秒，请勿转发到公开渠道。',
    '下载完成后请核对下面的完整 SHA-256，再验证 Apple Software 签名。',
  ];
  try {
    // Verify the complete catalog before generating any bearer links.
    for (const entry of entries) validateHead(entry, await adapter.head(entry));
    for (const entry of entries) {
      const signed = await adapter.presign(entry);
      lines.push(
        `Xcode ${entry.version} · ${entry.build} · ${entry.architecture}`,
        `文件：${entry.filename} · ${entry.bytes} bytes`,
        `SHA-256：${entry.sha256}`,
        `到期（UTC）：${signed.expiresAt}`,
        `下载：${signed.url}`,
      );
    }
  } catch (error) {
    if (error instanceof DownloadError) throw error;
    fail('Xcode download link preparation failed');
  }
  return { title: 'Xcode 工具链 · 私有下载链接', lines };
}

export async function sendDownloads(
  catalog,
  { env = process.env, adapter, fetchImpl = fetch, now = Date.now } = {},
) {
  const message = await prepareDownloadNotification(catalog, {
    env,
    adapter,
    now,
  });
  try {
    await sendNotification(message, { env, fetchImpl, now });
  } catch {
    fail('Xcode download notification failed; check delivery before retrying');
  }
  return { count: catalog.entries.length };
}

async function readCatalog() {
  const stat = await fs.lstat(catalogUrl);
  if (!stat.isFile() || stat.size <= 0 || stat.size > maximumJsonBytes)
    fail('Invalid Xcode download catalog file');
  return parseJson(await fs.readFile(catalogUrl, 'utf8'));
}

export async function main(args = [], options = {}) {
  if (args.length) fail('Xcode download notification takes no arguments');
  const catalog = await (options.readCatalog || readCatalog)();
  const result = await sendDownloads(catalog, options);
  console.log(
    `Xcode download notification delivered (${result.count} entries)`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(() => {
    console.error(
      'Xcode download notification failed; inspect configuration and delivery before retrying',
    );
    process.exitCode = 1;
  });
}
