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
  appId: process.env.RABBY_ROBOT_LARK_APP_ID_FROM_GITHUB || '',
  appSecret: process.env.RABBY_ROBOT_LARK_APP_SECRET_FROM_GITHUB || '',
};

function printDiagnostics() {
  console.log(
    JSON.stringify({
      effectiveUrlPresent: Boolean(effective.url),
      effectiveSecretPresent: Boolean(effective.secret),
      githubUrlPresent: Boolean(github.url),
      githubSecretPresent: Boolean(github.secret),
      effectiveAppIdPresent: Boolean(process.env.RABBY_ROBOT_LARK_APP_ID),
      effectiveAppSecretPresent: Boolean(
        process.env.RABBY_ROBOT_LARK_APP_SECRET,
      ),
      githubAppIdPresent: Boolean(github.appId),
      githubAppSecretPresent: Boolean(github.appSecret),
      effectiveUrlMatchesGithub:
        Boolean(effective.url) && effective.url === github.url,
      effectiveSecretMatchesGithub:
        Boolean(effective.secret) && effective.secret === github.secret,
      effectiveAppIdMatchesGithub:
        Boolean(process.env.RABBY_ROBOT_LARK_APP_ID) &&
        process.env.RABBY_ROBOT_LARK_APP_ID === github.appId,
      effectiveAppSecretMatchesGithub:
        Boolean(process.env.RABBY_ROBOT_LARK_APP_SECRET) &&
        process.env.RABBY_ROBOT_LARK_APP_SECRET === github.appSecret,
    }),
  );
}

function makeSignature(secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = createHmac('sha256', stringToSign).digest().toString('base64');

  return { timestamp, sign };
}

function postPayload({ urlString, payload, headers, stage }) {
  const url = new URL(urlString);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${stage} URL must use HTTP or HTTPS`);
  }

  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
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
                `${stage} failed: http=${statusCode} code=${String(
                  larkCode ?? 'unknown',
                )} message=${larkMessage || 'unknown'}`,
              ),
            );
            return;
          }

          resolve({ statusCode, larkCode, larkMessage, responseBody });
        });
      },
    );

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error(`${stage} request timed out`));
    });
    request.end(payload);
  });
}

function postJson(urlString, body, stage, headers = {}) {
  return postPayload({
    urlString,
    payload: Buffer.from(JSON.stringify(body)),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    stage,
  });
}

async function getTenantAccessToken() {
  const result = await postJson(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/',
    {
      app_id: github.appId,
      app_secret: github.appSecret,
    },
    'tenant token',
  );
  const accessToken = result.responseBody.tenant_access_token;
  if (!accessToken) {
    throw new Error('tenant token response did not include an access token');
  }
  console.log(
    `[probe-lark-notification] tenant token success http=${
      result.statusCode
    } code=${String(result.larkCode)}`,
  );
  return accessToken;
}

async function uploadProbeImage(accessToken) {
  const boundary = `----RabbyMobileLarkProbe${Date.now()}`;
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image_type"\r\n\r\nmessage\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="probe.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    image,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const result = await postPayload({
    urlString: 'https://open.larksuite.com/open-apis/im/v1/images',
    payload,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${accessToken}`,
    },
    stage: 'image upload',
  });
  const imageKey = result.responseBody.data?.image_key;
  if (!imageKey) {
    throw new Error('image upload response did not include an image key');
  }
  console.log(
    `[probe-lark-notification] image upload success http=${
      result.statusCode
    } code=${String(result.larkCode)}`,
  );
  return imageKey;
}

async function main() {
  printDiagnostics();
  if (diagnoseOnly) {
    return;
  }

  if (!github.url || !github.secret || !github.appId || !github.appSecret) {
    throw new Error(
      'GitHub-injected Lark notification credentials are missing',
    );
  }

  const accessToken = await getTenantAccessToken();
  const imageKey = await uploadProbeImage(accessToken);
  const { timestamp, sign } = makeSignature(github.secret);
  const runUrl = process.env.GIT_ACTIONS_JOB_URL || '';
  const refName = process.env.GIT_REF_NAME || 'unknown';
  const content = [
    [{ tag: 'text', text: 'iOS runner notification probe succeeded.' }],
    [{ tag: 'img', image_key: imageKey }],
    [{ tag: 'text', text: `Git Ref: ${refName}` }],
  ];
  if (runUrl) {
    content.push([
      { tag: 'text', text: 'Actions Job: ' },
      { tag: 'a', href: runUrl, text: runUrl },
    ]);
  }

  const result = await postJson(
    github.url,
    {
      timestamp,
      sign,
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: '[iOS] Rabby Mobile full-path notification probe',
            content,
          },
        },
      },
    },
    'webhook send',
  );

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
