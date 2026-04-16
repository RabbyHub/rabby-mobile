#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadLocalEnv } from './shared/env.mjs';
import { loadMaestroConfig, resolveMaestroFile } from './shared/config.mjs';
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
  runMaestroFlow,
  runAdb,
} from './shared/android.mjs';
import { callRabbyDevtoolsBridgeMethod } from './shared/devtools.mjs';
import {
  waitForStableHomeSnapshot,
  writeJsonArtifact,
} from './shared/balance-devtools.mjs';
import { log } from './shared/process.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRunDevtoolsValidation(packageName) {
  if (process.env.RABBY_MAESTRO_SKIP_DEVTOOLS_CHECK === '1') {
    log(
      'maestro:home-balance',
      'Skipping DevTools validation because RABBY_MAESTRO_SKIP_DEVTOOLS_CHECK=1',
    );
    return false;
  }

  if (!packageName.endsWith('.debug')) {
    log(
      'maestro:home-balance',
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

async function runDevtoolsSequence({
  packageName,
  outputDir,
  maestroBin,
  appPassword,
  maestroEnv,
  forwardedArgs,
}) {
  log(
    'maestro:home-balance',
    'Running React Native DevTools state validation against the debug runtime',
  );

  const ping = await callRabbyDevtoolsBridgeMethod({
    appId: packageName,
    method: 'ping',
  });
  writeJsonArtifact(outputDir, 'devtools-ping.json', ping);

  const readyState = await waitForStableHomeSnapshot({ appId: packageName });
  writeJsonArtifact(
    outputDir,
    'devtools-home-portfolio-snapshot.json',
    readyState.payload,
  );
  writeJsonArtifact(outputDir, 'devtools-home-ready.json', readyState.snapshot);
  const initialFolded = readyState.snapshot?.curveUiState?.isFolded;
  if (typeof initialFolded !== 'boolean') {
    throw new Error(
      '[maestro:home-balance] DevTools validation failed: Home folded state is missing',
    );
  }

  const toggleFlow = resolveMaestroFile('flows/android-home-toggle-curve.yaml');
  if (!fs.existsSync(toggleFlow)) {
    throw new Error(
      `[maestro:home-balance] flow file not found: ${toggleFlow}`,
    );
  }

  const toggledFolded = !initialFolded;
  const firstToggleLabel = toggledFolded ? 'closed' : 'open';
  const secondToggleLabel = initialFolded ? 'closed' : 'open';

  log('maestro:home-balance', `Toggling Home curve ${firstToggleLabel}`);
  runScenarioFlow({
    maestroBin,
    flowFile: toggleFlow,
    outputDir,
    reportBasename: toggledFolded ? 'collapse-curve' : 'expand-curve',
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });
  const expandedState = await waitForStableHomeSnapshot({
    appId: packageName,
    expectedFolded: toggledFolded,
  });
  writeJsonArtifact(
    outputDir,
    toggledFolded
      ? 'devtools-home-collapsed.json'
      : 'devtools-home-expanded.json',
    expandedState.snapshot,
  );

  log('maestro:home-balance', `Toggling Home curve ${secondToggleLabel}`);
  runScenarioFlow({
    maestroBin,
    flowFile: toggleFlow,
    outputDir,
    reportBasename: initialFolded ? 'collapse-curve-restore' : 'expand-curve-restore',
    packageName,
    appPassword,
    maestroEnv,
    forwardedArgs,
  });
  const collapsedState = await waitForStableHomeSnapshot({
    appId: packageName,
    expectedFolded: initialFolded,
  });
  writeJsonArtifact(
    outputDir,
    'devtools-home-restored.json',
    collapsedState.snapshot,
  );

  log(
    'maestro:home-balance',
    'DevTools validation passed and artifacts were written next to the Maestro reports',
  );
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const scenarioConfig = config.android.homeBalanceSmoke;
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
    throw new Error(`[maestro:home-balance] flow file not found: ${flowFile}`);
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-home-balance-smoke',
    runId,
  );

  ensureOutputDir(outputDir);
  const adbBinary = resolveAdbBinary();
  ensureAndroidReady(adbBinary);

  log(
    'maestro:home-balance',
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
      `[maestro:home-balance] unable to resolve launch activity for ${packageName}`,
    );
  }

  log('maestro:home-balance', `Launching ${launchActivity} via adb`);
  launchAndroidActivity(adbBinary, launchActivity);
  log(
    'maestro:home-balance',
    'Waiting 8s for the app to settle after launch before starting Maestro',
  );
  await sleep(8000);

  log('maestro:home-balance', `Flow: ${flowFile}`);
  log('maestro:home-balance', `Artifacts: ${outputDir}`);
  log(
    'maestro:home-balance',
    'App state is preserved. The flow will bootstrap from onboarding on Welcome, unlock on Lock screen, or continue directly on Home.',
  );

  const maestroEnv = {
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
    await runDevtoolsSequence({
      packageName,
      outputDir,
      maestroBin,
      appPassword,
      maestroEnv,
      forwardedArgs,
    });
  }
  log(
    'maestro:home-balance',
    `Completed. Report: ${path.join(outputDir, 'report.html')}`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
