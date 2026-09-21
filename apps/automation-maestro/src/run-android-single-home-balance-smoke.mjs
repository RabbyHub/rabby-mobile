#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './shared/env.mjs';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
import {
  assertNodeVersion,
  clearPackage,
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
  runMaestroFlow,
} from './shared/android.mjs';
import { callRabbyDevtoolsBridgeMethod } from './shared/devtools.mjs';
import {
  waitForStableHomeSnapshot,
  waitForStableSingleHomeSnapshot,
  writeJsonArtifact,
} from './shared/balance-devtools.mjs';
import { log } from './shared/process.mjs';
import {
  buildPrivateKeyEnv,
  resolvePrivateKeys,
} from './shared/private-keys.mjs';

function shouldRunDevtoolsValidation(packageName) {
  if (process.env.RABBY_MAESTRO_SKIP_DEVTOOLS_CHECK === '1') {
    log(
      'maestro:single-home',
      'Skipping DevTools validation because RABBY_MAESTRO_SKIP_DEVTOOLS_CHECK=1',
    );
    return false;
  }

  if (!packageName.endsWith('.debug')) {
    log(
      'maestro:single-home',
      `Skipping DevTools validation for non-debug package ${packageName}`,
    );
    return false;
  }

  return true;
}

function runScenarioFlow({
  maestroBin,
  flowFile,
  outputDir,
  reportBasename,
  packageName,
  appPassword,
  maestroEnv,
  forwardedArgs,
}) {
  runMaestroFlow({
    maestroBin,
    flowFile,
    outputDir,
    reportBasename,
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });
}

async function runDebugDevtoolsValidation({
  packageName,
  outputDir,
  maestroBin,
  appPassword,
  maestroEnv,
  forwardedArgs,
}) {
  log(
    'maestro:single-home',
    'Running React Native DevTools state validation against the debug runtime',
  );

  const ping = await callRabbyDevtoolsBridgeMethod({
    appId: packageName,
    method: 'ping',
  });
  writeJsonArtifact(outputDir, 'devtools-ping.json', ping);

  const readyState = await waitForStableSingleHomeSnapshot({
    appId: packageName,
  });
  writeJsonArtifact(
    outputDir,
    'devtools-single-home-ready.json',
    readyState.snapshot,
  );
  const initialFolded = readyState.snapshot?.curveUiState?.isFolded;
  if (typeof initialFolded !== 'boolean') {
    throw new Error(
      '[maestro:single-home] DevTools validation failed: single-home folded state is missing',
    );
  }

  const singleHomeToggleFlow = resolveMaestroFile(
    'flows/android-single-home-toggle-curve.yaml',
  );
  if (!fs.existsSync(singleHomeToggleFlow)) {
    throw new Error(
      `[maestro:single-home] flow file not found: ${singleHomeToggleFlow}`,
    );
  }

  const toggledFolded = !initialFolded;
  const firstToggleLabel = toggledFolded ? 'closed' : 'open';
  const secondToggleLabel = initialFolded ? 'closed' : 'open';

  log(
    'maestro:single-home',
    `Toggling single-home curve ${firstToggleLabel}`,
  );
  runScenarioFlow({
    maestroBin,
    flowFile: singleHomeToggleFlow,
    outputDir,
    reportBasename: toggledFolded ? 'collapse-curve' : 'expand-curve',
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });
  const expandedState = await waitForStableSingleHomeSnapshot({
    appId: packageName,
    expectedFolded: toggledFolded,
  });
  writeJsonArtifact(
    outputDir,
    toggledFolded
      ? 'devtools-single-home-collapsed.json'
      : 'devtools-single-home-expanded.json',
    expandedState.snapshot,
  );

  log(
    'maestro:single-home',
    `Toggling single-home curve ${secondToggleLabel}`,
  );
  runScenarioFlow({
    maestroBin,
    flowFile: singleHomeToggleFlow,
    outputDir,
    reportBasename: initialFolded
      ? 'collapse-curve-restore'
      : 'expand-curve-restore',
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });
  const collapsedState = await waitForStableSingleHomeSnapshot({
    appId: packageName,
    expectedFolded: initialFolded,
  });
  writeJsonArtifact(
    outputDir,
    'devtools-single-home-restored.json',
    collapsedState.snapshot,
  );

  const backToHomeFlow = resolveMaestroFile(
    'flows/android-single-home-back-to-home.yaml',
  );
  if (!fs.existsSync(backToHomeFlow)) {
    throw new Error(
      `[maestro:single-home] flow file not found: ${backToHomeFlow}`,
    );
  }

  log('maestro:single-home', 'Returning from single-home back to Home');
  runScenarioFlow({
    maestroBin,
    flowFile: backToHomeFlow,
    outputDir,
    reportBasename: 'back-to-home',
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });
  const backHomeState = await waitForStableHomeSnapshot({
    appId: packageName,
  });
  writeJsonArtifact(
    outputDir,
    'devtools-home-after-single-home.json',
    backHomeState.snapshot,
  );
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const scenarioConfig = config.android.singleHomeBalanceSmoke;
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
  const privateKeysEnvName = onboardingConfig.privateKeysEnvName;
  const privateKeyEnvName = onboardingConfig.privateKeyEnvName;
  const { privateKeys, sourceEnvName } = resolvePrivateKeys({
    privateKeysEnvName,
    fallbackPrivateKeyEnvName: privateKeyEnvName,
  });
  const privateKey = privateKeys[0];

  const flowFile = resolveMaestroFile(scenarioConfig.flowFile);
  if (!fs.existsSync(flowFile)) {
    throw new Error(`[maestro:single-home] flow file not found: ${flowFile}`);
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-single-home-balance-smoke',
    runId,
  );

  ensureOutputDir(outputDir);
  const adbBinary = resolveAdbBinary();
  ensureAndroidReady(adbBinary);

  log('maestro:single-home', `Flow: ${flowFile}`);
  log('maestro:single-home', `Artifacts: ${outputDir}`);
  log(
    'maestro:single-home',
    `Using private key #1 from ${sourceEnvName}`,
  );

  log('maestro:single-home', 'Resetting app state via adb');
  clearPackage(adbBinary, packageName);

  const launchActivity = resolveLaunchActivity(
    adbBinary,
    packageName,
    onboardingConfig.launchActivity,
  );

  if (!launchActivity || launchActivity === 'No activity found') {
    throw new Error(
      `[maestro:single-home] unable to resolve launch activity for ${packageName}`,
    );
  }

  log('maestro:single-home', `Launching ${launchActivity} via adb`);
  launchAndroidActivity(adbBinary, launchActivity);

  const maestroEnv = {
    ...buildPrivateKeyEnv({
      privateKey,
      allPrivateKeys: privateKeys,
      privateKeyEnvName,
      privateKeysEnvName,
    }),
    ...config.maestro.env,
    ...scenarioConfig.maestroEnv,
  };
  const forwardedArgs = process.argv.slice(2);

  runScenarioFlow({
    maestroBin,
    flowFile,
    outputDir,
    reportBasename: 'report',
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });

  if (shouldRunDevtoolsValidation(packageName)) {
    await runDebugDevtoolsValidation({
      packageName,
      outputDir,
      maestroBin,
      appPassword,
      maestroEnv,
      forwardedArgs,
    });
  }

  log(
    'maestro:single-home',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
