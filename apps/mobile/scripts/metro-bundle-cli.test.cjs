// Process-boundary tests with a synthetic delegate; no Metro/native build or
// real .env/.xcode.env.local files, credentials, network or app startup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const wrapper = path.join(__dirname, 'metro-bundle-cli.js');
const publicInputs = {
  RABBY_MOBILE_KR_PWD: 'RABBY_SIMULATOR_SMOKE_PASSWORD',
  RABBY_MOBILE_CODE: 'RABBY_SIMULATOR_SMOKE_CODE',
  RABBY_MOBILE_SAFE_API_KEY: 'RABBY_SIMULATOR_SMOKE_SAFE_API_KEY',
};
const syntheticInputs = {
  RABBY_MOBILE_KR_PWD: 'synthetic-retained-password',
  RABBY_MOBILE_CODE: 'synthetic-retained-code',
  RABBY_MOBILE_SAFE_API_KEY: 'synthetic-retained-safe-key',
};

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-metro-inputs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const trace = path.join(root, 'delegate.json');
  const receipt = path.join(root, 'metro-inputs.json');
  const delegate = path.join(root, 'delegate.cjs');
  fs.writeFileSync(
    delegate,
    `
const fs = require('node:fs');
fs.writeFileSync(process.env.TEST_TRACE, JSON.stringify({
  args: process.argv.slice(2),
  env: Object.fromEntries(${JSON.stringify(
    Object.keys(publicInputs),
  )}.map(key => [key, process.env[key]])),
  receiptExisted: fs.existsSync(process.env.RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT || ''),
}));
if (process.env.TEST_SIGNAL) process.kill(process.pid, 'SIGTERM');
else process.exit(Number(process.env.TEST_EXIT || 0));
`,
  );
  const env = {
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
    TEST_TRACE: trace,
    RABBY_MOBILE_METRO_CLI_DELEGATE: delegate,
    RABBY_MOBILE_SIMULATOR_BUILD_INPUT_PROFILE: 'simulator-smoke-v1',
    RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT: receipt,
    PLATFORM_NAME: 'iphonesimulator',
    CONFIGURATION: 'Regression',
    ...syntheticInputs,
  };
  const run = (overrides = {}) =>
    spawnSync(process.execPath, [wrapper, 'bundle', '--reset-cache'], {
      cwd: root,
      env: { ...env, ...overrides },
      encoding: 'utf8',
    });
  return { root, trace, receipt, env, run };
}

test('Simulator final entry overwrites retained inputs before the delegate and then records success', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const delegated = JSON.parse(fs.readFileSync(f.trace, 'utf8'));
  assert.deepEqual(delegated.env, publicInputs);
  assert.deepEqual(delegated.args, ['bundle', '--reset-cache']);
  assert.equal(delegated.receiptExisted, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.receipt, 'utf8')), {
    buildInputProfile: 'simulator-smoke-v1',
  });
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-retained/);
});

const posixTest = process.platform === 'win32' ? test.skip : test;
posixTest(
  'sourced synthetic Xcode environment cannot substitute production-like values',
  t => {
    const f = fixture(t);
    const syntheticEnvironment = path.join(f.root, 'synthetic-xcode-env.sh');
    fs.writeFileSync(
      syntheticEnvironment,
      Object.entries(syntheticInputs)
        .map(([key, value]) => `export ${key}=${value}`)
        .join('\n') + '\n',
    );
    const result = spawnSync(
      '/bin/bash',
      [
        '--noprofile',
        '--norc',
        '-c',
        '. "$1"; exec "$2" "$3" bundle --reset-cache',
        'synthetic-xcode-shell',
        syntheticEnvironment,
        process.execPath,
        wrapper,
      ],
      { cwd: f.root, env: { ...f.env, ...publicInputs }, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(f.trace, 'utf8')).env,
      publicInputs,
    );
    assert.equal(fs.existsSync(f.receipt), true);
  },
);

test('ordinary non-Simulator calls retain their inputs and cache flag behavior without a receipt', t => {
  const f = fixture(t);
  const result = f.run({
    RABBY_MOBILE_SIMULATOR_BUILD_INPUT_PROFILE: '',
    PLATFORM_NAME: 'iphoneos',
    CONFIGURATION: 'Release',
    RABBY_MOBILE_METRO_USE_CACHE: 'true',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const delegated = JSON.parse(fs.readFileSync(f.trace, 'utf8'));
  assert.deepEqual(delegated.env, syntheticInputs);
  assert.deepEqual(delegated.args, ['bundle']);
  assert.equal(fs.existsSync(f.receipt), false);
});

for (const [name, overrides] of [
  ['device platform', { PLATFORM_NAME: 'iphoneos' }],
  ['Release configuration', { CONFIGURATION: 'Release' }],
  [
    'unknown profile',
    { RABBY_MOBILE_SIMULATOR_BUILD_INPUT_PROFILE: 'unexpected' },
  ],
  ['missing receipt path', { RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT: '' }],
  [
    'relative receipt path',
    { RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT: 'receipt.json' },
  ],
]) {
  test(`Simulator profile rejects ${name} before executing the delegate`, t => {
    const f = fixture(t);
    const result = f.run(overrides);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid Simulator bundle input context/);
    assert.equal(fs.existsSync(f.trace), false);
    assert.equal(fs.existsSync(f.receipt), false);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-retained/);
  });
}

for (const [name, overrides, status] of [
  ['failure', { TEST_EXIT: '42' }, 42],
  ['signal', { TEST_SIGNAL: '1' }, 1],
]) {
  test(`delegate ${name} does not publish a Simulator receipt`, t => {
    const f = fixture(t);
    const result = f.run(overrides);
    assert.equal(result.status, status);
    assert.equal(fs.existsSync(f.trace), true);
    assert.equal(fs.existsSync(f.receipt), false);
  });
}

test('an existing receipt is never reused or replaced', t => {
  const f = fixture(t);
  fs.writeFileSync(f.receipt, 'previous receipt\n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(f.trace), false);
  assert.equal(fs.readFileSync(f.receipt, 'utf8'), 'previous receipt\n');
});

test('receipt publication failure fails the wrapper after delegate success', t => {
  const f = fixture(t);
  const result = f.run({
    RABBY_MOBILE_SIMULATOR_BUNDLE_RECEIPT: path.join(
      f.root,
      'missing',
      'receipt.json',
    ),
  });
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(f.trace), true);
  assert.equal(fs.existsSync(f.receipt), false);
  assert.match(result.stderr, /Could not write Simulator bundle receipt/);
});

test('the Metro cache fingerprint includes every public build input', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../metro.config.js'),
    'utf8',
  );
  const keys = source.match(
    /const babelTransformEnvironmentKeys = \[([\s\S]*?)\];/,
  )?.[1];
  assert.ok(keys);
  for (const key of Object.keys(publicInputs))
    assert.equal(keys.split(`'${key}'`).length - 1, 1);
  assert.match(
    source,
    /for \(const environmentKey of babelTransformEnvironmentKeys\) \{[\s\S]*?babelTransformCacheHash\.update\(process\.env\[environmentKey\] \|\| ''\)/,
  );
  assert.match(source, /cacheVersion:.*babelTransformCacheVersion/);
});
