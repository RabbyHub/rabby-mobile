#!/usr/bin/env node

'use strict';

const path = require('path');
const { spawn } = require('child_process');

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

  process.exit(code ?? 1);
});
