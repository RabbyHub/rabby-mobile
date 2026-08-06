#!/usr/bin/env node

const assert = require('node:assert/strict');
const path = require('node:path');

const { DEV_PROFILES, createDevEnvironment } = require('./dev-profile.cjs');

const MOBILE_DIR = path.resolve(__dirname, '..');
const packageJson = require(path.join(MOBILE_DIR, 'package.json'));

assert.deepEqual(Object.keys(DEV_PROFILES), ['lean', 'inspect', 'eager-audit']);

const leanEnvironment = createDevEnvironment('lean', {
  NODE_OPTIONS: '--trace-warnings --max_old_space_size=4096',
});
assert.equal(leanEnvironment.WITH_ROZENITE, 'false');
assert.equal(leanEnvironment.RABBY_MOBILE_MODULE_LOADING_MODE, 'lazy');
assert.match(leanEnvironment.NODE_OPTIONS, /--trace-warnings/);
assert.match(leanEnvironment.NODE_OPTIONS, /--max_old_space_size=8192/);
assert.doesNotMatch(leanEnvironment.NODE_OPTIONS, /4096/);

const inspectEnvironment = createDevEnvironment('inspect', {});
assert.equal(inspectEnvironment.WITH_ROZENITE, 'true');
assert.equal(inspectEnvironment.RABBY_MOBILE_MODULE_LOADING_MODE, 'lazy');

const eagerEnvironment = createDevEnvironment('eager-audit', {});
assert.equal(eagerEnvironment.WITH_ROZENITE, 'false');
assert.equal(eagerEnvironment.RABBY_MOBILE_MODULE_LOADING_MODE, 'eager');

assert.equal(packageJson.scripts.start, 'node ./scripts/start-dev.cjs lean');
assert.equal(
  packageJson.scripts['start:dev:inspect'],
  'node ./scripts/start-dev.cjs inspect',
);
assert.equal(
  packageJson.scripts['start:dev:eager-audit'],
  'node ./scripts/start-dev.cjs eager-audit',
);

console.log('[dev] lean, inspect, and eager-audit profile contracts verified');
