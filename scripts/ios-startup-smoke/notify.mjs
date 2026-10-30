import { createHmac } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { matrix } from './hosted.mjs';
import { requiredMajors } from './run.mjs';
import { validateProbeSource } from './probe.mjs';

const repository = 'RabbyHub/rabby-mobile';
const statuses = {
  success: '成功',
  failure: '失败',
  cancelled: '已取消',
  skipped: '未执行',
  unknown: '状态未知',
};

function parseJSON(value, limit = 16384) {
  if (typeof value !== 'string' || value.length > limit) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function positiveInteger(value) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

function validReport(envelope, env, targets, { probe, source }) {
  const report = envelope?.report;
  if (
    !targets.length ||
    envelope?.schemaVersion !== 1 ||
    envelope.runId !== env.GITHUB_RUN_ID ||
    !positiveInteger(envelope.runAttempt) ||
    Number(envelope.runAttempt) > Number(env.GITHUB_RUN_ATTEMPT) ||
    report?.commit !== (probe ? source?.sourceCommit : env.GITHUB_SHA) ||
    report?.mode !== (probe ? 'probe' : 'qualification') ||
    (probe &&
      (!source ||
        report.harnessCommit !== env.GITHUB_SHA ||
        !isDeepStrictEqual(report.artifactSource, source))) ||
    report.environment !== (env.EXECUTION_ENVIRONMENT || 'mobile-local') ||
    !Array.isArray(report.rows) ||
    report.rows.length !== targets.length ||
    !targets.every(target => {
      const rows = report.rows.filter(row => row?.major === target.major);
      const row = rows[0];
      return (
        rows.length === 1 &&
        row.runtime === target.runtime &&
        row.xcode === target.xcode &&
        ['passed', 'failed-or-missing'].includes(row.status)
      );
    })
  )
    return undefined;
  const passed = report.rows.every(row => row.status === 'passed');
  const full = targets.length === requiredMajors.length;
  if (
    report.passed !== passed ||
    report.fullCoverage !== full ||
    report.qualificationPassed !== (!probe && passed && full)
  )
    return undefined;
  return report;
}

/** Pure presentation of the summary owner's evidence; never infer a crash. */
export function createNotification(env) {
  if (
    env.GITHUB_REPOSITORY !== repository ||
    env.GITHUB_SHA?.length !== 40 ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') ||
    !positiveInteger(env.GITHUB_RUN_ID) ||
    !positiveInteger(env.GITHUB_RUN_ATTEMPT)
  )
    throw new Error('Invalid notification run context');

  const mode = env.NOTIFICATION_MODE || 'startup';
  if (!['startup', 'probe'].includes(mode))
    throw new Error('Invalid notification mode');
  const probe = mode === 'probe';
  let source;
  if (probe) {
    try {
      source = validateProbeSource(parseJSON(env.PROBE_SOURCE));
    } catch {
      // A resolver failure must still notify, never substitute the harness SHA.
    }
  }

  const needs = parseJSON(env.STARTUP_NEEDS, 65536);
  const state = name => {
    const result = needs?.[name]?.result;
    return typeof result === 'string' && Object.hasOwn(statuses, result)
      ? result
      : 'unknown';
  };
  const buildOnly = !probe && env.BUILD_ONLY === 'true';
  const environment = env.EXECUTION_ENVIRONMENT || 'mobile-local';
  let targets = [];
  try {
    targets = matrix(
      env.REQUESTED_MAJORS || '16,17,18,26,27',
      probe ? '27.1' : env.BUILD_XCODE || '27.1',
      environment,
    ).include;
  } catch {
    // Invalid matrix input must not prevent reporting the failed preparation.
  }
  const envelope = parseJSON(env.STARTUP_REPORT);
  const report = buildOnly
    ? undefined
    : validReport(envelope, env, targets, { probe, source });
  const jobsPassed = (
    probe
      ? ['resolve', 'startup', 'summary']
      : ['matrix', 'build', 'startup', 'summary']
  ).every(name => state(name) === 'success');
  const passed = report?.passed === true && jobsPassed;
  let outcome;
  if (buildOnly) {
    outcome = ['matrix', 'build', 'summary'].every(
      name => state(name) === 'success',
    )
      ? '构建完成（未验证启动）'
      : '仅构建流程未通过';
  } else if (probe) {
    outcome = passed
      ? report.fullCoverage
        ? 'Probe 全矩阵复测通过（诊断）'
        : 'Probe 所选版本通过（部分覆盖／诊断）'
      : 'Probe 复测未通过／未完成';
  } else {
    outcome = passed
      ? report.fullCoverage
        ? '完整启动检查通过'
        : '所选版本通过（部分覆盖）'
      : '启动检查未通过／未完成';
    if (passed && state('archive') !== 'success') outcome += ' · 归档未完成';
  }
  const ref = String(env.GITHUB_REF_NAME || '(unknown)')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 200);
  const runUrl = `https://github.com/${repository}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}`;
  const lines = [
    `仓库：${repository} · 分支：${ref}`,
    ...(probe
      ? [
          `App source commit：${
            source?.sourceCommit || '未知（缺少有效来源）'
          }`,
          `测试脚本 commit：${env.GITHUB_SHA}`,
          `测试脚本：https://github.com/${repository}/commit/${env.GITHUB_SHA}`,
          ...(source
            ? [
                `App 提交：https://github.com/${repository}/commit/${source.sourceCommit}`,
                `原构建 Run：${source.runId} · 第 ${source.runAttempt} 次尝试 · artifact：${source.artifactId} · 原结果：${source.runConclusion}`,
              ]
            : []),
        ]
      : [
          `Commit：${env.GITHUB_SHA}`,
          `提交：https://github.com/${repository}/commit/${env.GITHUB_SHA}`,
        ]),
    `Run：${env.GITHUB_RUN_ID} · 第 ${env.GITHUB_RUN_ATTEMPT} 次尝试`,
    `环境：${
      ['mobile-local', 'hosted'].includes(environment)
        ? environment
        : '配置无效'
    } · App Xcode：${
      probe
        ? typeof report?.buildXcode === 'string' &&
          /^Xcode [0-9.]+\nBuild version [a-zA-Z0-9]+$/.test(report.buildXcode)
          ? report.buildXcode.replace('\n', ' · ')
          : '未知（缺少有效构建回执）'
        : ['26.3', '27.1'].includes(env.BUILD_XCODE || '27.1')
        ? env.BUILD_XCODE || '27.1'
        : '配置无效'
    }`,
    probe
      ? `归档来源解析：${statuses[state('resolve')]}；启动任务：${
          statuses[state('startup')]
        }；汇总：${statuses[state('summary')]}`
      : `准备：${statuses[state('matrix')]}；构建：${
          statuses[state('build')]
        }；启动任务：${statuses[state('startup')]}；汇总：${
          statuses[state('summary')]
        }；S3 归档：${statuses[state('archive')]}`,
  ];
  if (probe)
    lines.push(
      '诊断性复测：复用已有 App，未重新构建或上传；不代表当前源码资格验证通过，也不改写原构建结果。',
    );
  if (buildOnly) {
    lines.push('仅构建：未执行启动验证，不代表任何 iOS 版本已通过。');
  } else {
    lines.push(
      targets.length === requiredMajors.length
        ? '覆盖：声明支持的完整代表版本矩阵（每个版本两次冷启动）。'
        : targets.length
        ? '覆盖：手动选择的部分版本，不是完整启动验收。'
        : '覆盖：矩阵配置无效，未取得启动证据。',
    );
    for (const target of targets) {
      const row = report?.rows.find(row => row.major === target.major);
      const status =
        row?.status === 'passed'
          ? '通过（两次冷启动）'
          : row
          ? '未通过或证据缺失'
          : '未执行／缺少有效证据';
      lines.push(
        `iOS ${target.runtime} · 测试 Xcode ${target.xcode}：${status}`,
      );
    }
    if (!report)
      lines.push('未取得与本 run/commit/矩阵匹配的汇总，不能判为启动通过。');
    else if (envelope.runAttempt !== env.GITHUB_RUN_ATTEMPT)
      lines.push(`启动证据来自本 run 第 ${envelope.runAttempt} 次尝试。`);
    if (!passed)
      lines.push(
        '未通过或缺少证据不等于 App 崩溃；请查看对应 job 的日志与启动证据。',
      );
  }
  const archiveKey = probe
    ? source?.sourceType === 's3'
      ? source.archiveKey
      : undefined
    : needs?.archive?.outputs?.archive_key;
  if (
    (probe || state('archive') === 'success') &&
    typeof archiveKey === 'string' &&
    archiveKey === archiveKey.trim() &&
    /^_private\/rabby-mobile\/ios-simulator\/[1-9]\d*-\d{14}\/archive\.json$/.test(
      archiveKey,
    )
  )
    lines.push(`私有归档 key：${archiveKey}`);
  lines.push(`详情与产物：${runUrl}`);
  return { title: `iOS Simulator · ${outcome}`, lines };
}

/** Same signed post protocol/configuration as Feature Test, without Yarn. */
export async function sendNotification(
  message,
  { env = process.env, fetchImpl = fetch, now = Date.now } = {},
) {
  const rawUrl = env.RABBY_MOBILE_LARK_CHAT_URL || env.LARK_CHAT_URL;
  const secret = env.RABBY_MOBILE_LARK_CHAT_SECRET || env.LARK_CHAT_SECRET;
  let url;
  try {
    url = new URL(rawUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['open.larksuite.com', 'open.feishu.cn'].includes(url.hostname) ||
      !/^\/open-apis\/bot\/v2\/hook\/[^/]+$/.test(url.pathname) ||
      !secret
    )
      throw new Error();
  } catch {
    throw new Error('Lark webhook configuration is missing or invalid');
  }
  const timestamp = Math.floor(now() / 1000);
  const sign = createHmac('sha256', `${timestamp}\n${secret}`).digest('base64');
  const body = JSON.stringify({
    timestamp,
    sign,
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: message.title,
          content: message.lines.map(text => [{ tag: 'text', text }]),
        },
      },
    },
  });
  if (Buffer.byteLength(body) > 20000)
    throw new Error('Lark summary exceeds the message size limit');
  let response;
  let result;
  try {
    response = await fetchImpl(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 16384) throw new Error();
      chunks.push(chunk);
    }
    result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    // The server may already have accepted a timed-out POST. Do not retry,
    // print transport exceptions, response text, the signature or webhook URL.
    throw new Error(
      'Lark delivery failed; check the notify job before retrying',
    );
  }
  const codes = [result?.code, result?.StatusCode].filter(
    value => value !== undefined,
  );
  if (!codes.length || codes.some(code => code !== 0))
    throw new Error('Lark rejected the summary');
}

async function main(args) {
  if (
    args[0] !== 'send' ||
    args.length > 2 ||
    (args[1] !== undefined && args[1] !== '--dry-run')
  )
    throw new Error('Use send [--dry-run]');
  const message = createNotification(process.env);
  if (args[1] === '--dry-run') {
    console.log(JSON.stringify(message, null, 2));
    return;
  }
  await sendNotification(message);
  console.log('Lark startup summary delivered');
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
