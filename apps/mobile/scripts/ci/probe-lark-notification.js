#!/usr/bin/env node

const { createHmac } = require('crypto');
const { Buffer } = require('buffer');
const http = require('http');
const https = require('https');

const args = new Set(process.argv.slice(2));
const diagnoseOnly = args.has('--diagnose-only');

const effective = {
  url: process.env.RABBY_MOBILE_LARK_CHAT_URL || '',
  secret: process.env.RABBY_MOBILE_LARK_CHAT_SECRET || '',
};
const github = {
  url: process.env.RABBY_MOBILE_LARK_CHAT_URL_FROM_GITHUB || '',
  secret: process.env.RABBY_MOBILE_LARK_CHAT_SECRET_FROM_GITHUB || '',
};

function printDiagnostics() {
  console.log(
    JSON.stringify({
      effectiveUrlPresent: Boolean(effective.url),
      effectiveSecretPresent: Boolean(effective.secret),
      githubUrlPresent: Boolean(github.url),
      githubSecretPresent: Boolean(github.secret),
      effectiveUrlMatchesGithub:
        Boolean(effective.url) && effective.url === github.url,
      effectiveSecretMatchesGithub:
        Boolean(effective.secret) && effective.secret === github.secret,
    }),
  );
}

function makeSignature(secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = createHmac('sha256', stringToSign).digest().toString('base64');

  return { timestamp, sign };
}

function postJson(urlString, body) {
  const url = new URL(urlString);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Lark webhook URL must use HTTP or HTTPS');
  }

  const payload = Buffer.from(JSON.stringify(body));
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      },
      response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const responseText = Buffer.concat(chunks).toString('utf8');
          let responseBody = {};
          try {
            responseBody = responseText ? JSON.parse(responseText) : {};
          } catch (_) {
            responseBody = {};
          }

          const statusCode = response.statusCode || 0;
          const larkCode = responseBody.code ?? responseBody.StatusCode;
          const larkMessage = String(
            responseBody.msg ?? responseBody.StatusMessage ?? '',
          ).slice(0, 200);

          if (statusCode < 200 || statusCode >= 300 || Number(larkCode) !== 0) {
            reject(
              new Error(
                `Lark webhook failed: http=${statusCode} code=${String(
                  larkCode ?? 'unknown',
                )} message=${larkMessage || 'unknown'}`,
              ),
            );
            return;
          }

          resolve({ statusCode, larkCode, larkMessage });
        });
      },
    );

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error('Lark webhook request timed out'));
    });
    request.end(payload);
  });
}

async function main() {
  printDiagnostics();
  if (diagnoseOnly) {
    return;
  }

  if (!github.url || !github.secret) {
    throw new Error('GitHub-injected Lark webhook credentials are missing');
  }

  const { timestamp, sign } = makeSignature(github.secret);
  const runUrl = process.env.GIT_ACTIONS_JOB_URL || '';
  const refName = process.env.GIT_REF_NAME || 'unknown';
  const content = [
    [{ tag: 'text', text: 'iOS runner notification probe succeeded.' }],
    [{ tag: 'text', text: `Git Ref: ${refName}` }],
  ];
  if (runUrl) {
    content.push([
      { tag: 'text', text: 'Actions Job: ' },
      { tag: 'a', href: runUrl, text: runUrl },
    ]);
  }

  const result = await postJson(github.url, {
    timestamp,
    sign,
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: '[iOS] Rabby Mobile notification probe',
          content,
        },
      },
    },
  });

  console.log(
    `[probe-lark-notification] success http=${result.statusCode} code=${String(
      result.larkCode,
    )}`,
  );
}

main().catch(error => {
  console.error(`[probe-lark-notification] ${error.message}`);
  process.exitCode = 1;
});
