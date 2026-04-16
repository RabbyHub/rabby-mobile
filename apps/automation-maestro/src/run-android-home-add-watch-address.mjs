#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './shared/env.mjs';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
import {
  assertNodeVersion,
  buildMaestroArgs,
  ensureAndroidReady,
  ensureOutputDir,
  formatRunId,
  launchActivity as launchAndroidActivity,
  resolveAdbBinary,
  resolveArtifactRootDir,
  resolveLaunchActivity,
  resolveMaestroBinary,
  runAdb,
} from './shared/android.mjs';
import { log, run } from './shared/process.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const scenarioConfig = config.android.homeAddWatchAddress;
  const onboardingConfig = config.android.onboardingImportPrivateKey;
  const maestroBin = resolveMaestroBinary(config);

  const packageName =
    process.env.RABBY_ANDROID_E2E_PACKAGE ||
    process.env.RABBY_ANDROID_DEBUG_PACKAGE ||
    onboardingConfig.packageName;
  const appPassword =
    process.env.RABBY_ANDROID_APP_PASSWORD ||
    process.env.RABBY_ANDROID_DEBUG_PASSWORD ||
    onboardingConfig.appPassword;

  const flowFile = resolveMaestroFile(scenarioConfig.flowFile);
  if (!fs.existsSync(flowFile)) {
    throw new Error(`[maestro:watch-address] flow file not found: ${flowFile}`);
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-home-add-watch-address',
    runId,
  );

  ensureOutputDir(outputDir);
  const adbBinary = resolveAdbBinary();
  ensureAndroidReady(adbBinary);

  log(
    'maestro:watch-address',
    `Force-stopping ${packageName} via adb while preserving app data`,
  );
  runAdb(adbBinary, ['shell', 'am', 'force-stop', packageName], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  const launchActivity = resolveLaunchActivity(
    adbBinary,
    packageName,
    onboardingConfig.launchActivity,
  );

  if (!launchActivity || launchActivity === 'No activity found') {
    throw new Error(
      `[maestro:watch-address] unable to resolve launch activity for ${packageName}`,
    );
  }

  log('maestro:watch-address', `Launching ${launchActivity} via adb`);
  launchAndroidActivity(adbBinary, launchActivity);
  log(
    'maestro:watch-address',
    'Waiting 8s for the app to settle after launch before starting Maestro',
  );
  await sleep(8000);

  log('maestro:watch-address', `Flow: ${flowFile}`);
  log('maestro:watch-address', `Artifacts: ${outputDir}`);
  log(
    'maestro:watch-address',
    'App state is preserved. The flow will bootstrap from onboarding on Welcome, unlock on Lock screen, or continue directly on Home.',
  );

  const { command, args } = buildMaestroArgs({
    maestroBin,
    flowFile,
    outputDir,
    packageName,
    appPassword,
    maestroEnv: {
      ...config.maestro.env,
      ...scenarioConfig.maestroEnv,
    },
    forwardedArgs: process.argv.slice(2),
  });

  run(command, args);
  log(
    'maestro:watch-address',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
