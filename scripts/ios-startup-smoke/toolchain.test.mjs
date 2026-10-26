import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyToolchain } from './toolchain.mjs';

const developerDir = '/Applications/Xcode-27.1.0.app/Contents/Developer';

test('preflight reads the selected local Xcode and pins only child environment', () => {
  const env = { PATH: '/usr/bin:/bin' };
  const calls = [];
  const result = verifyToolchain('27.1', {
    platform: 'darwin',
    arch: 'arm64',
    env,
    execute(command, args, options) {
      calls.push([command, args]);
      assert.equal(options.timeout, 30000);
      if (command === '/usr/bin/xcode-select') {
        assert.deepEqual(args, ['-p']);
        return developerDir + '\n';
      }
      assert.equal(options.env.DEVELOPER_DIR, developerDir);
      if (command === '/usr/bin/xcodebuild') {
        assert.deepEqual(args, ['-version']);
        return 'Xcode 27.1\nBuild version 27A9275\n';
      }
      assert.equal(command, '/usr/bin/xcrun');
      assert.deepEqual(args, [
        '--sdk',
        'iphonesimulator',
        '--show-sdk-version',
      ]);
      return '27.1\n';
    },
  });
  assert.equal(result.developerDir, developerDir);
  assert.equal(result.version, '27.1');
  assert.equal(result.sdkVersion, '27.1');
  assert.equal(calls.length, 3);
  assert.equal(env.DEVELOPER_DIR, undefined);
});

test('explicit developer directory is respected; wrong version, host and process failures block', () => {
  const options = {
    platform: 'darwin',
    arch: 'arm64',
    env: { DEVELOPER_DIR: developerDir },
    execute(command) {
      assert.equal(command, '/usr/bin/xcodebuild');
      return 'Xcode 26.3\nBuild version 17C529';
    },
  };
  assert.throws(() => verifyToolchain('27.1', options), /Selected Xcode/);
  for (const override of [{ platform: 'linux' }, { arch: 'x64' }])
    assert.throws(
      () => verifyToolchain('27.1', { ...options, ...override }),
      /Apple Silicon/,
    );
  assert.throws(() => verifyToolchain('latest', options), /Unsupported/);
  const failure = new Error('toolchain unavailable');
  assert.throws(
    () =>
      verifyToolchain('27.1', {
        ...options,
        execute() {
          throw failure;
        },
      }),
    error => error === failure,
  );
});

test('build preflight requires the SDK companion runtime, not only a readable SDK version', () => {
  let inventory = [
    {
      version: '27.1',
      identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-27-1',
      isAvailable: true,
      buildversion: 'fixture',
    },
  ];
  const options = {
    platform: 'darwin',
    arch: 'arm64',
    env: { DEVELOPER_DIR: developerDir },
    requireBuildRuntime: true,
    execute(command, args, settings) {
      if (command === '/usr/bin/xcodebuild')
        return 'Xcode 27.1\nBuild version 27A9275';
      assert.equal(command, '/usr/bin/xcrun');
      if (args[0] === '--sdk') return '27.1';
      assert.deepEqual(args, ['simctl', 'list', 'runtimes', '--json']);
      assert.equal(settings.timeout, 120000);
      return JSON.stringify({ runtimes: inventory });
    },
  };
  assert.equal(verifyToolchain('27.1', options).buildRuntime.version, '27.1');
  inventory = [{ ...inventory[0], version: '27.0' }];
  assert.throws(
    () => verifyToolchain('27.1', options),
    /platform runtime is unavailable/,
  );
  inventory = [{ ...inventory[0], version: '27.1', isAvailable: false }];
  assert.throws(
    () => verifyToolchain('27.1', options),
    /platform runtime is unavailable/,
  );
});
