#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { resolveDevProfile } = require('./dev-profile.cjs');

const MOBILE_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(MOBILE_DIR, '../..');
const CACHE_DIR = path.resolve(
  MOBILE_DIR,
  'node_modules/.cache/rabby-mobile-dev',
);
const STATE_FILE = path.join(CACHE_DIR, 'prepare-state.json');
const YARN_COMMAND = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';

const profileName = process.argv[2] || 'lean';
const profile = resolveDevProfile(profileName);
const forcePrepare = process.env.RABBY_MOBILE_DEV_FORCE_PREPARE === '1';
const dependencyProjects = JSON.parse(
  fs.readFileSync(path.join(REPO_DIR, 'tsconfig.build.json'), 'utf8'),
).references.map(({ path: projectPath }) => {
  const directory = projectPath.replace(/\/tsconfig\.build\.json$/u, '');
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_DIR, directory, 'package.json'), 'utf8'),
  );
  return { directory, packageJson };
});

const BUILD_DEPENDENCY_INPUTS = [
  'package.json',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.build.json',
  'types',
  ...dependencyProjects.flatMap(({ directory }) => [
    `${directory}/package.json`,
    `${directory}/src`,
    `${directory}/tsconfig.json`,
    `${directory}/tsconfig.build.json`,
  ]),
];

const BUILD_DEPENDENCY_OUTPUTS = dependencyProjects.flatMap(
  ({ directory, packageJson }) =>
    [packageJson.main, packageJson.types]
      .filter(Boolean)
      .map(outputPath => path.posix.join(directory, outputPath)),
);

const INPAGE_INPUTS = [
  'package.json',
  'yarn.lock',
  'apps/mobile/package.json',
  'apps/mobile/react-native.config.js',
  'apps/mobile/scripts/fns.sh',
  'apps/mobile/scripts/postinstall.sh',
  'apps/mobile/scripts/verify-local-page-assets.cjs',
  'apps/mobile/assets/fonts',
  'apps/mobile-local-pages/package.json',
  'apps/mobile-local-pages/scripts',
  'apps/mobile-local-pages/src',
  'apps/mobile-local-pages/tsconfig.json',
  'apps/mobile-local-pages/vite.config.ts',
  'packages/base-utils/src',
  'packages/rn-webview-bridge/package.json',
  'packages/rn-webview-bridge/scripts',
  'packages/rn-webview-bridge/src',
];

const INPAGE_OUTPUTS = [
  'apps/mobile/assets/custom/InpageBridgeWeb3.js',
  'apps/mobile/src/core/bridges/InpageBridgeWeb3.js',
  'apps/mobile/assets/android/builtin-pages/pages/index.html',
  'apps/mobile/assets/android/builtin-pages/pages/tradingview-candle-chart.html',
  'apps/mobile/assets/ios/builtin-pages/pages/index.html',
  'apps/mobile/assets/ios/builtin-pages/pages/tradingview-candle-chart.html',
  'apps/mobile/android/app/src/main/assets/custom/builtin-pages/pages/tradingview-candle-chart.html',
];

const DEVTOOLS_INPUTS = [
  'package.json',
  'yarn.lock',
  'packages/base-utils/src',
  'packages/rozenite-resource-flow-plugin/package.json',
  'packages/rozenite-resource-flow-plugin/rozenite.config.ts',
  'packages/rozenite-resource-flow-plugin/scripts',
  'packages/rozenite-resource-flow-plugin/src',
  'packages/rozenite-resource-flow-plugin/tsconfig.json',
  'packages/rozenite-resource-flow-plugin/vite.config.ts',
];

const DEVTOOLS_OUTPUTS = [
  'packages/rozenite-resource-flow-plugin/dist/index.js',
  'packages/rozenite-resource-flow-plugin/dist/panel.html',
  'packages/rozenite-resource-flow-plugin/dist/rozenite.json',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || MOBILE_DIR,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runYarn(...args) {
  run(YARN_COMMAND, args);
}

function runNodeScript(relativePath, ...args) {
  run(process.execPath, [path.resolve(MOBILE_DIR, relativePath), ...args]);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function trackedInputFiles(inputPaths) {
  const result = spawnSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...inputPaths,
    ],
    {
      cwd: REPO_DIR,
      encoding: 'utf8',
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      result.stderr || 'Unable to enumerate dev preparation inputs',
    );
  }

  return result.stdout.split(/\r?\n/).filter(Boolean).sort();
}

function hashInputs(inputPaths) {
  const hash = crypto.createHash('sha256');
  const files = trackedInputFiles(inputPaths);

  for (const relativePath of files) {
    const absolutePath = path.resolve(REPO_DIR, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      continue;
    }
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(absolutePath));
    hash.update('\0');
  }

  return hash.digest('hex');
}

function missingOutputs(outputPaths) {
  return outputPaths.filter(relativePath => {
    const absolutePath = path.resolve(REPO_DIR, relativePath);
    return !fs.existsSync(absolutePath) || fs.statSync(absolutePath).size === 0;
  });
}

function ensureArtifact({ inputPaths, name, outputPaths, state, yarnScript }) {
  const inputHash = hashInputs(inputPaths);
  const missing = missingOutputs(outputPaths);
  const isCurrent =
    !forcePrepare &&
    missing.length === 0 &&
    state[name]?.inputHash === inputHash;

  if (isCurrent) {
    console.log(`[dev:prepare] ${name} is current; skip ${yarnScript}`);
    return;
  }

  const reason = forcePrepare
    ? 'forced'
    : missing.length > 0
    ? `missing ${missing.join(', ')}`
    : 'inputs changed';
  console.log(`[dev:prepare] rebuild ${name}: ${reason}`);
  runYarn(yarnScript);

  const missingAfterBuild = missingOutputs(outputPaths);
  if (missingAfterBuild.length > 0) {
    throw new Error(
      `${name} build completed without required outputs: ${missingAfterBuild.join(
        ', ',
      )}`,
    );
  }

  state[name] = {
    // Builds may update generated files that are also consumed as inputs.
    inputHash: hashInputs(inputPaths),
    preparedAt: new Date().toISOString(),
  };
  writeState(state);
}

function ensureGitHooks() {
  const result = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    cwd: REPO_DIR,
    encoding: 'utf8',
  });
  const hooksPath = result.status === 0 ? result.stdout.trim() : '';

  if (hooksPath === '.husky' && fs.existsSync(path.join(REPO_DIR, '.husky'))) {
    console.log('[dev:prepare] git hooks are current');
    return;
  }

  runYarn('ensure-git-hooks');
}

function assertSupportedNodeVersion() {
  const majorVersion = Number.parseInt(process.versions.node, 10);
  if (!Number.isFinite(majorVersion) || majorVersion < 22) {
    throw new Error(
      `Node.js v22 or higher is required. Current version: ${process.version}`,
    );
  }
}

console.log(
  `[dev:prepare] profile=${profileName} moduleLoading=${profile.moduleLoadingMode} rozenite=${profile.rozeniteEnabled}`,
);
assertSupportedNodeVersion();
ensureGitHooks();
runNodeScript('scripts/generate-loadables.cjs');

const state = readState();
ensureArtifact({
  inputPaths: BUILD_DEPENDENCY_INPUTS,
  name: 'build-dependencies',
  outputPaths: BUILD_DEPENDENCY_OUTPUTS,
  state,
  yarnScript: 'build:deps',
});
ensureArtifact({
  inputPaths: INPAGE_INPUTS,
  name: 'inpage',
  outputPaths: INPAGE_OUTPUTS,
  state,
  yarnScript: 'build-inpage',
});
runYarn('verify:local-pages');

if (profile.rozeniteEnabled) {
  ensureArtifact({
    inputPaths: DEVTOOLS_INPUTS,
    name: 'devtools-panel',
    outputPaths: DEVTOOLS_OUTPUTS,
    state,
    yarnScript: 'build:devtools-panel',
  });
} else {
  console.log('[dev:prepare] Rozenite disabled; skip devtools panel');
}
