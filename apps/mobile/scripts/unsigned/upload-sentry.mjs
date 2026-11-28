#!/usr/bin/env node
/**
 * Upload Sentry symbols for a verified unsigned artifact.
 *
 * This is a *publishing* step: the unsigned build itself never uploads, so a
 * cross-machine hash check can run without Sentry credentials. Publish with the
 * same credentials the old pipeline used (`SENTRY_AUTH_TOKEN`, plus org/project
 * from `android/sentry.properties` or the flags below) before releasing the
 * signed artifact.
 *
 *   node scripts/unsigned/upload-sentry.mjs \
 *     --platform android \
 *     --bundle  dist/unsigned/production/unzipped/base/assets/index.android.bundle \
 *     --sourcemap dist/unsigned/production/sourcemaps/index.android.bundle.map \
 *     --release com.debank.rabbymobile@0.7.2+100276 --dist 100276
 *
 *   node scripts/unsigned/upload-sentry.mjs --platform ios --archive build/…/RabbyMobile.xcarchive
 *
 * Requires `sentry-cli` (node_modules/.bin or PATH) and SENTRY_AUTH_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key.slice(2)] = true;
    } else {
      out[key.slice(2)] = next;
      i += 1;
    }
  }
  return out;
}

/** Reads org/project from the standard sentry.properties file (INI-ish). */
function readSentryProperties(file) {
  const props = {};
  if (!fs.existsSync(file)) return props;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    props[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return props;
}

function resolveSentryCli() {
  const candidates = [
    path.resolve('node_modules/.bin/sentry-cli'),
    path.resolve('node_modules/@sentry/cli/bin/sentry-cli'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'sentry-cli';
}

function run(args, { dryRun = false } = {}) {
  console.log(`[sentry] ${args.join(' ')}`);
  if (dryRun) return;
  execFileSync(args[0], args.slice(1), { stdio: 'inherit' });
}

const args = parseArgs(process.argv.slice(2));
const platform = args.platform || 'android';
const dryRun = args['dry-run'] === true;

const props = readSentryProperties(path.resolve('android/sentry.properties'));
const org = args.org || props['defaults.org'] || process.env.SENTRY_ORG;
const project =
  args.project || props['defaults.project'] || process.env.SENTRY_PROJECT;
const authToken =
  process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_AUTH_TOKEN_OVERRIDE;
const cli = resolveSentryCli();

if (!authToken && !dryRun) {
  console.error('[sentry] SENTRY_AUTH_TOKEN is not set');
  process.exit(2);
}
if ((!org || !project) && !dryRun) {
  console.error(
    '[sentry] org/project missing (android/sentry.properties or --org/--project)',
  );
  process.exit(2);
}

if (platform === 'android') {
  const bundle = args.bundle;
  const sourcemap = args.sourcemap;
  if (
    !bundle ||
    !sourcemap ||
    !fs.existsSync(bundle) ||
    !fs.existsSync(sourcemap)
  ) {
    console.error('[sentry] --bundle and --sourcemap are required for android');
    process.exit(2);
  }
  if (!args.release) {
    console.error(
      '[sentry] --release is required (com.debank.rabbymobile@<versionName>+<versionCode>)',
    );
    process.exit(2);
  }
  const flags = [
    'react-native',
    'gradle',
    '--bundle',
    bundle,
    '--sourcemap',
    sourcemap,
    '--org',
    org,
    '--project',
    project,
    '--release',
    args.release,
  ];
  if (args.dist) flags.push('--dist', args.dist);
  run([cli, ...flags], { dryRun });
} else if (platform === 'ios') {
  const archive = args.archive;
  if (!archive || !fs.existsSync(archive)) {
    console.error('[sentry] --archive is required for ios');
    process.exit(2);
  }
  run(
    [cli, 'debug-files', 'upload', '--org', org, '--project', project, archive],
    { dryRun },
  );
  if (args.bundle && args.sourcemap) {
    run(
      [
        cli,
        'sourcemaps',
        'upload',
        '--org',
        org,
        '--project',
        project,
        path.dirname(args.sourcemap),
      ],
      { dryRun },
    );
  } else {
    console.log('[sentry] no --bundle/--sourcemap given; uploaded dSYMs only');
  }
} else {
  console.error(`[sentry] unsupported platform: ${platform}`);
  process.exit(2);
}

console.log('[sentry] done');
