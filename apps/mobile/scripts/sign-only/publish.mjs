#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

function parseArgs(argv) {
  const result = {
    platform: '',
    file: '',
    serviceUrl: '',
    token: '',
    sourceSha: '',
    sourceDirty: false,
    prepare: false,
    notifyLark: false,
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
      case '--prepare':
        result.prepare = true;
        break;
      case '--notify-lark':
        result.notifyLark = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  result.serviceUrl =
    result.serviceUrl || process.env.OPFE_SIGN_ONLY_SERVICE_URL || '';
  result.token = result.token || process.env.OPFE_SIGN_ONLY_TOKEN || '';
  if (!['android', 'ios'].includes(result.platform))
    throw new Error('--platform must be android or ios');
  if (!result.file || !fs.existsSync(result.file))
    throw new Error('--file does not exist');
  if (!result.serviceUrl)
    throw new Error('--service-url or OPFE_SIGN_ONLY_SERVICE_URL is required');
  if (!result.token)
    throw new Error('--token or OPFE_SIGN_ONLY_TOKEN is required');
  return result;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileName = path.basename(args.file);
  const size = fs.statSync(args.file).size;
  const baseUrl = args.serviceUrl.replace(/\/+$/, '');
  const headers = {
    Authorization: `Bearer ${args.token}`,
    'Content-Type': 'application/json',
  };

  const intent = await requestJson(`${baseUrl}/v1/api/sign-only-packages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      platform: args.platform,
      fileName,
      byteSize: size,
      sourceSha: args.sourceSha || undefined,
      sourceDirty: args.sourceDirty,
    }),
  });
  const data = intent?.data;
  if (!data?.uploadUrl || !data?.package?.id) {
    throw new Error('Sign-only upload intent was not created');
  }

  console.log(`[sign-only] request: ${data.package.requestId}`);
  console.log(`[sign-only] uploading ${fileName} (${size} bytes)...`);
  await uploadFile(data.uploadUrl, args.file, data.requestHeaders || {}, size);

  const completed = await requestJson(
    `${baseUrl}/v1/api/sign-only-packages/${data.package.id}/complete`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    },
  );
  console.log(
    `[sign-only] uploaded package id=${completed?.data?.id || data.package.id}`,
  );

  if (args.prepare) {
    const prepared = await requestJson(
      `${baseUrl}/v1/api/sign-only-packages/${data.package.id}/prepare-sign`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ notifyLark: args.notifyLark }),
      },
    );
    console.log(`[sign-only] workflow: ${prepared?.data?.workflowUrl || ''}`);
    console.log('[sign-only] run this yourself with your GitHub identity:');
    console.log(prepared?.data?.ghCommand || '');
  }
}

main().catch(error => {
  console.error(`[sign-only] ${error.message}`);
  process.exit(1);
});
