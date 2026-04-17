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
  runAdb,
  runMaestroFlow,
} from './shared/android.mjs';
import { callRabbyDevtoolsBridgeMethod } from './shared/devtools.mjs';
import { writeJsonArtifact } from './shared/balance-devtools.mjs';
import { waitForStableSendSnapshot } from './shared/send-devtools.mjs';
import { loadSendFixture } from './shared/send-fixture.mjs';
import { log } from './shared/process.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function ensureDebugPackage(packageName) {
  if (packageName.endsWith('.debug')) {
    return;
  }

  throw new Error(
    `[maestro:send-smoke] Debug package required for Send smoke. Current package: ${packageName}`,
  );
}

async function main() {
  assertNodeVersion();
  loadLocalEnv();

  const config = await loadMaestroConfig();
  const scenarioConfig = config.android.sendSmoke;
  const onboardingConfig = config.android.onboardingImportPrivateKey;
  const maestroBin = resolveMaestroBinary(config);
  const { fixture, filePath: fixturePath } = loadSendFixture(config);

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

  ensureDebugPackage(packageName);

  const flowFile = resolveMaestroFile(scenarioConfig.flowFile);
  const bootstrapFlowFile = resolveMaestroFile(scenarioConfig.bootstrapFlowFile);

  if (!fs.existsSync(flowFile)) {
    throw new Error(`[maestro:send-smoke] flow file not found: ${flowFile}`);
  }
  if (!fs.existsSync(bootstrapFlowFile)) {
    throw new Error(
      `[maestro:send-smoke] bootstrap flow file not found: ${bootstrapFlowFile}`,
    );
  }

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-send-smoke',
    runId,
  );

  ensureOutputDir(outputDir);
  const adbBinary = resolveAdbBinary();
  ensureAndroidReady(adbBinary);

  log(
    'maestro:send-smoke',
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
      `[maestro:send-smoke] unable to resolve launch activity for ${packageName}`,
    );
  }

  log('maestro:send-smoke', `Launching ${launchActivity} via adb`);
  launchAndroidActivity(adbBinary, launchActivity);
  log(
    'maestro:send-smoke',
    'Waiting 8s for the app to settle after launch before starting Maestro',
  );
  await sleep(8000);

  log('maestro:send-smoke', `Fixture: ${fixturePath}`);
  log('maestro:send-smoke', `Bootstrap flow: ${bootstrapFlowFile}`);
  log('maestro:send-smoke', `Send flow: ${flowFile}`);
  log('maestro:send-smoke', `Artifacts: ${outputDir}`);

  const forwardedArgs = process.argv.slice(2);
  const baseMaestroEnv = {
    ...config.maestro.env,
    ...scenarioConfig.maestroEnv,
  };

  runScenarioFlow({
    maestroBin,
    flowFile: bootstrapFlowFile,
    outputDir,
    reportBasename: 'bootstrap',
    packageName,
    appPassword,
    maestroEnv: baseMaestroEnv,
    forwardedArgs,
  });

  const ping = await callRabbyDevtoolsBridgeMethod({
    appId: packageName,
    method: 'ping',
  });
  writeJsonArtifact(outputDir, 'devtools-ping.json', ping);

  const openSend = await callRabbyDevtoolsBridgeMethod({
    appId: packageName,
    method: 'openSendScreen',
    args: [fixture],
  });
  writeJsonArtifact(outputDir, 'devtools-send-open.json', openSend);

  const initialState = await waitForStableSendSnapshot({
    appId: packageName,
    expected: {
      fromAddress: fixture.from.address,
      toAddress: fixture.to.address,
      tokenChain: fixture.token.chain,
      tokenId: fixture.token.tokenId,
      canSubmit: false,
    },
  });
  writeJsonArtifact(outputDir, 'devtools-send-initial.json', initialState.snapshot);

  const setAmount = await callRabbyDevtoolsBridgeMethod({
    appId: packageName,
    method: 'setSendAmount',
    args: [fixture.amount],
  });
  writeJsonArtifact(outputDir, 'devtools-send-set-amount.json', setAmount);

  const readyState = await waitForStableSendSnapshot({
    appId: packageName,
    expected: {
      fromAddress: fixture.from.address,
      toAddress: fixture.to.address,
      tokenChain: fixture.token.chain,
      tokenId: fixture.token.tokenId,
      amount: fixture.amount,
      canSubmit: true,
    },
  });
  writeJsonArtifact(
    outputDir,
    'devtools-send-filled-before-maestro.json',
    readyState.snapshot,
  );

  runScenarioFlow({
    maestroBin,
    flowFile,
    outputDir,
    reportBasename: 'report',
    packageName,
    appPassword,
    maestroEnv: baseMaestroEnv,
    forwardedArgs,
  });

  const filledState = await waitForStableSendSnapshot({
    appId: packageName,
    expected: {
      fromAddress: fixture.from.address,
      toAddress: fixture.to.address,
      tokenChain: fixture.token.chain,
      tokenId: fixture.token.tokenId,
      amount: '',
      canSubmit: false,
      latestTxStatus: 'success',
      latestTxTo: fixture.to.address,
      latestTxAmount: Number(fixture.amount),
      latestTxTokenId: fixture.token.tokenId,
    },
    timeoutMs: 90000,
  });
  writeJsonArtifact(outputDir, 'devtools-send-filled.json', filledState.snapshot);

  log(
    'maestro:send-smoke',
    'Send smoke passed. Maestro reports and DevTools artifacts were written successfully.',
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
