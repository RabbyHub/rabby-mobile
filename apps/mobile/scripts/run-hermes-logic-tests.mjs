#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(mobileRoot, '../..');

const entryFile = path.join(mobileRoot, 'hermes-tests/logic-smoke.ts');
process.env.RABBY_MOBILE_HERMES_LOGIC_TEST = '1';
delete process.env.NO_COLOR;
delete process.env.FORCE_COLOR;

function log(message) {
  console.log(`[hermes-logic] ${message}`);
}

function resolveFromRoots(request) {
  const roots = [
    process.env.RABBY_MOBILE_NODE_MODULES_ROOT,
    mobileRoot,
    repoRoot,
  ].filter(Boolean);

  return require.resolve(request, { paths: roots });
}

function makeNodePath() {
  const roots = [
    process.env.RABBY_MOBILE_NODE_MODULES_ROOT,
    mobileRoot,
    repoRoot,
  ].filter(Boolean);
  const dirs = [];

  for (const root of roots) {
    if (root.endsWith('node_modules')) {
      dirs.push(root);
    } else {
      dirs.push(path.join(root, 'node_modules'));
      dirs.push(path.join(root, 'apps/mobile/node_modules'));
    }
  }

  if (process.env.NODE_PATH) {
    dirs.push(process.env.NODE_PATH);
  }

  return Array.from(new Set(dirs.filter(dir => fs.existsSync(dir)))).join(
    path.delimiter,
  );
}

function makeFallbackRoots() {
  const roots = [
    process.env.RABBY_MOBILE_NODE_MODULES_ROOT,
    mobileRoot,
    repoRoot,
  ].filter(Boolean);

  const rootWatchFolders = [];
  for (const root of roots) {
    if (root.endsWith('node_modules')) {
      rootWatchFolders.push(root);
      continue;
    }

    rootWatchFolders.push(path.join(root, 'node_modules'));
    rootWatchFolders.push(path.join(root, 'apps/mobile/node_modules'));

    const packageDir = path.join(root, 'packages');
    if (root !== repoRoot && fs.existsSync(packageDir)) {
      rootWatchFolders.push(packageDir);
    }
  }

  return rootWatchFolders.filter(root => fs.existsSync(root));
}

function hasExternalWorkspacePackages() {
  const fallbackRoot = process.env.RABBY_MOBILE_NODE_MODULES_ROOT;
  if (!fallbackRoot) {
    return false;
  }

  const root = fallbackRoot.endsWith('node_modules')
    ? path.dirname(fallbackRoot)
    : fallbackRoot;

  return root !== repoRoot && fs.existsSync(path.join(root, 'packages'));
}

function installNodePathForFallbackNodeModules() {
  const nodePath = makeNodePath();
  if (!nodePath) {
    return;
  }

  process.env.NODE_PATH = nodePath;
  Module._initPaths();
}

function run(command, args, options = {}) {
  log(`${command} ${args.join(' ')}`);
  const nodePath = makeNodePath();
  const result = spawnSync(command, args, {
    cwd: options.cwd || mobileRoot,
    env: {
      ...process.env,
      ...(nodePath ? { NODE_PATH: nodePath } : null),
      BABEL_ENV: process.env.BABEL_ENV || 'test',
      NODE_ENV: process.env.NODE_ENV || 'test',
      RABBY_MOBILE_BUILD_ENV:
        process.env.RABBY_MOBILE_BUILD_ENV || 'regression',
      RABBY_MOBILE_HERMES_LOGIC_TEST: '1',
      buildchannel: process.env.buildchannel || 'selfhost-reg',
      WITH_ROZENITE: process.env.WITH_ROZENITE || 'false',
    },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 32,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function resolveMobileSourceRequest(moduleName, sourceExts = []) {
  const srcIndex = moduleName.indexOf('src/');
  if (srcIndex === -1 || !moduleName.startsWith('..')) {
    return null;
  }

  const relativeSourcePath = moduleName.slice(srcIndex);
  const candidate = path.join(mobileRoot, relativeSourcePath);
  const extensions = ['', ...sourceExts.map(ext => `.${ext}`)];

  for (const extension of extensions) {
    const filePath = `${candidate}${extension}`;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  return null;
}

function resolveHermesTool(name) {
  const reactNativeRoot = path.dirname(
    resolveFromRoots('react-native/package.json'),
  );
  const platformDir =
    process.platform === 'darwin'
      ? 'osx-bin'
      : process.platform === 'win32'
      ? 'win64-bin'
      : 'linux64-bin';
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const candidate = path.join(
    reactNativeRoot,
    'sdks/hermesc',
    platformDir,
    executable,
  );

  if (fs.existsSync(candidate)) {
    return candidate;
  }

  return null;
}

function resolveExecutableFromEnv(envName) {
  const value = process.env[envName];
  if (!value) {
    return null;
  }

  const executablePath = path.resolve(value);
  if (!fs.existsSync(executablePath)) {
    throw new Error(`${envName} points to a missing executable: ${value}`);
  }

  return executablePath;
}

async function buildMetroBundle({ bundleOutput, assetsDest }) {
  installNodePathForFallbackNodeModules();

  const pluginRoot = path.dirname(
    resolveFromRoots('@react-native/community-cli-plugin/package.json'),
  );
  const {
    unstable_buildBundleWithConfig: buildBundleWithConfig,
  } = require(path.join(pluginRoot, 'dist/commands/bundle/buildBundle.js'));
  const loadMetroConfig = require(path.join(
    pluginRoot,
    'dist/utils/loadMetroConfig.js',
  )).default;
  const reactNativeRoot = path.dirname(
    resolveFromRoots('react-native/package.json'),
  );
  const ctx = {
    root: mobileRoot,
    reactNativePath: reactNativeRoot,
    platforms: {
      android: {},
      ios: {},
    },
    dependencies: {},
    project: {},
  };
  const args = {
    assetsDest,
    bundleEncoding: 'utf8',
    bundleOutput,
    config: path.join(mobileRoot, 'metro.config.js'),
    dev: false,
    entryFile: path.relative(mobileRoot, entryFile),
    minify: true,
    platform: 'android',
    resetCache: false,
    resolverOption: [],
    sourcemapOutput: undefined,
    sourcemapUseAbsolutePath: false,
    unstableTransformProfile: 'hermes',
  };
  const config = await loadMetroConfig(ctx, {
    config: args.config,
    resetCache: args.resetCache,
  });
  const sourceExts = config.resolver.sourceExts || [];
  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const mobileSourceFile = resolveMobileSourceRequest(moduleName, sourceExts);
    if (mobileSourceFile) {
      return {
        filePath: mobileSourceFile,
        type: 'sourceFile',
      };
    }

    return originalResolveRequest
      ? originalResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };

  const fallbackNodeModuleDirs = makeNodePath()
    .split(path.delimiter)
    .filter(Boolean);
  const extraWatchFolders = [...makeFallbackRoots(), ...fallbackNodeModuleDirs];
  const localPackagesDir = path.join(repoRoot, 'packages');
  const baseWatchFolders = hasExternalWorkspacePackages()
    ? (config.watchFolders || []).filter(
        folder => path.resolve(folder) !== localPackagesDir,
      )
    : config.watchFolders || [];

  config.watchFolders = [...baseWatchFolders, ...extraWatchFolders].filter(
    (folder, index, folders) => {
      return (
        folder && fs.existsSync(folder) && folders.indexOf(folder) === index
      );
    },
  );
  config.resolver.nodeModulesPaths = [
    ...(config.resolver.nodeModulesPaths || []),
    ...fallbackNodeModuleDirs,
  ].filter((folder, index, folders) => {
    return folder && fs.existsSync(folder) && folders.indexOf(folder) === index;
  });
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    'react-native': reactNativeRoot,
  };

  await buildBundleWithConfig(args, config);
}

async function main() {
  if (!fs.existsSync(entryFile)) {
    throw new Error(`Hermes logic entry not found: ${entryFile}`);
  }

  const hermesc =
    resolveExecutableFromEnv('RABBY_HERMESC') || resolveHermesTool('hermesc');
  const hermesRuntime =
    resolveExecutableFromEnv('RABBY_HERMES_RUNTIME') ||
    resolveHermesTool('hermes');

  if (!hermesc) {
    throw new Error('Unable to resolve RN bundled hermesc');
  }
  if (!hermesRuntime) {
    throw new Error(
      'Unable to resolve a Hermes runtime. RN bundles hermes for macOS, but Linux packages usually include only hermesc; set RABBY_HERMES_RUNTIME or run this on macOS.',
    );
  }

  const outputRoot =
    process.env.RABBY_HERMES_LOGIC_OUTPUT_DIR ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-hermes-logic-'));
  fs.mkdirSync(outputRoot, { recursive: true });

  const bundleOutput = path.join(outputRoot, 'logic-smoke.bundle.js');
  const bytecodeOutput = path.join(outputRoot, 'logic-smoke.hbc');
  const assetsDest = path.join(outputRoot, 'assets');
  fs.mkdirSync(assetsDest, { recursive: true });

  log(`Output directory: ${outputRoot}`);

  await buildMetroBundle({ bundleOutput, assetsDest });

  run(hermesc, [
    '-w',
    '-O',
    '-emit-binary',
    '-out',
    bytecodeOutput,
    bundleOutput,
  ]);

  run(hermesRuntime, ['-b', bytecodeOutput]);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
