#!/usr/bin/env node

const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MOBILE_DIR = path.resolve(__dirname, '..');
const MODES = ['lazy', 'eager'];

if (process.argv[2] === '--probe') {
  probeMode(process.argv[3], process.argv[4], process.argv[5]);
} else {
  runProbe('lazy', 'lazy', 'development', 'inline', 'dev');
  runProbe('', 'lazy', 'development', 'inline', 'dev');
  runProbe('eager', 'eager', 'development', 'preserve', 'dev');
  runProbe('lazy', 'lazy', 'production', 'preserve', 'release');

  console.log(
    '[module-loading] lazy defaults, eager audit aliases, and dev-only dynamic import inlining verified',
  );
}

function runProbe(
  inputMode,
  expectedMode,
  transformEnv,
  expectedDynamicImport,
  callerMode,
) {
  execFileSync(
    process.execPath,
    [__filename, '--probe', expectedMode, expectedDynamicImport, callerMode],
    {
      cwd: MOBILE_DIR,
      env: {
        ...process.env,
        BABEL_ENV: transformEnv,
        NODE_ENV: transformEnv,
        RABBY_MOBILE_MODULE_LOADING_MODE: inputMode,
      },
      stdio: 'inherit',
    },
  );
}

function probeMode(mode, expectedDynamicImport, callerMode) {
  const babel = require('@babel/core');
  const source = [
    "import '@/perfs/loadables/screens';",
    "import '@/startup/moduleLoading/launchTaskLoaders';",
    "import '@/startup/moduleLoading/setupRuntimeLoaders';",
    "export const loadProbe = () => import('@/hooks/lang');",
  ].join('\n');
  const output = babel.transformSync(source, {
    babelrc: false,
    caller: {
      dev: callerMode === 'dev',
      name: 'metro',
      platform: 'android',
    },
    configFile: path.join(MOBILE_DIR, 'babel.config.js'),
    cwd: MOBILE_DIR,
    filename: path.join(MOBILE_DIR, 'src/__module-loading-probe.ts'),
  })?.code;

  for (const moduleName of [
    'perfs/loadables/screens',
    'startup/moduleLoading/launchTaskLoaders',
    'startup/moduleLoading/setupRuntimeLoaders',
  ]) {
    assert.match(output || '', new RegExp(`${moduleName}\\.${mode}`));
  }

  if (expectedDynamicImport === 'inline') {
    assert.doesNotMatch(output || '', /\bimport\s*\(/);
    assert.match(output || '', /require\(["']\.\/hooks\/lang["']\)/);
  } else {
    assert.match(output || '', /\bimport\s*\(/);
  }
}
