#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
import { loadLocalEnv } from './shared/env.mjs';
import {
  assertNodeVersion,
  ensureAndroidReady,
  ensureOutputDir,
  formatRunId,
  launchActivity as launchAndroidActivity,
  resolveAdbBinary,
  resolveArtifactRootDir,
  resolveLaunchActivity,
  resolveMaestroAppId,
  resolveMaestroAppPassword,
  resolveMaestroBinary,
  runAdb,
  runMaestroFlow,
} from './shared/android.mjs';
import { log } from './shared/process.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parseArgs(argv) {
  const passthroughIndex = argv.indexOf('--');
  const ownArgs =
    passthroughIndex === -1 ? argv : argv.slice(0, passthroughIndex);
  const forwardedArgs =
    passthroughIndex === -1 ? [] : argv.slice(passthroughIndex + 1);

  const result = {
    flow: null,
    packageName: null,
    skipLaunch: false,
    waitMs: 5000,
    forwardedArgs,
  };

  for (let index = 0; index < ownArgs.length; index += 1) {
    const arg = ownArgs[index];

    if (arg === '--flow') {
      result.flow = ownArgs[index + 1]?.trim();
      index += 1;
      continue;
    }

    if (arg === '--package') {
      result.packageName = ownArgs[index + 1]?.trim();
      index += 1;
      continue;
    }

    if (arg === '--wait-ms') {
      result.waitMs = Number(ownArgs[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--no-launch') {
      result.skipLaunch = true;
      continue;
    }

    result.forwardedArgs.push(arg);
  }

  if (!result.flow) {
    throw new Error('[maestro:android-device-flow] --flow <file> is required');
  }

  if (!Number.isFinite(result.waitMs) || result.waitMs < 0) {
    throw new Error('[maestro:android-device-flow] --wait-ms must be >= 0');
  }

  return result;
}

function flowArtifactName(flowFile) {
  return path.basename(flowFile).replace(/\.ya?ml$/i, '');
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const args = parseArgs(process.argv.slice(2));
  if (args.packageName) {
    process.env.RABBY_MAESTRO_APP_ID = args.packageName;
  }

  const config = await loadMaestroConfig();
  const onboardingConfig = config.android.onboardingImportPrivateKey;
  const maestroBin = resolveMaestroBinary(config);
  const adbBinary = resolveAdbBinary();

  const packageName = resolveMaestroAppId({
    fallback: onboardingConfig.packageName,
    platformEnvNames: [
      'RABBY_ANDROID_E2E_PACKAGE',
      'RABBY_ANDROID_DEBUG_PACKAGE',
    ],
  });
  const appPassword = resolveMaestroAppPassword({
    fallback: onboardingConfig.appPassword,
    platformEnvNames: [
      'RABBY_ANDROID_APP_PASSWORD',
      'RABBY_ANDROID_DEBUG_PASSWORD',
    ],
  });

  const flowFile = resolveMaestroFile(args.flow);
  if (!fs.existsSync(flowFile)) {
    throw new Error(
      `[maestro:android-device-flow] flow file not found: ${flowFile}`,
    );
  }

  ensureAndroidReady(adbBinary);

  const launchActivity = resolveLaunchActivity(
    adbBinary,
    packageName,
    onboardingConfig.launchActivity,
  );
  if (
    !args.skipLaunch &&
    (!launchActivity || launchActivity === 'No activity found')
  ) {
    throw new Error(
      `[maestro:android-device-flow] unable to resolve launch activity for ${packageName}`,
    );
  }

  const outputDir = path.join(
    resolveArtifactRootDir(),
    'maestro',
    'android-device-flow',
    flowArtifactName(flowFile),
    formatRunId(),
  );
  ensureOutputDir(outputDir);

  if (!args.skipLaunch) {
    log(
      'maestro:android-device-flow',
      `Force-stopping ${packageName} while preserving app data`,
    );
    runAdb(adbBinary, ['shell', 'am', 'force-stop', packageName], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    log('maestro:android-device-flow', `Launching ${launchActivity}`);
    launchAndroidActivity(adbBinary, launchActivity);
    log(
      'maestro:android-device-flow',
      `Waiting ${args.waitMs}ms before starting Maestro`,
    );
    await sleep(args.waitMs);
  } else {
    log(
      'maestro:android-device-flow',
      'Skipping launch. Current device app state will be used as-is.',
    );
  }

  log('maestro:android-device-flow', `Flow: ${flowFile}`);
  log('maestro:android-device-flow', `Artifacts: ${outputDir}`);
  log(
    'maestro:android-device-flow',
    'App data is preserved. Use onboarding flows only when the current app state matches them.',
  );

  runMaestroFlow({
    maestroBin,
    flowFile,
    outputDir,
    reportBasename: 'report',
    packageName,
    appPassword,
    maestroEnv: config.maestro.env,
    forwardedArgs: args.forwardedArgs,
  });

  log(
    'maestro:android-device-flow',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
