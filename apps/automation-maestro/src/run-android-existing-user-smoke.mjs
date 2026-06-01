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

async function main() {
  assertNodeVersion();
  loadLocalEnv();

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

  const flowFile = resolveMaestroFile(
    'flows/android-home-ready-existing-user.yaml',
  );
  if (!fs.existsSync(flowFile)) {
    throw new Error(`[maestro:existing-user] flow file not found: ${flowFile}`);
  }

  ensureAndroidReady(adbBinary);
  const launchActivity = resolveLaunchActivity(
    adbBinary,
    packageName,
    onboardingConfig.launchActivity,
  );

  if (!launchActivity || launchActivity === 'No activity found') {
    throw new Error(
      `[maestro:existing-user] unable to resolve launch activity for ${packageName}`,
    );
  }

  const outputDir = path.join(
    resolveArtifactRootDir(),
    'maestro',
    'android-existing-user-smoke',
    formatRunId(),
  );
  ensureOutputDir(outputDir);

  log(
    'maestro:existing-user',
    `Force-stopping ${packageName} while preserving app data`,
  );
  runAdb(adbBinary, ['shell', 'am', 'force-stop', packageName], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  log('maestro:existing-user', `Launching ${launchActivity}`);
  launchAndroidActivity(adbBinary, launchActivity);
  log('maestro:existing-user', 'Waiting 5s before starting Maestro');
  await sleep(5000);

  log('maestro:existing-user', `Flow: ${flowFile}`);
  log('maestro:existing-user', `Artifacts: ${outputDir}`);
  log(
    'maestro:existing-user',
    'App data is preserved. This smoke expects an existing wallet state and fails on onboarding.',
  );

  runMaestroFlow({
    maestroBin,
    flowFile,
    outputDir,
    reportBasename: 'report',
    packageName,
    appPassword,
    maestroEnv: config.maestro.env,
    forwardedArgs: process.argv.slice(2),
  });

  log(
    'maestro:existing-user',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
