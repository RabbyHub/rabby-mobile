#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
import { loadLocalEnv } from './shared/env.mjs';
import {
  assertNodeVersion,
  captureAdb,
  ensureAndroidReady,
  resolveAdbBinary,
  resolveLaunchActivity,
  resolveMaestroAppId,
  resolveMaestroBinary,
  runAdb,
} from './shared/android.mjs';
import { maestroRoot } from './shared/paths.mjs';
import { capture, log, run } from './shared/process.mjs';

function readFlagValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1]?.trim();
  if (!value || value.startsWith('--')) {
    throw new Error(`[maestro:doctor] ${name} requires a value`);
  }

  return value;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function resolveAndroidFlowFiles(explicitFlowFile) {
  if (explicitFlowFile) {
    return [resolveMaestroFile(explicitFlowFile)];
  }

  const flowsDir = path.join(maestroRoot, 'flows');
  return fs
    .readdirSync(flowsDir)
    .filter(fileName => fileName.startsWith('android-'))
    .filter(fileName => fileName.endsWith('.yaml'))
    .sort()
    .map(fileName => path.join(flowsDir, fileName));
}

function assertInstalledPackage(adbBinary, packageName) {
  const packagePath = captureAdb(adbBinary, [
    'shell',
    'pm',
    'path',
    packageName,
  ]);

  if (!packagePath) {
    throw new Error(
      `[maestro:doctor] package is not installed: ${packageName}`,
    );
  }

  return packagePath.split('\n')[0];
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const explicitPackageName = readFlagValue('--package');
  if (explicitPackageName) {
    process.env.RABBY_MAESTRO_APP_ID = explicitPackageName;
  }

  const shouldLaunch = hasFlag('--launch');
  const shouldSkipSyntax = hasFlag('--skip-syntax');
  const explicitFlowFile = readFlagValue('--flow');

  const config = await loadMaestroConfig();
  const packageName = resolveMaestroAppId({
    fallback: config.android.onboardingImportPrivateKey.packageName,
    platformEnvNames: [
      'RABBY_ANDROID_E2E_PACKAGE',
      'RABBY_ANDROID_DEBUG_PACKAGE',
    ],
  });

  const adbBinary = resolveAdbBinary();
  const maestroBin = resolveMaestroBinary(config);

  log('maestro:doctor', `adb: ${adbBinary}`);
  log('maestro:doctor', `maestro: ${maestroBin}`);
  log('maestro:doctor', `package: ${packageName}`);

  ensureAndroidReady(adbBinary);
  log('maestro:doctor', captureAdb(adbBinary, ['devices', '-l']));

  const packagePath = assertInstalledPackage(adbBinary, packageName);
  log('maestro:doctor', `installed package path: ${packagePath}`);

  const launchActivity = resolveLaunchActivity(adbBinary, packageName);
  if (!launchActivity || launchActivity === 'No activity found') {
    throw new Error(
      `[maestro:doctor] unable to resolve launch activity for ${packageName}`,
    );
  }
  log('maestro:doctor', `launch activity: ${launchActivity}`);

  const maestroVersion = capture(maestroBin, ['--version']);
  log('maestro:doctor', `maestro version: ${maestroVersion}`);

  if (!shouldSkipSyntax) {
    const flowFiles = resolveAndroidFlowFiles(explicitFlowFile);
    log('maestro:doctor', `checking ${flowFiles.length} android flow(s)`);
    for (const flowFile of flowFiles) {
      if (!fs.existsSync(flowFile)) {
        throw new Error(`[maestro:doctor] flow file not found: ${flowFile}`);
      }
      run(maestroBin, ['check-syntax', flowFile]);
    }
  }

  if (shouldLaunch) {
    log(
      'maestro:doctor',
      `Force-stopping ${packageName} while preserving data`,
    );
    runAdb(adbBinary, ['shell', 'am', 'force-stop', packageName], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    log('maestro:doctor', `Launching ${launchActivity}`);
    runAdb(adbBinary, ['shell', 'am', 'start', '-W', '-n', launchActivity], {
      stdio: 'inherit',
    });
  }

  log('maestro:doctor', 'Android device doctor passed');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
