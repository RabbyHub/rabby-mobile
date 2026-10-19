#!/usr/bin/env node
/**
 * UIKit simulator integration, not a React Native App/E2E test.
 * Compiles this checkout's real legacy/Fabric font resolvers. Only RCTConvert
 * valid-input scalar conversions, logging, and SVG's font context are shims.
 * Never installs an App or changes a device's foreground application.
 *
 * Existing booted device:
 *   node scripts/test-ios-system-fonts-native.mjs --device <udid>
 * Explicit disposable-device lifecycle:
 *   node scripts/test-ios-system-fonts-native.mjs --create-simulator RabbySystemFontsTest-20261019
 * Compile only:
 *   node scripts/test-ios-system-fonts-native.mjs --compile-only
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  statfs,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const require = createRequire(path.join(mobileRoot, 'package.json'));
const fixtures = path.join(
  mobileRoot,
  'scripts/tests/fixtures/ios-system-fonts',
);
const args = process.argv.slice(2);
let existingDevice;
let createDeviceName;
let compileOnly = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--device') existingDevice = args[++i];
  else if (args[i] === '--create-simulator') createDeviceName = args[++i];
  else if (args[i] === '--compile-only') compileOnly = true;
  else throw new Error(`Unknown argument: ${args[i]}`);
}
assert(!(existingDevice && createDeviceName), 'Choose one simulator mode');
if (existingDevice) assert.match(existingDevice, /^[0-9A-F-]{36}$/i);
if (createDeviceName)
  assert.match(
    createDeviceName,
    /^RabbySystemFontsTest-[0-9]{8}(?:-[a-zA-Z0-9-]+)?$/,
  );
assert(
  process.platform === 'darwin' && process.arch === 'arm64',
  'Requires Apple Silicon macOS and Xcode',
);

function command(
  binary,
  commandArgs,
  { timeout = 60000, allowFailure = false } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, commandArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let exceeded = false;
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', data => {
      stdout += data;
      if (stdout.length > 4 * 1024 * 1024) {
        exceeded = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', data => {
      stderr += data;
      if (stderr.length > 4 * 1024 * 1024) {
        exceeded = true;
        child.kill('SIGKILL');
      }
    });
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (exceeded || signal || (code !== 0 && !allowFailure)) {
        reject(
          new Error(
            `${path.basename(binary)} ${commandArgs[0]} failed (${
              code ?? signal
            }): ${stderr.slice(-12000)}`,
          ),
        );
      } else resolve({ code, stdout, stderr });
    });
  });
}

const simctl = (...commandArgs) =>
  command('/usr/bin/xcrun', ['simctl', ...commandArgs]);
async function deviceList() {
  const response = await simctl('list', 'devices', '-j');
  return Object.entries(JSON.parse(response.stdout).devices).flatMap(
    ([runtime, devices]) => devices.map(device => ({ ...device, runtime })),
  );
}

async function main() {
  const reactNative = path.dirname(
    require.resolve('react-native/package.json'),
  );
  const reactNativeSvg = path.dirname(
    require.resolve('react-native-svg/package.json'),
  );
  const legacyPath = path.join(reactNative, 'React/Views/RCTFont.mm');
  const fabricRoot = path.join(
    reactNative,
    'ReactCommon/react/renderer/textlayoutmanager/platform/ios',
  );
  const fabricPath = path.join(
    fabricRoot,
    'react/renderer/textlayoutmanager/RCTFontUtils.mm',
  );
  const svgRoot = path.join(reactNativeSvg, 'apple/Text');
  const [legacy, fabric, glyph] = await Promise.all([
    readFile(legacyPath, 'utf8'),
    readFile(fabricPath, 'utf8'),
    readFile(path.join(svgRoot, 'RNSVGGlyphContext.mm'), 'utf8'),
  ]);
  assert(
    legacy.includes('UIFont *RCTFontWithSystemFontAlias('),
    "Install this checkout's RN patch before testing",
  );
  assert(
    fabric.includes('RCTFontWithSystemFontAlias('),
    'Fabric patch is missing',
  );
  const methodStart = glyph.indexOf('- (CTFontRef)getGlyphFont\n{');
  const methodEnd = glyph.indexOf('\n- (void)pushIndices', methodStart);
  assert(
    methodStart >= 0 && methodEnd > methodStart,
    'Review changed SVG method boundary before adapting this test',
  );
  const glyphMethod = glyph.slice(methodStart, methodEnd);
  const hashes = Object.fromEntries(
    Object.entries({ legacy, fabric, glyphMethod }).map(([key, source]) => [
      key,
      createHash('sha256').update(source).digest('hex'),
    ]),
  );

  const testDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'rabby-ios-system-fonts-'),
  );
  let ownedDevice;
  let report;
  try {
    const include = path.join(testDirectory, 'include');
    await mkdir(path.join(include, 'React'), { recursive: true });
    await symlink(
      path.join(reactNative, 'React/Views/RCTFont.h'),
      path.join(include, 'React/RCTFont.h'),
    );
    const svgHarness = path.join(testDirectory, 'SvgGlyphHarness.mm');
    await writeFile(
      svgHarness,
      `#import "SvgGlyphHarness.h"\n@implementation SvgGlyphHarness\n${glyphMethod}\n@end\n`,
    );
    const sdk = (
      await command('/usr/bin/xcrun', [
        '--sdk',
        'iphonesimulator',
        '--show-sdk-path',
      ])
    ).stdout.trim();
    const executable = path.join(testDirectory, 'font-harness');
    console.log(JSON.stringify({ phase: 'compile', sourceHashes: hashes }));
    await command('/usr/bin/xcrun', [
      '--sdk',
      'iphonesimulator',
      'clang++',
      '-fobjc-arc',
      '-std=c++20',
      '-target',
      'arm64-apple-ios15.1-simulator',
      '-isysroot',
      sdk,
      '-I',
      fixtures,
      '-I',
      include,
      '-I',
      fabricRoot,
      '-I',
      svgRoot,
      '-framework',
      'UIKit',
      '-framework',
      'Foundation',
      '-framework',
      'CoreText',
      legacyPath,
      fabricPath,
      path.join(fixtures, 'FontHarness.mm'),
      svgHarness,
      '-o',
      executable,
    ]);
    if (compileOnly) {
      console.log(
        JSON.stringify({ phase: 'compile-complete', sourceHashes: hashes }),
      );
      return;
    }

    let device;
    const devices = await deviceList();
    if (createDeviceName) {
      assert(
        !devices.some(item => item.name === createDeviceName),
        'Named simulator already exists; will not reuse or delete it',
      );
      const disk = await statfs(os.tmpdir());
      assert(
        disk.bavail * disk.bsize > 10 * 1024 ** 3,
        'Insufficient host disk for a disposable simulator',
      );
      const runtimes = JSON.parse(
        (await simctl('list', 'runtimes', '-j')).stdout,
      ).runtimes;
      const runtime = runtimes.find(
        item =>
          item.isAvailable &&
          item.platform === 'iOS' &&
          item.supportedArchitectures?.includes('arm64'),
      );
      assert(runtime, 'An installed arm64 iOS Simulator runtime is required');
      const deviceType = runtime.supportedDeviceTypes.find(
        item => item.productFamily === 'iPhone',
      );
      assert(deviceType, 'No compatible iPhone simulator type');
      const udid = (
        await simctl(
          'create',
          createDeviceName,
          deviceType.identifier,
          runtime.identifier,
        )
      ).stdout.trim();
      assert.match(udid, /^[0-9A-F-]{36}$/i);
      ownedDevice = {
        udid,
        name: createDeviceName,
        runtime: runtime.identifier,
      };
      console.log(
        JSON.stringify({ phase: 'owned-simulator-created', ...ownedDevice }),
      );
      await simctl('boot', udid);
      await command('/usr/bin/xcrun', ['simctl', 'bootstatus', udid, '-b'], {
        timeout: 180000,
      });
      device = (await deviceList()).find(item => item.udid === udid);
    } else {
      const booted = devices.filter(item => item.state === 'Booted');
      device = existingDevice
        ? booted.find(item => item.udid === existingDevice)
        : booted.length === 1
        ? booted[0]
        : null;
    }
    assert(
      device?.state === 'Booted',
      'Select one already-booted simulator, or explicitly authorize --create-simulator',
    );
    console.log(
      JSON.stringify({
        phase: 'execute',
        udid: device.udid,
        name: device.name,
        runtime: device.runtime,
      }),
    );
    const execution = await command(
      '/usr/bin/xcrun',
      ['simctl', 'spawn', device.udid, executable],
      { allowFailure: true },
    );
    const output = execution.stdout
      .split('\n')
      .find(line => line.startsWith('{') && line.includes('"tests"'));
    assert(
      output,
      `Native harness produced no report: ${execution.stderr.slice(-4000)}`,
    );
    report = JSON.parse(output);
    console.log(
      JSON.stringify(
        {
          ...report,
          sourceHashes: hashes,
          simulator: {
            udid: device.udid,
            name: device.name,
            runtime: device.runtime,
          },
        },
        null,
        2,
      ),
    );
    assert(
      execution.code === 0 && report.failed === 0,
      `Native font assertions failed: ${report.failed}`,
    );
  } finally {
    if (ownedDevice) {
      const current = (await deviceList()).find(
        item => item.udid === ownedDevice.udid,
      );
      assert(
        current?.name === ownedDevice.name &&
          current.runtime === ownedDevice.runtime,
        'Owned simulator identity changed; cleanup stopped',
      );
      if (current.state !== 'Shutdown')
        await simctl('shutdown', ownedDevice.udid);
      await simctl('delete', ownedDevice.udid);
      assert(
        !(await deviceList()).some(item => item.udid === ownedDevice.udid),
        'Owned simulator cleanup incomplete',
      );
      console.log(
        JSON.stringify({
          phase: 'owned-simulator-deleted',
          udid: ownedDevice.udid,
        }),
      );
    }
    assert(
      path.dirname(testDirectory) === path.resolve(os.tmpdir()) &&
        path.basename(testDirectory).startsWith('rabby-ios-system-fonts-'),
    );
    await rm(testDirectory, { recursive: true });
    console.log(JSON.stringify({ phase: 'temporary-harness-cleaned' }));
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
