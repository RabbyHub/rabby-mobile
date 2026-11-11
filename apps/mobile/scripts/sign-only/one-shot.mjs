#!/usr/bin/env node

/**
 * True one-shot sign-only packaging:
 *   local build -> upload to fe-opcode -> trigger GitHub sign-only workflow
 *   -> wait for cloud signing -> print the signed CDN URL.
 *
 * The Lark message is sent by the cloud workflow after signing; this script
 * never posts to Lark itself.
 *
 * `workflow_dispatch` only works once sign_only_package.yml is on the default
 * branch. Until then this script bakes the inputs into a temporary branch and
 * uses the workflow's push trigger, then deletes the branch.
 *
 * `--workflow-ref <branch>` dispatches that branch's copy of the workflow
 * instead of the ref that the fe-opcode prepare response suggests (currently
 * `develop`). Use it for the weekly `tmp/YYYYMMDD` release branch, which is
 * where the mobile-local sign-only wiring lands before it reaches `develop`.
 *
 * `--workflow-input key=value` appends or overrides workflow inputs, e.g.
 * `--workflow-input android_machine_location=mobile-local` to sign Android on
 * the macOS mobile-local runner.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKFLOW_PATH = '.github/workflows/sign_only_package.yml';
const TOKEN_FILE = path.join(
  os.homedir(),
  '.config',
  'opfe',
  'sign-only-token',
);
const DEFAULT_SERVICE_URL = 'https://rabby-fe-opcode-service.dbkops.com';
const ARTIFACT_NAMES = {
  android: 'app-signonly-unsigned.apk',
  ios: 'RabbyMobile.xcarchive.zip',
};

function fail(message) {
  throw new Error(message);
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      return `${url.protocol}//<redacted>@${url.host}`;
    }
  } catch {
    // Not a URL; leave the value untouched.
  }
  return value;
}

/**
 * Render command arguments for error messages without leaking credentials.
 * `--token` values are replaced and `--proxy` URLs lose any userinfo. Prefer
 * passing secrets to child processes through the environment instead.
 */
export function redactArgs(args) {
  const redacted = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--token' && i + 1 < args.length) {
      redacted.push(arg, '<redacted>');
      i += 1;
      continue;
    }
    if (arg === '--proxy' && i + 1 < args.length) {
      redacted.push(arg, redactUrl(args[i + 1]));
      i += 1;
      continue;
    }
    redacted.push(arg);
  }
  return redacted;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
  });
  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(
      `${command} ${redactArgs(args).join(' ')} exited with ${result.status}`,
    );
  }
  return result;
}

function capture(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
  }).trim();
}

function parseArgs(argv) {
  const args = {
    platform: '',
    notifyLark: true,
    wait: true,
    force: false,
    trigger: 'auto',
    token: '',
    serviceUrl: '',
    json: false,
    proxy: '',
    workflowRef: '',
    workflowInputs: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--platform':
        args.platform = argv[++i] || '';
        break;
      case '--notify-lark':
        args.notifyLark = true;
        break;
      case '--no-notify-lark':
        args.notifyLark = false;
        break;
      case '--wait':
        args.wait = true;
        break;
      case '--no-wait':
        args.wait = false;
        break;
      case '--force':
        args.force = true;
        break;
      case '--trigger':
        args.trigger = argv[++i] || '';
        break;
      case '--token':
        args.token = argv[++i] || '';
        break;
      case '--service-url':
        args.serviceUrl = argv[++i] || '';
        break;
      case '--json':
        args.json = true;
        break;
      case '--proxy':
        args.proxy = argv[++i] || '';
        break;
      case '--workflow-ref':
        args.workflowRef = argv[++i] || '';
        break;
      case '--workflow-input':
        args.workflowInputs.push(argv[++i] || '');
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!['android', 'ios', 'all'].includes(args.platform)) {
    fail('--platform must be android, ios or all');
  }
  if (!['auto', 'dispatch', 'push'].includes(args.trigger)) {
    fail('--trigger must be auto, dispatch or push');
  }
  args.serviceUrl =
    args.serviceUrl ||
    process.env.OPFE_SIGN_ONLY_SERVICE_URL ||
    DEFAULT_SERVICE_URL;
  args.proxy = args.proxy || process.env.OPFE_SIGN_ONLY_PROXY || '';
  assertWorkflowRef(args.workflowRef);
  for (const pair of args.workflowInputs) {
    if (!/^[A-Za-z0-9_-]+=/.test(pair)) {
      fail(`--workflow-input must be key=value: ${pair}`);
    }
  }
  return args;
}

function assertWorkflowRef(ref) {
  if (!ref) return;
  const invalid =
    ref.startsWith('-') ||
    ref.includes('..') ||
    ref.endsWith('/') ||
    ref.endsWith('.lock') ||
    !/^[A-Za-z0-9._/-]+$/.test(ref);
  if (invalid) fail(`--workflow-ref is not a valid branch name: ${ref}`);
}

function resolveToken(args) {
  if (args.token) return args.token;
  if (process.env.OPFE_SIGN_ONLY_TOKEN) {
    return process.env.OPFE_SIGN_ONLY_TOKEN.trim();
  }
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function repoSlug() {
  try {
    return capture('gh', [
      'repo',
      'view',
      '--json',
      'nameWithOwner',
      '-q',
      '.nameWithOwner',
    ]);
  } catch {
    const remote = capture('git', ['remote', 'get-url', 'origin']);
    const match = remote.replace(/\.git$/, '').match(/[:/]([^/:]+)\/([^/:]+)$/);
    if (!match) fail(`cannot parse GitHub repo from origin: ${remote}`);
    return `${match[1]}/${match[2]}`;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function build(platform, appDir) {
  console.log(`[one-shot] building unsigned ${platform} package...`);
  run(
    'bash',
    [
      path.join(
        appDir,
        'scripts',
        'sign-only',
        `build-unsigned-${platform}.sh`,
      ),
    ],
    {
      cwd: appDir,
    },
  );
  const artifact = path.join(appDir, '.sign-only', ARTIFACT_NAMES[platform]);
  if (!fs.existsSync(artifact)) {
    fail(`build finished but artifact is missing: ${artifact}`);
  }
  return artifact;
}

function publish(platform, artifact, args, rootDir, appDir) {
  const publishArgs = [
    path.join(appDir, 'scripts', 'sign-only', 'publish.mjs'),
    '--platform',
    platform,
    '--file',
    artifact,
    '--prepare',
    '--json',
  ];
  if (args.notifyLark) publishArgs.push('--notify-lark');
  if (args.force) publishArgs.push('--force');

  // Hand credentials to the child through the environment so a failed upload
  // can never echo them back through the command line in an error message.
  const publishEnv = { ...process.env };
  if (args.token) publishEnv.OPFE_SIGN_ONLY_TOKEN = args.token;
  if (args.serviceUrl) {
    publishEnv.OPFE_SIGN_ONLY_SERVICE_URL = args.serviceUrl;
  }
  if (args.proxy) publishEnv.OPFE_SIGN_ONLY_PROXY = args.proxy;

  const result = run(process.execPath, publishArgs, {
    cwd: rootDir,
    capture: true,
    env: publishEnv,
  });
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  const payload = JSON.parse(lines[lines.length - 1]);
  if (!payload.workflow?.inputs?.sign_request_id) {
    fail('publish did not return workflow inputs');
  }
  return payload;
}

function hasDispatchableWorkflow(rootDir) {
  try {
    execFileSync('git', ['fetch', '-q', 'origin', 'develop'], {
      cwd: rootDir,
      stdio: 'ignore',
    });
    execFileSync('git', ['cat-file', '-e', `origin/develop:${WORKFLOW_PATH}`], {
      cwd: rootDir,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function resolveDispatchRef(workflowRef, payloadRef) {
  return workflowRef || payloadRef || 'develop';
}

export function mergeWorkflowInputs(inputs, extraInputs) {
  const merged = { ...inputs };
  for (const pair of extraInputs) {
    const separator = pair.indexOf('=');
    merged[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return merged;
}

function dispatchWorkflow(repo, payload, workflowRef = '', extraInputs = []) {
  const workflow = payload.workflow;
  const ref = resolveDispatchRef(workflowRef, workflow.ref);
  const args = [
    'workflow',
    'run',
    'sign_only_package.yml',
    '--repo',
    repo,
    '--ref',
    ref,
  ];
  const inputs = mergeWorkflowInputs(workflow.inputs, extraInputs);
  for (const [key, value] of Object.entries(inputs)) {
    args.push('-f', `${key}=${value}`);
  }
  run('gh', args);
  return { branch: ref, event: 'workflow_dispatch' };
}

function bakeWorkflow(payload, branch, rootDir) {
  const workflow = payload.workflow;
  const sourceSha =
    payload.sourceSha ||
    capture('git', ['rev-parse', 'HEAD'], { cwd: rootDir });
  const currentBranch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: rootDir,
  });

  let text = capture('git', ['show', `HEAD:${WORKFLOW_PATH}`], {
    cwd: rootDir,
  });
  const pushBlock = `on:\n  push:\n    branches:\n      - ${branch}\n  workflow_dispatch:`;
  if (!text.includes('on:\n  workflow_dispatch:')) {
    fail(`cannot find workflow_dispatch trigger in ${WORKFLOW_PATH}`);
  }
  text = text.replace('on:\n  workflow_dispatch:', pushBlock);

  const inputs = workflow.inputs;
  for (const [key, value] of Object.entries(inputs)) {
    text = text.replaceAll(
      `\${{ inputs.${key} }}`,
      `\${{ inputs.${key} || '${value}' }}`,
    );
  }
  text = text.replaceAll(
    "${{ inputs.notify_lark == 'true'",
    `\${{ (inputs.notify_lark || '${inputs.notify_lark}') == 'true'`,
  );
  text = text.replaceAll(
    "${{ inputs.platform == 'android' }}",
    `\${{ (inputs.platform || '${payload.platform}') == 'android' }}`,
  );
  text = text.replaceAll(
    "${{ inputs.platform == 'ios' }}",
    `\${{ (inputs.platform || '${payload.platform}') == 'ios' }}`,
  );
  text = text.replaceAll(
    '${{ inputs.source_sha || github.sha }}',
    `\${{ inputs.source_sha || '${sourceSha}' }}`,
  );
  text = text.replaceAll('${{ github.sha }}', sourceSha);
  text = text.replaceAll('${{ github.ref_name }}', currentBranch);
  text = text.replaceAll('${{ github.ref }}', `refs/heads/${currentBranch}`);
  text = text.replace(
    /^run-name:.*$/m,
    `run-name: Sign-only ${payload.platform} ${payload.requestId}`,
  );

  for (const key of Object.keys(inputs)) {
    if (text.includes(`\${{ inputs.${key} }}`)) {
      fail(`failed to bake workflow input: ${key}`);
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sign-only-oneshot-'));
  const bakedPath = path.join(tmpDir, 'workflow.yml');
  fs.writeFileSync(bakedPath, text);
  const indexFile = path.join(tmpDir, 'index');
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  try {
    const blob = capture('git', ['hash-object', '-w', bakedPath], {
      cwd: rootDir,
    });
    execFileSync('git', ['read-tree', 'HEAD'], { cwd: rootDir, env });
    execFileSync(
      'git',
      [
        'update-index',
        '--add',
        '--cacheinfo',
        `100644,${blob},${WORKFLOW_PATH}`,
      ],
      { cwd: rootDir, env },
    );
    const tree = capture('git', ['write-tree'], { cwd: rootDir, env });
    const commit = capture(
      'git',
      [
        'commit-tree',
        tree,
        '-p',
        'HEAD',
        '-m',
        `ci: sign-only ${payload.platform} ${payload.requestId}`,
      ],
      { cwd: rootDir },
    );
    execFileSync('git', ['push', 'origin', `${commit}:refs/heads/${branch}`], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  return { branch, event: 'push' };
}

async function waitForRun({
  repo,
  payload,
  branch,
  rootDir,
  timeoutMs = 180000,
}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const listed = JSON.parse(
      capture(
        'gh',
        [
          'run',
          'list',
          '--repo',
          repo,
          '--workflow',
          'sign_only_package.yml',
          '--branch',
          branch,
          '--limit',
          '20',
          '--json',
          'databaseId,displayTitle,status,conclusion,url',
        ],
        { cwd: rootDir },
      ),
    );
    const match = listed.find(run =>
      (run.displayTitle || '').includes(payload.requestId),
    );
    if (match) return match;
    await sleep(5000);
  }
  fail('workflow run was not found in time');
}

function deleteRemoteBranch(branch, rootDir) {
  const result = spawnSync('git', ['push', 'origin', '--delete', branch], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  if (result.status !== 0) {
    console.warn(`[one-shot] warning: could not delete ${branch}`);
  }
}

async function waitForPackage({
  serviceUrl,
  token,
  requestId,
  timeoutMs = 900000,
}) {
  if (!token) return null;
  const baseUrl = serviceUrl.replace(/\/+$/, '');
  const startedAt = Date.now();
  let lastStatus = 'unknown';
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${baseUrl}/v1/api/sign-only-packages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const body = await response.json();
      const pkg = (body?.data?.packages || []).find(
        item => item.requestId === requestId,
      );
      if (pkg) {
        lastStatus = pkg.status;
        if (pkg.status === 'signed') return pkg;
        if (pkg.status === 'failed') {
          fail(pkg.errorMessage || 'cloud signing failed');
        }
      }
    }
    await sleep(5000);
  }
  fail(`timed out waiting for cloud signing (last status: ${lastStatus})`);
}

async function runPlatform(platform, args, rootDir, appDir, repo) {
  const artifact = build(platform, appDir);
  const payload = publish(platform, artifact, args, rootDir, appDir);
  console.log(
    `[one-shot] ${platform}: uploaded request ${payload.requestId}; lark=${
      args.notifyLark ? 'on' : 'off'
    } (sent by the cloud workflow)`,
  );

  let trigger;
  if (args.trigger === 'dispatch') {
    trigger = dispatchWorkflow(
      repo,
      payload,
      args.workflowRef,
      args.workflowInputs,
    );
  } else if (args.trigger === 'push') {
    const branch = `test/sign-only-${platform}-${Date.now().toString(36)}`;
    trigger = bakeWorkflow(payload, branch, rootDir);
  } else if (args.workflowRef) {
    // An explicit ref always means `workflow_dispatch`: that branch carries
    // its own workflow copy, so there is nothing to bake into a push branch.
    trigger = dispatchWorkflow(
      repo,
      payload,
      args.workflowRef,
      args.workflowInputs,
    );
  } else if (hasDispatchableWorkflow(rootDir)) {
    trigger = dispatchWorkflow(repo, payload, '', args.workflowInputs);
  } else {
    const branch = `test/sign-only-${platform}-${Date.now().toString(36)}`;
    trigger = bakeWorkflow(payload, branch, rootDir);
  }
  console.log(
    `[one-shot] ${platform}: triggering ${trigger.event} on ${trigger.branch}`,
  );

  const workflowRun = await waitForRun({
    repo,
    payload,
    branch: trigger.branch,
    rootDir,
  });
  if (trigger.event === 'push') {
    deleteRemoteBranch(trigger.branch, rootDir);
  }
  console.log(`[one-shot] ${platform}: workflow ${workflowRun.url}`);

  if (!args.wait) {
    return { platform, requestId: payload.requestId, workflowRun };
  }

  const watch = spawnSync(
    'gh',
    [
      'run',
      'watch',
      String(workflowRun.databaseId),
      '--repo',
      repo,
      '--exit-status',
      '--interval',
      '20',
    ],
    { cwd: rootDir, stdio: 'inherit' },
  );
  if (watch.status !== 0) {
    fail(`${platform}: cloud signing workflow failed: ${workflowRun.url}`);
  }

  const token = resolveToken(args);
  const pkg = await waitForPackage({
    serviceUrl: args.serviceUrl,
    token,
    requestId: payload.requestId,
  });
  console.log(
    `[one-shot] ${platform}: signed artifact ${pkg.signedArtifactUrl}`,
  );
  if (args.notifyLark) {
    console.log(
      '[one-shot] Lark notification was sent by the cloud workflow after signing.',
    );
  }
  return {
    platform,
    requestId: payload.requestId,
    signedArtifactUrl: pkg.signedArtifactUrl,
    workflowRunUrl: workflowRun.url,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = capture('git', ['rev-parse', '--show-toplevel']);
  const appDir = path.join(rootDir, 'apps', 'mobile');
  const platforms =
    args.platform === 'all' ? ['android', 'ios'] : [args.platform];

  const ghCheck = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  if (ghCheck.status !== 0) {
    fail('gh is not authenticated; run `gh auth login` first');
  }
  const repo = repoSlug();
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${WORKFLOW_PATH}`], {
      cwd: rootDir,
      stdio: 'ignore',
    });
  } catch {
    fail(
      `this branch does not contain ${WORKFLOW_PATH}; run from the sign-only branch`,
    );
  }

  const results = [];
  const failures = [];
  for (const platform of platforms) {
    try {
      results.push(await runPlatform(platform, args, rootDir, appDir, repo));
    } catch (error) {
      failures.push({ platform, error: error.message });
      console.error(`[one-shot] ${platform}: ${error.message}`);
      if (args.platform !== 'all') throw error;
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ results, failures }, null, 2));
  }
  if (failures.length) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch(error => {
    console.error(`[one-shot] ${error.message}`);
    process.exit(1);
  });
}
