#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './shared/env.mjs';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
import {
  assertNodeVersion,
  buildMaestroArgs,
  ensureOutputDir,
  formatRunId,
  resolveArtifactRootDir,
  resolveMaestroAppId,
  resolveMaestroAppPassword,
  resolveMaestroBinary,
} from './shared/android.mjs';
import { log, run } from './shared/process.mjs';
import {
  buildPrivateKeyEnv,
  resolvePrivateKeys,
} from './shared/private-keys.mjs';
import {
  clearIOSAppData,
  launchIOSApp,
  resetIOSKeychain,
  resolveBootedIOSSimulator,
  resolveIOSSimulatorUDID,
  resolveXcrunBinary,
  terminateIOSApp,
  writeIOSPasteboard,
} from './shared/ios.mjs';

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const scenarioConfig = config.ios.onboardingImportPrivateKey;
  const maestroBin = resolveMaestroBinary(config);
  const xcrunBinary = resolveXcrunBinary();

  const bundleId = resolveMaestroAppId({
    fallback: scenarioConfig.bundleId,
    platformEnvNames: ['RABBY_IOS_E2E_BUNDLE_ID', 'RABBY_IOS_DEBUG_BUNDLE_ID'],
  });
  const appPassword = resolveMaestroAppPassword({
    fallback: scenarioConfig.appPassword,
    platformEnvNames: ['RABBY_IOS_APP_PASSWORD', 'RABBY_ANDROID_APP_PASSWORD'],
  });
  const privateKeysEnvName = scenarioConfig.privateKeysEnvName;
  const privateKeyEnvName = scenarioConfig.privateKeyEnvName;
  const { privateKeys, sourceEnvName } = resolvePrivateKeys({
    privateKeysEnvName,
    fallbackPrivateKeyEnvName: privateKeyEnvName,
  });
  const privateKey = privateKeys[0];
  const flowFile = resolveMaestroFile(scenarioConfig.flowFile);

  if (!fs.existsSync(flowFile)) {
    throw new Error(`[maestro:ios-onboarding] flow file not found: ${flowFile}`);
  }

  const bootedSimulator = resolveBootedIOSSimulator(xcrunBinary);
  const simulatorUDID = resolveIOSSimulatorUDID(xcrunBinary);
  const simulatorName =
    bootedSimulator.udid === simulatorUDID
      ? bootedSimulator.name
      : simulatorUDID;

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'ios-onboarding-import-private-key',
    runId,
  );

  ensureOutputDir(outputDir);

  log('maestro:ios-onboarding', `Flow: ${flowFile}`);
  log('maestro:ios-onboarding', `Artifacts: ${outputDir}`);
  log(
    'maestro:ios-onboarding',
    `Using private key #1 from ${sourceEnvName}`,
  );
  log(
    'maestro:ios-onboarding',
    `Simulator: ${simulatorName} (${simulatorUDID})`,
  );

  terminateIOSApp(xcrunBinary, simulatorUDID, bundleId);

  if (scenarioConfig.clearAppData !== false) {
    log('maestro:ios-onboarding', 'Clearing simulator app data');
    clearIOSAppData(xcrunBinary, simulatorUDID, bundleId);
  }

  if (scenarioConfig.resetKeychain !== false) {
    log('maestro:ios-onboarding', 'Resetting simulator keychain');
    resetIOSKeychain(xcrunBinary, simulatorUDID);
  }

  log('maestro:ios-onboarding', 'Writing private key to simulator pasteboard');
  writeIOSPasteboard(xcrunBinary, simulatorUDID, privateKey);

  log('maestro:ios-onboarding', `Launching ${bundleId}`);
  launchIOSApp(xcrunBinary, simulatorUDID, bundleId);

  const forwardedArgs = process.argv.slice(2);
  const effectiveForwardedArgs = forwardedArgs.includes('--device')
    ? forwardedArgs
    : ['--device', simulatorUDID, ...forwardedArgs];
  const { command, args } = buildMaestroArgs({
    maestroBin,
    flowFile,
    outputDir,
    packageName: bundleId,
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
    forwardedArgs: effectiveForwardedArgs,
  });

  run(command, args);
  log(
    'maestro:ios-onboarding',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
