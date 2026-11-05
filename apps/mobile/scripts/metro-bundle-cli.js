#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const simulatorProfile = process.env.RABBY_MOBILE_SIMULATOR_BUILD_INPUT_PROFILE;
let simulatorReceipt;
if (simulatorProfile) {
  if (
    simulatorProfile !== 'simulator-smoke-v1' ||
    process.env.PLATFORM_NAME !== 'iphonesimulator' ||
    process.env.CONFIGURATION !== 'Regression' ||
    !path.isAbsolute(process.env.RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT || '')
  ) {
    console.error('[RabbyMobileBuild] Invalid Simulator bundle input context.');
    process.exit(1);
  }
  simulatorReceipt = process.env.RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT;
  if (fs.existsSync(simulatorReceipt)) {
    console.error(
      '[RabbyMobileBuild] Simulator bundle receipt already exists.',
    );
    process.exit(1);
  }
  // Xcode login shells and .xcode.env.local have already run. Reassert public
  // inputs at the final boundary, before Metro computes its transform cache.
  process.env.RABBY_MOBILE_KR_PWD = 'RABBY_SIMULATOR_SMOKE_PASSWORD';
  process.env.RABBY_MOBILE_CODE = 'RABBY_SIMULATOR_SMOKE_CODE';
  process.env.RABBY_MOBILE_SAFE_API_KEY = 'RABBY_SIMULATOR_SMOKE_SAFE_API_KEY';
}

const cacheEnabled = ['1', 'true'].includes(
  (process.env.RABBY_MOBILE_METRO_USE_CACHE || '').toLowerCase(),
);
const delegate =
  process.env.RABBY_MOBILE_METRO_CLI_DELEGATE ||
  path.resolve(__dirname, '../node_modules/react-native/cli.js');
const bundleArgs = cacheEnabled
  ? process.argv.slice(2).filter(arg => arg !== '--reset-cache')
  : process.argv.slice(2);

if (cacheEnabled) {
  console.log('[RabbyMobileBuild] Metro transform cache is enabled.');
}

const child = spawn(
  process.execPath,
  [...process.execArgv, delegate, ...bundleArgs],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('error', error => {
  console.error(
    '[RabbyMobileBuild] Failed to start the Metro bundle CLI.',
    error,
  );
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(
      `[RabbyMobileBuild] Metro bundle CLI exited from signal ${signal}.`,
    );
    process.exit(1);
  }

  if (code === 0 && simulatorReceipt) {
    try {
      fs.writeFileSync(
        simulatorReceipt,
        JSON.stringify({ buildInputProfile: simulatorProfile }) + '\n',
        { flag: 'wx' },
      );
    } catch {
      console.error(
        '[RabbyMobileBuild] Could not write Simulator bundle receipt.',
      );
      process.exit(1);
    }
  }

  process.exit(code ?? 1);
});
