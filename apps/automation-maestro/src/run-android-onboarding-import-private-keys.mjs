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

function formatStepDir(index, label) {
  return `${String(index).padStart(2, '0')}-${label}`;
}

function runFlow({
  maestroBin,
  flowFile,
  outputDir,
  packageName,
  appPassword,
  privateKey,
  allPrivateKeys,
  privateKeyEnvName,
  privateKeysEnvName,
  extraMaestroEnv,
  forwardedArgs,
  scope,
}) {
  ensureOutputDir(outputDir);

  const { command, args } = buildMaestroArgs({
    maestroBin,
    flowFile,
    outputDir,
    packageName,
    appPassword,
    maestroEnv: {
      ...buildPrivateKeyEnv({
        privateKey,
        allPrivateKeys,
        privateKeyEnvName,
        privateKeysEnvName,
      }),
      ...extraMaestroEnv,
    },
    forwardedArgs,
  });

  log(scope, `Flow: ${flowFile}`);
  log(scope, `Artifacts: ${outputDir}`);
  run(command, args);
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const onboardingConfig = config.android.onboardingImportPrivateKey;
  const homeImportConfig = config.android.homeImportPrivateKey;
  const homeAddWatchAddressConfig = config.android.homeAddWatchAddress;
  const maestroBin = resolveMaestroBinary(config);

  const packageName =
    process.env.RABBY_ANDROID_E2E_PACKAGE ||
    process.env.RABBY_ANDROID_DEBUG_PACKAGE || onboardingConfig.packageName;
  const appPassword =
    process.env.RABBY_ANDROID_APP_PASSWORD ||
    process.env.RABBY_ANDROID_DEBUG_PASSWORD ||
    onboardingConfig.appPassword;
  const privateKeysEnvName = onboardingConfig.privateKeysEnvName;
  const privateKeyEnvName = onboardingConfig.privateKeyEnvName;
  const { privateKeys, sourceEnvName } = resolvePrivateKeys({
    privateKeysEnvName,
    fallbackPrivateKeyEnvName: privateKeyEnvName,
  });

  const onboardingFlowFile = resolveMaestroFile(onboardingConfig.flowFile);
  const homeImportFlowFile = resolveMaestroFile(homeImportConfig.flowFile);
  const homeAddWatchAddressFlowFile = resolveMaestroFile(
    homeAddWatchAddressConfig.flowFile,
  );

  for (const flowFile of [
    onboardingFlowFile,
    homeImportFlowFile,
    homeAddWatchAddressFlowFile,
  ]) {
    if (!fs.existsSync(flowFile)) {
      throw new Error(`[maestro-onboarding] flow file not found: ${flowFile}`);
    }
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputRootDir = path.join(
    artifactRootDir,
    'maestro',
    'android-onboarding-import-private-keys',
    runId,
  );

  ensureOutputDir(outputRootDir);

  log(
    'maestro:onboarding:multi',
    `Using ${privateKeys.length} private key(s) from ${sourceEnvName}`,
  );

  const adbBinary = resolveAdbBinary();
  ensureAndroidReady(adbBinary);

  log('maestro:onboarding:multi', 'Resetting app state via adb');
  clearPackage(adbBinary, packageName);

  const launchActivity = resolveLaunchActivity(
    adbBinary,
    packageName,
    onboardingConfig.launchActivity,
  );

  if (!launchActivity || launchActivity === 'No activity found') {
    throw new Error(
      `[maestro:onboarding] unable to resolve launch activity for ${packageName}`,
    );
  }

  log(
    'maestro:onboarding:multi',
    `Launching ${launchActivity} via adb`,
  );
  launchAndroidActivity(adbBinary, launchActivity);

  runFlow({
    maestroBin,
    flowFile: onboardingFlowFile,
    outputDir: path.join(outputRootDir, formatStepDir(1, 'onboarding')),
    packageName,
    appPassword,
    privateKey: privateKeys[0],
    allPrivateKeys: privateKeys,
    privateKeyEnvName,
    privateKeysEnvName,
    extraMaestroEnv: {
      ...config.maestro.env,
      ...onboardingConfig.maestroEnv,
    },
    forwardedArgs: process.argv.slice(2),
    scope: 'maestro:onboarding:multi',
  });

  for (const [index, privateKey] of privateKeys.slice(1).entries()) {
    const stepIndex = index + 2;
    runFlow({
      maestroBin,
      flowFile: homeImportFlowFile,
      outputDir: path.join(
        outputRootDir,
        formatStepDir(stepIndex, `home-import-key-${stepIndex}`),
      ),
      packageName,
      appPassword,
      privateKey,
      allPrivateKeys: privateKeys,
      privateKeyEnvName,
      privateKeysEnvName,
      extraMaestroEnv: {
        ...config.maestro.env,
        ...homeImportConfig.maestroEnv,
      },
      forwardedArgs: process.argv.slice(2),
      scope: `maestro:onboarding:multi:key-${stepIndex}`,
    });
  }

  runFlow({
    maestroBin,
    flowFile: homeAddWatchAddressFlowFile,
    outputDir: path.join(
      outputRootDir,
      formatStepDir(privateKeys.length + 1, 'home-add-watch-address'),
    ),
    packageName,
    appPassword,
    privateKey: privateKeys[0],
    allPrivateKeys: privateKeys,
    privateKeyEnvName,
    privateKeysEnvName,
    extraMaestroEnv: {
      ...config.maestro.env,
      ...homeAddWatchAddressConfig.maestroEnv,
    },
    forwardedArgs: process.argv.slice(2),
    scope: 'maestro:onboarding:multi:watch-address',
  });

  log(
    'maestro:onboarding:multi',
    `Completed. Reports root: ${outputRootDir}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
