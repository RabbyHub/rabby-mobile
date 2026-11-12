#!/usr/bin/env node
/**
 * Pushes a startup KPI measurement result to the Rabby Mobile Lark chat.
 *
 * Input: the JSON produced by collect.sh --json.
 * Credentials: the same webhook pair the mobile CI runners already use
 * (RABBY_MOBILE_LARK_CHAT_URL / _SECRET, falling back to LARK_CHAT_URL/_). When
 * the custom-bot app credentials are present the message is still sent through
 * the webhook, so no extra scope is needed.
 *
 * The message always states which metric is authoritative. `am start -W
 * TotalTime` only covers the splash window and must never be reported as the
 * startup cost on its own.
 */
/* eslint-env node */
const { Buffer } = require('buffer');
const { createHmac } = require('crypto');
const fs = require('fs');
const https = require('https');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function makeSignature(secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = createHmac('sha256', `${timestamp}\n${secret}`)
    .digest()
    .toString('base64');
  return { timestamp, sign };
}

function postJson(urlString, body) {
  const url = new URL(urlString);
  if (url.protocol !== 'https:') {
    throw new Error('Lark webhook must use HTTPS');
  }
  const payload = Buffer.from(JSON.stringify(body));

  return new Promise((resolve, reject) => {
    const request = https.request(
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
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch (_) {
            parsed = { raw: text };
          }
          resolve({ statusCode: response.statusCode, body: parsed });
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

function formatDelta(current, baseline) {
  if (
    typeof current !== 'number' ||
    typeof baseline !== 'number' ||
    baseline === 0
  ) {
    return '';
  }
  const diff = current - baseline;
  const pct = (diff / baseline) * 100;
  const sign = diff > 0 ? '+' : '';
  return ` (${sign}${Math.round(diff)}ms, ${sign}${pct.toFixed(1)}%)`;
}

function buildLines(result) {
  const lines = [];
  const packages = Array.isArray(result.packages) ? result.packages : [];
  const measured = packages.filter(item => item.result === 'OK');

  lines.push(
    `device: ${result.device} · pkg: ${result.pkg} · runs/package: ${result.runs}`,
  );

  for (const item of packages) {
    if (item.result !== 'OK') {
      lines.push(`${item.label}: INVALID (no first-content-frame marker)`);
      continue;
    }
    const routes = Object.entries(item.routes || {})
      .map(([route, count]) => `${route}×${count}`)
      .join(', ');
    const commit = item.commit
      ? ` · commit ${item.commit}${
          item.commitOnDevelop === false ? ' (NOT on develop)' : ''
        }`
      : '';
    lines.push(
      `${item.label}: startup median ${item.contentMedianMs}ms ` +
        `(${item.contentMinMs}-${item.contentMaxMs}) · ` +
        `fully-drawn ${
          item.fullyDrawnMedianMs != null ? `${item.fullyDrawnMedianMs}ms` : 'n/a'
        } · ` +
        `splash TotalTime ${item.totalMedianMs}ms · route ${routes}${commit}`,
    );
  }

  if (measured.length === 2) {
    const [a, b] = measured;
    const preferred = b.contentMedianMs >= a.contentMedianMs ? a : b;
    const slower = preferred === a ? b : a;
    lines.push(
      `delta ${slower.label} vs ${preferred.label}: ` +
        `${formatDelta(
          slower.contentMedianMs,
          preferred.contentMedianMs,
        ).trim()}`,
    );
  }

  // Only the baseline is required to come from develop; a candidate may
  // legitimately be a feature branch.
  const baseline = measured[0];
  if (baseline && baseline.commitOnDevelop === false) {
    lines.push(
      `WARNING: baseline ${baseline.label} was built from ${baseline.commit}, which is not in develop - treat it as a feature-branch comparison, not a shipping baseline.`,
    );
  }

  const invalid = packages.length - measured.length;
  if (invalid > 0) {
    lines.push(
      `WARNING: ${invalid} package(s) produced no marker - their numbers are void, not "no difference".`,
    );
  }

  lines.push(
    'authoritative metric: native first_content_frame (process start → unlock/home); splash TotalTime is shown for reference only.',
  );
  return lines;
}

async function main() {
  const resultFile = required('RABBY_STARTUP_KPI_RESULT_FILE');
  const webhookUrl =
    process.env.RABBY_MOBILE_LARK_CHAT_URL || process.env.LARK_CHAT_URL;
  const webhookSecret =
    process.env.RABBY_MOBILE_LARK_CHAT_SECRET || process.env.LARK_CHAT_SECRET;

  const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const lines = buildLines(result);
  if (process.argv.includes('--dry-run')) {
    // Lets the workflow (and a developer) validate the message without a chat.
    console.log(lines.join('\n'));
    return;
  }
  const runUrl = process.env.GIT_ACTIONS_JOB_URL || '';
  const refName = process.env.GIT_REF_NAME || 'unknown';

  const content = [
    ...lines.map(line => [{ tag: 'text', text: line }]),
    [{ tag: 'text', text: `Git Ref: ${refName}` }],
  ];
  if (runUrl) {
    content.push([
      { tag: 'text', text: 'Actions Job: ' },
      { tag: 'a', href: runUrl, text: runUrl },
    ]);
  }

  if (!webhookUrl || !webhookSecret) {
    throw new Error('Lark webhook url/secret are not configured');
  }

  const { timestamp, sign } = makeSignature(webhookSecret);
  const response = await postJson(webhookUrl, {
    timestamp,
    sign,
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: `[${
            result.platform === 'ios-simulator' ? 'iOS' : 'Android'
          }] Rabby Mobile cold-start KPI`,
          content,
        },
      },
    },
  });

  const code = response.body && response.body.code;
  if (response.statusCode >= 300 || (code !== undefined && code !== 0)) {
    throw new Error(
      `Lark webhook rejected the message: http=${response.statusCode} code=${code}`,
    );
  }
  console.log(
    `[startup-kpi] lark notified http=${response.statusCode} code=${code}`,
  );
}

main().catch(error => {
  console.error(`[startup-kpi] ${error.message}`);
  process.exit(1);
});
