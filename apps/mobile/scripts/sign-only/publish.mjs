#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import readline from 'node:readline';

const DEFAULT_SERVICE_URL = 'https://rabby-fe-opcode-service.dbkops.com';
const TOKEN_FILE = path.join(
  os.homedir(),
  '.config',
  'opfe',
  'sign-only-token',
);

let JSON_MODE = false;

function log(...args) {
  if (JSON_MODE) console.error(...args);
  else console.log(...args);
}

function parseArgs(argv) {
  const result = {
    platform: '',
    file: '',
    serviceUrl: '',
    token: '',
    sourceSha: '',
    sourceDirty: null,
    prepare: false,
    notifyLark: false,
    force: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--platform':
        result.platform = argv[++i] || '';
        break;
      case '--file':
        result.file = argv[++i] || '';
        break;
      case '--service-url':
        result.serviceUrl = argv[++i] || '';
        break;
      case '--token':
        result.token = argv[++i] || '';
        break;
      case '--source-sha':
        result.sourceSha = argv[++i] || '';
        break;
      case '--source-dirty':
        result.sourceDirty = true;
        break;
      case '--source-clean':
        result.sourceDirty = false;
        break;
      case '--prepare':
        result.prepare = true;
        break;
      case '--notify-lark':
        result.notifyLark = true;
        break;
      case '--force':
        result.force = true;
        break;
      case '--json':
        result.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  result.serviceUrl =
    result.serviceUrl ||
    process.env.OPFE_SIGN_ONLY_SERVICE_URL ||
    DEFAULT_SERVICE_URL;
  result.token =
    result.token || process.env.OPFE_SIGN_ONLY_TOKEN || readTokenFile() || '';

  if (!['android', 'ios'].includes(result.platform))
    throw new Error('--platform must be android or ios');
  if (!result.file || !fs.existsSync(result.file))
    throw new Error('--file does not exist');
  JSON_MODE = result.json;
  if (!result.token)
    throw new Error(
      `--token, OPFE_SIGN_ONLY_TOKEN or ${TOKEN_FILE} is required (create one in the opcode dashboard)`,
    );
  return result;
}

function readTokenFile() {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function gitOutput(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function resolveSourceState(args) {
  const sha = args.sourceSha || gitOutput(['rev-parse', 'HEAD']);
  const dirty =
    args.sourceDirty === null
      ? gitOutput(['status', '--porcelain', '--untracked-files=no']).length > 0
      : args.sourceDirty;
  return { sha, dirty };
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error = new Error(payload?.message || `HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function uploadFile(uploadUrl, filePath, headers, size) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const transport = url.protocol === 'http:' ? http : https;
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'PUT',
        headers: { ...headers, 'Content-Length': size },
      },
      response => {
        response.resume();
        if (
          response.statusCode &&
          response.statusCode >= 200 &&
          response.statusCode < 300
        ) {
          resolve();
        } else {
          reject(new Error(`Upload failed with HTTP ${response.statusCode}`));
        }
      },
    );
    request.on('error', reject);
    fs.createReadStream(filePath).on('error', reject).pipe(request);
  });
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function findPreviousSigned(args, headers, baseUrl, sourceSha) {
  if (!sourceSha) return null;
  try {
    const listed = await requestJson(`${baseUrl}/v1/api/sign-only-packages`, {
      method: 'GET',
      headers,
    });
    const packages = listed?.data?.packages || [];
    return (
      packages.find(
        item =>
          item.platform === args.platform &&
          item.status === 'signed' &&
          item.sourceSha === sourceSha,
      ) || null
    );
  } catch (error) {
    console.warn(
      `[sign-only] could not look up previous packages: ${error.message}`,
    );
    return null;
  }
}

function parseGhCommand(command) {
  const repo = command.match(/--repo\s+'([^']+)'/)?.[1] || '';
  const ref = command.match(/--ref\s+'([^']+)'/)?.[1] || '';
  const inputs = {};
  const pattern = /-f\s+([A-Za-z0-9_-]+)=('(?:[^']|'\\'')*'|\S+)/g;
  let match;
  while ((match = pattern.exec(command))) {
    let value = match[2];
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/'\\''/g, "'");
    }
    inputs[match[1]] = value;
  }
  return { repo, ref, inputs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileName = path.basename(args.file);
  const size = fs.statSync(args.file).size;
  const baseUrl = args.serviceUrl.replace(/\/+$/, '');
  const headers = {
    Authorization: `Bearer ${args.token}`,
    'Content-Type': 'application/json',
  };
  const { sha: sourceSha, dirty: sourceDirty } = resolveSourceState(args);

  const previous = await findPreviousSigned(args, headers, baseUrl, sourceSha);
  if (previous && !args.force) {
    log('[sign-only] a signed package already exists for this commit:');
    log(`  request : ${previous.requestId}`);
    log(`  signed  : ${previous.signedArtifactUrl || '(not recorded)'}`);
    log(`  run     : ${previous.workflowRunUrl || '-'}`);
    if (process.stdin.isTTY) {
      const answer = await ask(
        '[sign-only] build and sign again anyway? [y/N] ',
      );
      if (!['y', 'yes'].includes(answer)) {
        log('[sign-only] keeping the existing signed package.');
        return;
      }
    } else {
      log(
        '[sign-only] non-interactive shell, continuing (use --force to skip this check).',
      );
    }
  }

  const sha256 = await sha256File(args.file);
  const intent = await requestJson(`${baseUrl}/v1/api/sign-only-packages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      platform: args.platform,
      fileName,
      byteSize: size,
      sourceSha: sourceSha || undefined,
      sourceDirty,
    }),
  });
  const data = intent?.data;
  if (!data?.uploadUrl || !data?.package?.id) {
    throw new Error('Sign-only upload intent was not created');
  }

  log(`[sign-only] request: ${data.package.requestId}`);
  log(`[sign-only] uploading ${fileName} (${size} bytes)...`);
  await uploadFile(data.uploadUrl, args.file, data.requestHeaders || {}, size);

  const completed = await requestJson(
    `${baseUrl}/v1/api/sign-only-packages/${data.package.id}/complete`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ sha256 }),
    },
  );
  log(
    `[sign-only] uploaded package id=${completed?.data?.id || data.package.id}`,
  );

  if (!args.prepare) return;

  const prepared = await requestJson(
    `${baseUrl}/v1/api/sign-only-packages/${data.package.id}/prepare-sign`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ notifyLark: args.notifyLark }),
    },
  );
  log(`[sign-only] dashboard: ${baseUrl}/#/delivery/sign-only-packages`);
  log(`[sign-only] workflow : ${prepared?.data?.workflowUrl || ''}`);
  log('[sign-only] run this yourself with your GitHub identity:');
  log(prepared?.data?.ghCommand || '');

  if (args.json) {
    const workflow = parseGhCommand(prepared?.data?.ghCommand || '');
    console.log(
      JSON.stringify({
        platform: args.platform,
        packageId: data.package.id,
        requestId: data.package.requestId,
        file: args.file,
        notifyLark: args.notifyLark,
        sourceSha: sourceSha || '',
        sourceDirty,
        workflow: {
          url: prepared?.data?.workflowUrl || '',
          ghCommand: prepared?.data?.ghCommand || '',
          repo: workflow.repo,
          ref: workflow.ref,
          inputs: workflow.inputs,
        },
      }),
    );
  }
}

main().catch(error => {
  console.error(`[sign-only] ${error.message}`);
  process.exit(1);
});
