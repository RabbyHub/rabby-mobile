import assert from 'node:assert/strict';
import test from 'node:test';
import { findXcode, testXcodeVersion, verifyToolchain } from './toolchain.mjs';

const developerDir = '/Applications/Xcode-27.1.0.app/Contents/Developer';

test('only local iOS16 requires the legacy test toolchain; hosted policy stays explicit', () => {
  const majors = [16, 17, 18, 26, 27];
  assert.deepEqual(
    majors.map(major => testXcodeVersion(major)),
    ['26.3', '27.1', '27.1', '27.1', '27.1'],
  );
  assert.deepEqual(
    majors.map(major => testXcodeVersion(major, 'hosted')),
    ['26.3', '26.3', '26.3', '26.3', '27.1'],
  );
  assert.throws(() => testXcodeVersion(16, 'auto'), /explicitly/);
});

test('installed test selection overrides only child DEVELOPER_DIR, not the selected global Xcode', async () => {
  const env = { DEVELOPER_DIR: developerDir, PATH: '/usr/bin:/bin' };
  const legacyDir = '/Applications/Xcode-26.3.0.app/Contents/Developer';
  const calls = [];
  const selected = await findXcode('26.3', {
    platform: 'darwin',
    arch: 'arm64',
    env,
    async readDirectory(directory) {
      assert.equal(directory, '/Applications');
      return ['Notes.app', 'Xcode-27.1.0.app', 'Xcode-26.3.0.app'];
    },
    execute(command, args, settings) {
      calls.push([command, args, settings.env.DEVELOPER_DIR]);
      assert.equal(settings.timeout, 30000);
      if (command === '/usr/bin/xcodebuild') {
        assert.deepEqual(args, ['-version']);
        return settings.env.DEVELOPER_DIR === legacyDir
          ? 'Xcode 26.3\nBuild version 17C529'
          : 'Xcode 27.1\nBuild version 27A9275';
      }
      assert.equal(command, '/usr/bin/xcrun');
      assert.deepEqual(args, [
        '--sdk',
        'iphonesimulator',
        '--show-sdk-version',
      ]);
      assert.equal(settings.env.DEVELOPER_DIR, legacyDir);
      return '26.2';
    },
  });
  assert.equal(selected.developerDir, legacyDir);
  assert.equal(selected.version, '26.3');
  assert.equal(env.DEVELOPER_DIR, developerDir);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(([command]) => command !== '/usr/bin/xcode-select'));
});

test('missing Xcode26.3 fails explicitly while iOS17+ can still select installed27.1', async () => {
  const options = {
    platform: 'darwin',
    arch: 'arm64',
    env: { DEVELOPER_DIR: developerDir },
    readDirectory: async () => ['Xcode-27.1.0.app'],
    execute(command, args, settings) {
      assert.equal(settings.env.DEVELOPER_DIR, developerDir);
      if (command === '/usr/bin/xcodebuild')
        return 'Xcode 27.1\nBuild version 27A9275';
      assert.equal(command, '/usr/bin/xcrun');
      return '27.1';
    },
  };
  await assert.rejects(
    findXcode(testXcodeVersion(16), options),
    /Xcode 26\.3 is not installed or usable.*provision it explicitly/,
  );
  assert.equal(
    (await findXcode(testXcodeVersion(17), options)).version,
    '27.1',
  );
});

test('an incomplete Xcode26.3 installation cannot fall back to Xcode27.1', async () => {
  await assert.rejects(
    findXcode('26.3', {
      platform: 'darwin',
      arch: 'arm64',
      env: { DEVELOPER_DIR: developerDir },
      readDirectory: async () => ['Xcode-26.3.0.app', 'Xcode-27.1.0.app'],
      execute(command, args, settings) {
        if (command === '/usr/bin/xcodebuild')
          return settings.env.DEVELOPER_DIR.includes('26.3')
            ? 'Xcode 26.3'
            : 'Xcode 27.1';
        throw new Error('Simulator SDK is missing');
      },
    }),
    /Xcode 26\.3 is not installed or usable/,
  );
});

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
