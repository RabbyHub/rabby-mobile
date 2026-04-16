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
  resolveMaestroAppId,
  resolveMaestroAppPassword,
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
  const scenarioConfig = config.android.components2024ShowcaseSmoke;
  const onboardingConfig = config.android.onboardingImportPrivateKey;
  const maestroBin = resolveMaestroBinary(config);

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

  const flowFile = resolveMaestroFile(scenarioConfig.flowFile);
  if (!fs.existsSync(flowFile)) {
    throw new Error(
      `[maestro:components2024] flow file not found: ${flowFile}`,
    );
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-components2024-showcase-smoke',
    runId,
  );

  ensureOutputDir(outputDir);
  const adbBinary = resolveAdbBinary();
  ensureAndroidReady(adbBinary);

  log(
    'maestro:components2024',
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
      `[maestro:components2024] unable to resolve launch activity for ${packageName}`,
    );
  }

  log('maestro:components2024', `Launching ${launchActivity} via adb`);
  launchAndroidActivity(adbBinary, launchActivity);
  log(
    'maestro:components2024',
    'Waiting 8s for the app to settle after launch before starting Maestro',
  );
  await sleep(8000);

  log('maestro:components2024', `Flow: ${flowFile}`);
  log('maestro:components2024', `Artifacts: ${outputDir}`);
  log(
    'maestro:components2024',
    'App state is preserved. The flow will bootstrap from Welcome, Unlock, or Home, then navigate through Settings -> UI Playground -> 2024 Components.',
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
    'maestro:components2024',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
