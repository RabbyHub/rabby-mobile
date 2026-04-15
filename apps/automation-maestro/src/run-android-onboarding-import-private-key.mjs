#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './shared/env.mjs';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
import {
  assertNodeVersion,
  buildMaestroArgs,
  clearPackage,
  ensureAndroidReady,
  ensureOutputDir,
  formatRunId,
  launchActivity as launchAndroidActivity,
  resolveAdbBinary,
  resolveArtifactRootDir,
  resolveLaunchActivity,
  resolveMaestroBinary,
} from './shared/android.mjs';
import { log, run } from './shared/process.mjs';
import {
  buildPrivateKeyEnv,
  resolvePrivateKeys,
} from './shared/private-keys.mjs';

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const scenarioConfig = config.android.onboardingImportPrivateKey;
  const maestroBin = resolveMaestroBinary(config);

  const packageName =
    process.env.RABBY_ANDROID_E2E_PACKAGE ||
    process.env.RABBY_ANDROID_DEBUG_PACKAGE || scenarioConfig.packageName;
  const appPassword =
    process.env.RABBY_ANDROID_APP_PASSWORD ||
    process.env.RABBY_ANDROID_DEBUG_PASSWORD ||
    scenarioConfig.appPassword;
  const privateKeysEnvName = scenarioConfig.privateKeysEnvName;
  const privateKeyEnvName = scenarioConfig.privateKeyEnvName;
  const { privateKeys, sourceEnvName } = resolvePrivateKeys({
    privateKeysEnvName,
    fallbackPrivateKeyEnvName: privateKeyEnvName,
  });
  const privateKey = privateKeys[0];

  const flowFile = resolveMaestroFile(scenarioConfig.flowFile);
  if (!fs.existsSync(flowFile)) {
    throw new Error(`[maestro-onboarding] flow file not found: ${flowFile}`);
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-onboarding-import-private-key',
    runId,
  );

  ensureOutputDir(outputDir);

  log('maestro:onboarding', `Flow: ${flowFile}`);
  log('maestro:onboarding', `Artifacts: ${outputDir}`);
  log(
    'maestro:onboarding',
    `Using private key #1 from ${sourceEnvName}`,
  );

  const adbBinary = resolveAdbBinary();

  ensureAndroidReady(adbBinary);

  log('maestro:onboarding', 'Resetting app state via adb');
  clearPackage(adbBinary, packageName);

  const launchActivity = resolveLaunchActivity(
    adbBinary,
    packageName,
    scenarioConfig.launchActivity,
  );

  if (!launchActivity || launchActivity === 'No activity found') {
    throw new Error(
      `[maestro:onboarding] unable to resolve launch activity for ${packageName}`,
    );
  }

  log('maestro:onboarding', `Launching ${launchActivity} via adb`);
  launchAndroidActivity(adbBinary, launchActivity);

  const { command, args } = buildMaestroArgs({
    maestroBin,
    flowFile,
    outputDir,
    packageName,
    appPassword,
    maestroEnv: {
      ...buildPrivateKeyEnv({
        privateKey,
        allPrivateKeys: privateKeys,
        privateKeyEnvName,
        privateKeysEnvName,
      }),
      ...config.maestro.env,
      ...scenarioConfig.maestroEnv,
    },
    forwardedArgs: process.argv.slice(2),
  });

  run(command, args);
  log(
    'maestro:onboarding',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
