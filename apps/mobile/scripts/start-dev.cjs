#!/usr/bin/env node

const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const {
  createDevEnvironment,
  resolveDevProfile,
} = require('./dev-profile.cjs');

const MOBILE_DIR = path.resolve(__dirname, '..');
const YARN_COMMAND = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

const profileName = process.argv[2] || 'lean';
const metroArgs = process.argv.slice(3);
const profile = resolveDevProfile(profileName);
const environment = createDevEnvironment(profileName);
let forwardedSignal = null;

console.log(
  `[dev] profile=${profileName} moduleLoading=${profile.moduleLoadingMode} rozenite=${profile.rozeniteEnabled}`,
);

const preparation = spawnSync(
  process.execPath,
  [path.join(__dirname, 'prepare-dev.cjs'), profileName],
  {
    cwd: MOBILE_DIR,
    env: environment,
    stdio: 'inherit',
  },
);

if (preparation.error) {
  throw preparation.error;
}
if (preparation.status !== 0) {
  process.exit(preparation.status || 1);
}

const metro = spawn(
  YARN_COMMAND,
  ['exec', 'react-native', 'start', ...metroArgs],
  {
    cwd: MOBILE_DIR,
    env: environment,
    stdio: 'inherit',
  },
);

metro.on('error', error => {
  console.error(error);
  process.exitCode = 1;
});
metro.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!forwardedSignal && !metro.killed) {
      forwardedSignal = signal;
      metro.kill(signal);
    }
  });
}
