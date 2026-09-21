#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  assertNodeVersion,
  ensureOutputDir,
  formatRunId,
  resolveArtifactRootDir,
} from './shared/android.mjs';
import { log } from './shared/process.mjs';

const SUITE_STEPS = [
  {
    id: 'single-home-balance-smoke',
    script: 'run-android-single-home-balance-smoke.mjs',
  },
  {
    id: 'home-balance-smoke',
    script: 'run-android-home-balance-smoke.mjs',
  },
  {
    id: 'home-add-watch-address',
    script: 'run-android-home-add-watch-address.mjs',
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runStep(scriptPath, forwardedArgs) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, [scriptPath, ...forwardedArgs], {
    stdio: 'inherit',
    env: process.env,
  });
  const finishedAt = new Date().toISOString();

  return {
    startedAt,
    finishedAt,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
  };
}

async function main() {
  assertNodeVersion();

  const artifactRootDir = resolveArtifactRootDir();
  const runId = formatRunId();
  const outputDir = path.join(
    artifactRootDir,
    'maestro',
    'android-balance-suite',
    runId,
  );
  ensureOutputDir(outputDir);

  const forwardedArgs = process.argv.slice(2);
  const summary = {
    suite: 'android-balance-suite',
    runId,
    outputDir,
    steps: [],
    status: 'passed',
  };

  log('maestro:balance-suite', `Artifacts: ${outputDir}`);

  for (const step of SUITE_STEPS) {
    const scriptPath = path.resolve(__dirname, step.script);
    log('maestro:balance-suite', `Running ${step.id} via ${scriptPath}`);

    const stepResult = runStep(scriptPath, forwardedArgs);
    summary.steps.push({
      ...step,
      ...stepResult,
    });

    if (stepResult.status !== 'passed') {
      summary.status = 'failed';
      break;
    }
  }

  const summaryPath = path.join(outputDir, 'summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  log('maestro:balance-suite', `Summary: ${summaryPath}`);

  if (summary.status !== 'passed') {
    process.exitCode = 1;
    return;
  }

  log('maestro:balance-suite', 'Completed');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
