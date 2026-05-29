import fs from 'node:fs';
import path from 'node:path';
import { maestroRoot } from './paths.mjs';
import { resolveMaestroFile } from './config.mjs';
import {
  capture,
  defaultMaestroBinary,
  resolveBinary,
  run,
} from './process.mjs';

export function assertNodeVersion() {
  const majorVersion = Number.parseInt(process.versions.node.split('.')[0], 10);
  if (majorVersion >= 22) {
    return;
  }

  throw new Error(
    `Node.js >= 22 is required for maestro runners. Current version: ${process.version}`,
  );
}

export function formatRunId(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');

  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      '',
    ) +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

export function resolveArtifactRootDir() {
  const explicitDir = process.env.RABBY_MAESTRO_ARTIFACTS_DIR;

  return explicitDir
    ? path.resolve(explicitDir)
    : path.join(maestroRoot, '.artifacts');
}

export function ensureOutputDir(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export function resolveMaestroBinary(config) {
  const configuredMaestroBinary = config.maestro.binary
    ? path.isAbsolute(config.maestro.binary) ||
      config.maestro.binary.startsWith('.')
      ? resolveMaestroFile(config.maestro.binary)
      : config.maestro.binary
    : null;

  return (
    configuredMaestroBinary ||
    resolveBinary({
      envVarName: 'MAESTRO_BIN',
      commandName: 'maestro',
      fallbackPath: defaultMaestroBinary(),
      errorMessage: '[maestro] maestro CLI is required but not found in PATH',
    })
  );
}

export function resolveAdbBinary() {
  return resolveBinary({
    envVarName: 'ADB_BIN',
    commandName: 'adb',
    errorMessage: '[maestro] adb is required but not found in PATH',
  });
}

function adbArgs(args) {
  const serial = process.env.ADB_SERIAL?.trim();
  if (!serial) {
    return args;
  }

  return ['-s', serial, ...args];
}

export function runAdb(adbBinary, args, options) {
  return run(adbBinary, adbArgs(args), options);
}

export function captureAdb(adbBinary, args, options) {
  return capture(adbBinary, adbArgs(args), options);
}

export function resolveLaunchActivity(
  adbBinary,
  packageName,
  configuredActivity,
) {
  if (configuredActivity) {
    return configuredActivity;
  }

  const resolved = captureAdb(adbBinary, [
    'shell',
    'cmd',
    'package',
    'resolve-activity',
    '--brief',
    packageName,
  ]);

  return resolved
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .at(-1);
}

export function ensureAndroidReady(adbBinary) {
  runAdb(adbBinary, ['wait-for-device']);
}

export function clearPackage(adbBinary, packageName) {
  runAdb(adbBinary, ['shell', 'pm', 'clear', packageName], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

export function launchActivity(adbBinary, launchActivity) {
  runAdb(adbBinary, ['shell', 'am', 'start', '-W', '-n', launchActivity], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

export function resolveMaestroAppId({ fallback, platformEnvNames = [] } = {}) {
  for (const envName of ['RABBY_MAESTRO_APP_ID', ...platformEnvNames]) {
    const value = process.env[envName]?.trim();
    if (value) {
      return value;
    }
  }

  return fallback;
}

export function resolveMaestroAppPassword({
  fallback,
  platformEnvNames = [],
} = {}) {
  for (const envName of ['RABBY_MAESTRO_APP_PASSWORD', ...platformEnvNames]) {
    const value = process.env[envName]?.trim();
    if (value) {
      return value;
    }
  }

  return fallback;
}

export function buildMaestroArgs({
  maestroBin,
  flowFile,
  outputDir,
  reportBasename = 'report',
  packageName,
  appPassword,
  maestroEnv = {},
  forwardedArgs = [],
}) {
  const args = [
    'test',
    flowFile,
    '--format',
    'HTML-DETAILED',
    '--output',
    path.join(outputDir, `${reportBasename}.html`),
    '--debug-output',
    path.join(outputDir, `${reportBasename}-debug-output`),
    '--test-output-dir',
    path.join(outputDir, `${reportBasename}-test-output`),
    '-e',
    `RABBY_MAESTRO_APP_ID=${packageName}`,
    '-e',
    `RABBY_MAESTRO_APP_PASSWORD=${appPassword}`,
    '-e',
    `RABBY_ANDROID_E2E_PACKAGE=${packageName}`,
    '-e',
    `RABBY_ANDROID_DEBUG_PACKAGE=${packageName}`,
    '-e',
    `RABBY_ANDROID_APP_PASSWORD=${appPassword}`,
  ];

  for (const [key, value] of Object.entries(maestroEnv)) {
    if (value == null) {
      continue;
    }
    args.push('-e', `${key}=${String(value)}`);
  }

  if (process.env.ADB_SERIAL?.trim()) {
    args.push('--device', process.env.ADB_SERIAL.trim());
  }

  args.push(...forwardedArgs);

  return { command: maestroBin, args };
}

export function runMaestroFlow(options) {
  const { command, args } = buildMaestroArgs(options);
  return run(command, args);
}
