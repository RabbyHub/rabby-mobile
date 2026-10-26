import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  findRuntime,
  installationArgs,
  installTimeoutMs,
  provisionRuntime,
  runCommand,
  supportedRuntimes,
} from './provision.mjs';

const runtime = (version, extra = {}) => ({
  version,
  identifier:
    'com.apple.CoreSimulator.SimRuntime.iOS-' + version.replaceAll('.', '-'),
  buildversion: 'test-build',
  isAvailable: true,
  ...extra,
});

async function fixture(t, inventories, installError) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'ios-runtime-provision-'),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const calls = [];
  let reads = 0;
  const dependencies = {
    platform: 'darwin',
    arch: 'arm64',
    env: { DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' },
    execute: async (executable, args, options) => {
      calls.push({ executable, args, options });
      if (executable === '/usr/bin/sw_vers') return 'macOS fixture';
      if (args[0] === '-version') return 'Xcode fixture';
      if (executable === '/usr/bin/xcrun') {
        assert.deepEqual(args, ['simctl', 'list', 'runtimes', '--json']);
        assert.equal(options.timeoutMs, 120000);
        return JSON.stringify({ runtimes: inventories[reads++] });
      }
      assert.equal(executable, '/usr/bin/xcodebuild');
      assert.equal(args[0], '-downloadPlatform');
      if (installError) throw installError;
      return 'Runtime installation completed';
    },
  };
  const output = path.join(root, 'output');
  return {
    root,
    output,
    dependencies,
    calls,
    read: name => fs.readFile(path.join(output, name), 'utf8').then(JSON.parse),
  };
}

test('only exact declared versions can select download commands', () => {
  assert.deepEqual(supportedRuntimes, ['16.4', '17.5', '18.5', '26.2', '27.0']);
  for (const version of ['16.4', '17.5', '18.5'])
    assert.deepEqual(installationArgs(version), [
      '-downloadPlatform',
      'iOS',
      '-buildVersion',
      version,
    ]);
  for (const version of ['26.2', '27.0'])
    assert.deepEqual(installationArgs(version), [
      '-downloadPlatform',
      'iOS',
      '-buildVersion',
      version,
      '-architectureVariant',
      'arm64',
    ]);
  for (const version of [
    undefined,
    '',
    '16',
    '16.4.0',
    'latest',
    '19.0',
    '27.1',
    '16.4;id',
  ])
    assert.throws(() => installationArgs(version));
});

test('runtime verification requires exact version, iOS identifier and availability', () => {
  assert(findRuntime({ runtimes: [runtime('16.4')] }, '16.4'));
  for (const entry of [
    runtime('16.4.0'),
    runtime('16.4', { isAvailable: false }),
    runtime('16.4', {
      identifier: 'com.apple.CoreSimulator.SimRuntime.tvOS-16-4',
    }),
  ])
    assert.equal(findRuntime({ runtimes: [entry] }, '16.4'), undefined);
  assert.throws(() => findRuntime({}, '16.4'), /invalid runtime inventory/);
});

test('missing runtime is installed once then verified, preserving before/after evidence', async t => {
  const f = await fixture(t, [[], [runtime('16.4')]]);
  const result = await provisionRuntime(
    { runtime: '16.4', output: f.output },
    f.dependencies,
  );
  assert.equal(result.status, 'installed');
  assert.deepEqual((await f.read('before.json')).runtimes, []);
  assert.equal((await f.read('after.json')).runtimes[0].version, '16.4');
  const install = f.calls.filter(call => call.args[0] === '-downloadPlatform');
  assert.equal(install.length, 1);
  assert.deepEqual(install[0].args, installationArgs('16.4'));
  assert.equal(install[0].options.timeoutMs, installTimeoutMs);
  assert.equal(install[0].options.echo, true);
  const metadata = await f.read('metadata.json');
  assert.equal(metadata.status, 'installed');
  assert.equal(metadata.host.description, 'macOS fixture');
  assert.equal(metadata.xcode, 'Xcode fixture');
  assert.equal(metadata.runtime.isAvailable, true);
});

test('an available exact runtime is reused without downloading', async t => {
  const f = await fixture(t, [[runtime('17.5')], [runtime('17.5')]]);
  const result = await provisionRuntime(
    { runtime: '17.5', output: f.output },
    f.dependencies,
  );
  assert.equal(result.status, 'reused');
  assert.equal(result.installAttempted, false);
  assert(!f.calls.some(call => call.args[0] === '-downloadPlatform'));
  assert.equal((await f.read('after.json')).runtimes[0].version, '17.5');
});

test('a reused runtime disappearing before verification is a failure', async t => {
  const f = await fixture(t, [[runtime('17.5')], []]);
  await assert.rejects(
    provisionRuntime({ runtime: '17.5', output: f.output }, f.dependencies),
    /still missing or unavailable/,
  );
  assert.equal((await f.read('metadata.json')).status, 'failed');
  assert(!f.calls.some(call => call.args[0] === '-downloadPlatform'));
});

test('download success with missing, different or unavailable runtime still fails', async t => {
  for (const after of [
    [],
    [runtime('18.4')],
    [runtime('18.5', { isAvailable: false })],
  ]) {
    const f = await fixture(t, [[], after]);
    await assert.rejects(
      provisionRuntime({ runtime: '18.5', output: f.output }, f.dependencies),
      /still missing or unavailable/,
    );
    assert.equal((await f.read('metadata.json')).status, 'failed');
  }
});

test('failed download never becomes a pass even if the post-install inventory matches', async t => {
  const f = await fixture(
    t,
    [[], [runtime('26.2')]],
    new Error('download failed'),
  );
  await assert.rejects(
    provisionRuntime({ runtime: '26.2', output: f.output }, f.dependencies),
    /download failed/,
  );
  assert.equal((await f.read('after.json')).runtimes[0].version, '26.2');
  const result = await f.read('metadata.json');
  assert.equal(result.status, 'failed');
  assert.equal(result.stage, 'install');
});

test('cancellation does not launch a subsequent inventory subprocess', async t => {
  const f = await fixture(
    t,
    [[]],
    Object.assign(new Error('cancelled'), { code: 'PROVISION_CANCELLED' }),
  );
  await assert.rejects(
    provisionRuntime({ runtime: '26.2', output: f.output }, f.dependencies),
    /cancelled/,
  );
  assert.equal(
    f.calls.filter(call => call.executable === '/usr/bin/xcrun').length,
    1,
  );
  assert.equal((await f.read('metadata.json')).status, 'failed');
});

test('rejects wrong host, missing Xcode selection, existing output and arbitrary runtime before download', async t => {
  const f = await fixture(t, []);
  for (const override of [{ platform: 'linux' }, { arch: 'x64' }, { env: {} }])
    await assert.rejects(
      provisionRuntime(
        { runtime: '16.4', output: f.output },
        { ...f.dependencies, ...override },
      ),
    );
  await assert.rejects(
    provisionRuntime({ runtime: 'latest', output: f.output }, f.dependencies),
  );
  await assert.rejects(
    provisionRuntime({ runtime: '16.4', output: 'relative' }, f.dependencies),
  );
  await fs.mkdir(f.output);
  await assert.rejects(
    provisionRuntime({ runtime: '16.4', output: f.output }, f.dependencies),
    /EEXIST/,
  );
  assert.equal(f.calls.length, 0);
});

test('real subprocess has closed stdin, logs output and surfaces nonzero exit', async t => {
  const f = await fixture(t, []);
  const logfile = path.join(f.root, 'process.log');
  const options = { env: process.env, logfile, timeoutMs: 3000 };
  const value = await runCommand(
    process.execPath,
    [
      '-e',
      "process.stdin.resume(); process.stdin.on('end', () => { console.log('stdin-closed'); console.error('stderr-recorded'); });",
    ],
    options,
  );
  assert.equal(value, 'stdin-closed');
  assert.match(await fs.readFile(logfile, 'utf8'), /stderr-recorded/);
  await assert.rejects(
    runCommand(process.execPath, ['-e', 'process.exit(7)'], options),
    /failed \(7\)/,
  );
});

test('real subprocess timeout is bounded and reports failure', async t => {
  const f = await fixture(t, []);
  await assert.rejects(
    runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      env: process.env,
      logfile: path.join(f.root, 'timeout.log'),
      timeoutMs: 100,
    }),
    /timed out/,
  );
});
