#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
export const requiredMajors = [16, 17, 18, 26, 27];
const bundleId = 'com.debank.rabby-mobile-regression';
const versionParts = version => version.split('.').map(Number);
const commitPattern = /^[a-f0-9]{40}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;

function validateSourceMetadata(metadata) {
  const provenance = metadata?.sourceProvenance;
  if (
    metadata?.schemaVersion !== 2 ||
    !commitPattern.test(metadata.sourceCommit) ||
    typeof metadata.xcode !== 'string' ||
    !metadata.xcode.trim() ||
    !['clean', 'modified'].includes(provenance?.status) ||
    !commitPattern.test(provenance.headCommit) ||
    !Array.isArray(provenance.changedFiles) ||
    provenance.changedFiles.some(file => typeof file !== 'string' || !file)
  ) {
    throw new Error('Expected schema 2 build metadata with source provenance');
  }
  const clean =
    provenance.headCommit === metadata.sourceCommit &&
    provenance.changedFiles.length === 0;
  if ((provenance.status === 'clean') !== clean)
    throw new Error('Build source provenance status contradicts its changes');
}

export function createSourceBinding({
  harnessCommit,
  metadata,
  metadataSha256,
  probe = false,
}) {
  if (!commitPattern.test(harnessCommit))
    throw new Error('Invalid harness checkout commit');
  if (probe && !metadata) throw new Error('--probe requires --build-metadata');
  if (metadata) {
    validateSourceMetadata(metadata);
    if (!sha256Pattern.test(metadataSha256))
      throw new Error('Build metadata receipt SHA-256 is required');
    if (!probe && metadata.sourceCommit !== harnessCommit)
      throw new Error('Build metadata does not match this checkout');
    if (!probe && metadata.sourceProvenance.status !== 'clean')
      throw new Error('Qualification requires clean build source provenance');
  }
  return {
    mode: probe ? 'probe' : 'qualification',
    sourceCommit: metadata?.sourceCommit || harnessCommit,
    harnessCommit,
    buildMetadataSha256: metadata ? metadataSha256 : null,
    evidenceScope: probe ? 'diagnostic-only' : 'source-qualification',
  };
}

export function validateTestBinding({
  selected,
  harnessCommit,
  metadata,
  metadataSha256,
  probe = false,
}) {
  if (selected.mode !== (probe ? 'probe' : 'qualification'))
    throw new Error('--probe must match the runtime plan mode');
  if (selected.harnessCommit !== harnessCommit)
    throw new Error('Harness checkout changed since preflight');
  if (!metadata)
    throw new Error('Build metadata receipt is required for testing');
  const binding = createSourceBinding({
    harnessCommit,
    metadata,
    metadataSha256,
    probe,
  });
  if (
    selected.sourceCommit !== binding.sourceCommit ||
    selected.commit !== binding.sourceCommit ||
    selected.evidenceScope !== binding.evidenceScope ||
    (probe && !selected.buildMetadataSha256) ||
    (selected.buildMetadataSha256 !== null &&
      selected.buildMetadataSha256 !== metadataSha256)
  ) {
    throw new Error('Build receipt does not match the runtime plan binding');
  }
  return binding;
}

export function validateBuildReceipt({
  metadata,
  sourceCommit,
  appHash,
  jsHash,
}) {
  if (
    metadata.sourceCommit !== sourceCommit ||
    metadata.platform !== 'iphonesimulator' ||
    metadata.configuration !== 'Regression' ||
    !sha256Pattern.test(appHash) ||
    !sha256Pattern.test(jsHash) ||
    metadata.executableSha256 !== appHash ||
    metadata.jsBundleSha256 !== jsHash
  ) {
    throw new Error(
      'Build receipt does not match the selected source/app/JS bundle',
    );
  }
}

export function compareVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return delta;
  }
  return 0;
}

export function parseMajors(value) {
  const values = value.split(',');
  if (values.some(item => !/^[0-9]+$/.test(item))) {
    throw new Error('iOS majors must be comma-separated integers');
  }
  const majors = values.map(Number);
  if (
    new Set(majors).size !== majors.length ||
    majors.some(major => !requiredMajors.includes(major))
  ) {
    throw new Error('Choose unique supported iOS majors from 16,17,18,26,27');
  }
  return majors.sort((a, b) => a - b);
}

export function selectRuntimes(runtimes, majors, exactVersion) {
  return majors.map(major => {
    const candidates = runtimes
      .filter(
        runtime =>
          runtime.isAvailable === true &&
          runtime.identifier?.startsWith(
            'com.apple.CoreSimulator.SimRuntime.iOS-',
          ) &&
          /^\d+(\.\d+)*$/.test(runtime.version) &&
          (!exactVersion || runtime.version === exactVersion) &&
          Number(runtime.version.split('.')[0]) === major,
      )
      .sort((a, b) => compareVersions(b.version, a.version));
    if (!candidates.length)
      throw new Error(
        `Required iOS ${major} runtime is missing or unavailable`,
      );
    const runtime = candidates[0];
    const iphones = (runtime.supportedDeviceTypes || [])
      .filter(device => device.productFamily === 'iPhone')
      .sort((a, b) => a.identifier.localeCompare(b.identifier));
    const device =
      iphones.find(item => item.identifier.endsWith('.iPhone-13-mini')) ||
      iphones[0];
    if (!device)
      throw new Error(
        `iOS ${runtime.version} has no supported iPhone device type`,
      );
    return {
      major,
      version: runtime.version,
      build: runtime.buildversion,
      identifier: runtime.identifier,
      deviceType: device.identifier,
      // Keep old OS testing independent of the SDK used to compile the app.
      testXcodeVersion: major >= 27 ? '27.1' : '26.3',
    };
  });
}

function read(command, args, env = process.env) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    env,
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}

export function readRuntimeInventory(env, execute = execFileSync) {
  // Use the same independent inventory budget as provision.mjs. This does
  // not extend simulator boot, App launch or XCTest execution deadlines.
  return JSON.parse(
    execute('/usr/bin/xcrun', ['simctl', 'list', 'runtimes', '--json'], {
      encoding: 'utf8',
      env,
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
}

async function findXcode(version) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version))
    throw new Error('Invalid Xcode version');
  const found = [];
  for (const entry of await fs.readdir('/Applications')) {
    if (!/^Xcode.*\.app$/.test(entry)) continue;
    const developerDir = path.join(
      '/Applications',
      entry,
      'Contents/Developer',
    );
    try {
      const description = read(
        path.join(developerDir, 'usr/bin/xcodebuild'),
        ['-version'],
        { ...process.env, DEVELOPER_DIR: developerDir },
      );
      const actual = /^Xcode (\d+\.\d+(?:\.\d+)?)/.exec(description)?.[1];
      if (actual === version || actual?.startsWith(version + '.'))
        found.push({ developerDir, version: actual, description });
    } catch {
      // An incomplete/uninstalled Xcode is not a usable candidate.
    }
  }
  found.sort(
    (a, b) =>
      compareVersions(b.version, a.version) ||
      a.developerDir.localeCompare(b.developerDir),
  );
  if (!found.length)
    throw new Error(`Xcode ${version} is not installed under /Applications`);
  return found[0];
}

async function writeJSON(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

async function plan(options) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw new Error('Requires an Apple Silicon macOS runner');
  const output = path.resolve(options.output);
  await fs.mkdir(output, { recursive: false });
  try {
    const majors = parseMajors(options.majors || requiredMajors.join(','));
    const harnessCommit = read('git', ['rev-parse', 'HEAD']);
    // A hosted test job consumes the app receipt, not the build machine's
    // absolute Xcode path. Only its own UI-test toolchain must be installed.
    const metadataBytes = options['build-metadata']
      ? await fs.readFile(options['build-metadata'])
      : undefined;
    const metadata = metadataBytes ? JSON.parse(metadataBytes) : undefined;
    const binding = createSourceBinding({
      harnessCommit,
      metadata,
      metadataSha256: metadataBytes
        ? createHash('sha256').update(metadataBytes).digest('hex')
        : undefined,
      probe: options.probe,
    });
    const build = metadata
      ? { description: metadata.xcode }
      : await findXcode(options['build-xcode'] || '26.3');
    const runtimes = [];
    for (const major of majors) {
      const testXcode = await findXcode(major >= 27 ? '27.1' : '26.3');
      const inventory = readRuntimeInventory({
        ...process.env,
        DEVELOPER_DIR: testXcode.developerDir,
      });
      const [runtime] = selectRuntimes(
        inventory.runtimes,
        [major],
        options['runtime-version'],
      );
      runtimes.push({ ...runtime, testXcode });
    }
    const result = {
      schemaVersion: 1,
      ...binding,
      commit: binding.sourceCommit,
      qualificationPassed: false,
      requestedMajors: majors,
      fullCoverage: majors.join(',') === requiredMajors.join(','),
      buildXcode: build,
      runtimes,
    };
    await writeJSON(path.join(output, 'plan.json'), result);
    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_ENV && build.developerDir) {
      await fs.appendFile(
        process.env.GITHUB_ENV,
        `DEVELOPER_DIR=${build.developerDir}\n`,
      );
    }
  } catch (error) {
    await writeJSON(path.join(output, 'preflight-failure.json'), {
      status: 'infrastructure-failed',
      message: error.message,
    });
    throw error;
  }
}

let cancelled = false;
let stopCurrent;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cancelled = true;
    stopCurrent?.();
  });
}

async function command(executable, args, env, logfile, timeout = 180000) {
  if (cancelled) throw new Error('Run cancelled');
  const log = createWriteStream(logfile, { flags: 'a' });
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let expired = false;
    let escalation;
    const stop = () => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
      escalation ||= setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }, 5000);
    };
    stopCurrent = stop;
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    const timer = setTimeout(() => {
      expired = true;
      stop();
    }, timeout);
    let spawnError;
    child.on('error', error => {
      spawnError = error;
    });
    child.on('close', code => {
      clearTimeout(timer);
      clearTimeout(escalation);
      stopCurrent = undefined;
      log.end(() => {
        if (spawnError) reject(spawnError);
        else if (expired || cancelled || code !== 0)
          reject(
            new Error(
              `${path.basename(executable)} ${args[0]} failed (${
                expired ? 'timeout' : cancelled ? 'cancelled' : code
              }); see ${path.basename(logfile)}`,
            ),
          );
        else resolve();
      });
    });
  });
}

async function test(options) {
  const output = path.resolve(options.output);
  await fs.mkdir(output, { recursive: false });
  const selected = JSON.parse(await fs.readFile(options.plan, 'utf8'));
  if (selected.schemaVersion !== 1 || !selected.runtimes?.length)
    throw new Error('Invalid runtime plan');
  const metadataBytes = await fs.readFile(options.metadata);
  const metadata = JSON.parse(metadataBytes);
  const binding = validateTestBinding({
    selected,
    harnessCommit: read('git', ['rev-parse', 'HEAD']),
    metadata,
    metadataSha256: createHash('sha256').update(metadataBytes).digest('hex'),
    probe: options.probe,
  });
  if (binding.mode === 'probe')
    console.log(
      'Diagnostic-only artifact probe: qualificationPassed=false; this does not validate the current checkout source.',
    );
  const app = await fs.realpath(options.app);
  if (
    read('/usr/libexec/PlistBuddy', [
      '-c',
      'Print :CFBundleIdentifier',
      path.join(app, 'Info.plist'),
    ]) !== bundleId
  ) {
    throw new Error('Expected the Regression simulator bundle');
  }
  const binaryName = read('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleExecutable',
    path.join(app, 'Info.plist'),
  ]);
  if (path.basename(binaryName) !== binaryName)
    throw new Error('Invalid executable name');
  const binary = path.join(app, binaryName);
  const appHash = read('/usr/bin/shasum', ['-a', '256', binary]).split(' ')[0];
  const jsHash = createHash('sha256')
    .update(await fs.readFile(path.join(app, 'main.jsbundle')))
    .digest('hex');
  validateBuildReceipt({
    metadata,
    sourceCommit: binding.sourceCommit,
    appHash,
    jsHash,
  });
  const buildEnv = {
    ...process.env,
    DEVELOPER_DIR: selected.runtimes[0].testXcode.developerDir,
  };
  if (
    !/platform IOSSIMULATOR\b/.test(
      read('/usr/bin/xcrun', ['vtool', '-show-build', binary], buildEnv),
    )
  ) {
    throw new Error('Expected an iOS Simulator build, not an iPhoneOS IPA');
  }
  const harnesses = new Map();
  const results = [];
  for (const runtime of selected.runtimes) {
    if (cancelled) break;
    const evidence = path.join(output, `ios-${runtime.major}`);
    await fs.mkdir(evidence);
    const env = {
      ...process.env,
      DEVELOPER_DIR: runtime.testXcode.developerDir,
    };
    const result = {
      ...runtime,
      ...binding,
      status: 'infrastructure-failed',
      qualificationPassed: false,
    };
    let udid;
    let testStarted = false;
    try {
      let xctestrun = harnesses.get(env.DEVELOPER_DIR);
      if (!xctestrun) {
        const derivedData = path.join(
          output,
          `runner-xcode-${runtime.testXcode.version}`,
        );
        await command(
          '/usr/bin/xcodebuild',
          [
            'build-for-testing',
            '-project',
            path.join(here, 'uitests/StartupSmoke.xcodeproj'),
            '-scheme',
            'StartupSmoke',
            '-configuration',
            'Debug',
            '-sdk',
            'iphonesimulator',
            '-destination',
            'generic/platform=iOS Simulator',
            '-derivedDataPath',
            derivedData,
            '-hideShellScriptEnvironment',
            'ARCHS=arm64',
            'CODE_SIGNING_ALLOWED=NO',
          ],
          env,
          path.join(evidence, 'runner-build.log'),
          300000,
        );
        const products = path.join(derivedData, 'Build/Products');
        const files = (await fs.readdir(products)).filter(file =>
          file.endsWith('.xctestrun'),
        );
        if (files.length !== 1)
          throw new Error('Expected exactly one UI runner xctestrun');
        xctestrun = path.join(products, files[0]);
        harnesses.set(env.DEVELOPER_DIR, xctestrun);
      }
      const name = 'RabbyStartup-' + randomUUID();
      udid = read(
        '/usr/bin/xcrun',
        ['simctl', 'create', name, runtime.deviceType, runtime.identifier],
        env,
      );
      if (!/^[A-F0-9-]{36}$/i.test(udid)) {
        udid = undefined;
        throw new Error('simctl returned an invalid device id');
      }
      result.udid = udid;
      await writeJSON(path.join(evidence, 'owned-device.json'), {
        udid,
        name,
        runtime: runtime.identifier,
      });
      await command(
        '/usr/bin/xcrun',
        ['simctl', 'bootstatus', udid, '-b'],
        env,
        path.join(evidence, 'boot.log'),
        240000,
      );
      await command(
        '/usr/bin/xcrun',
        ['simctl', 'install', udid, app],
        env,
        path.join(evidence, 'install.log'),
      );
      testStarted = true;
      await command(
        '/usr/bin/xcodebuild',
        [
          'test-without-building',
          '-xctestrun',
          xctestrun,
          '-destination',
          `platform=iOS Simulator,id=${udid},arch=arm64`,
          '-resultBundlePath',
          path.join(evidence, 'startup.xcresult'),
          '-parallel-testing-enabled',
          'NO',
          '-test-timeouts-enabled',
          'YES',
          '-default-test-execution-time-allowance',
          '240',
          '-maximum-test-execution-time-allowance',
          '240',
        ],
        env,
        path.join(evidence, 'startup-test.log'),
        360000,
      );
      const summary = JSON.parse(
        read(
          '/usr/bin/xcrun',
          [
            'xcresulttool',
            'get',
            'test-results',
            'summary',
            '--path',
            path.join(evidence, 'startup.xcresult'),
          ],
          env,
        ),
      );
      await writeJSON(path.join(evidence, 'test-summary.json'), summary);
      if (
        summary.passedTests !== 1 ||
        summary.failedTests !== 0 ||
        summary.skippedTests !== 0
      ) {
        throw new Error(
          'Expected one executed, passed startup test with no skipped tests',
        );
      }
      result.status = 'passed';
    } catch (error) {
      result.status = cancelled
        ? 'cancelled'
        : testStarted
        ? 'startup-or-test-runner-failed'
        : 'infrastructure-failed';
      result.message = error.message;
    } finally {
      const resultBundle = path.join(evidence, 'startup.xcresult');
      try {
        const summary = JSON.parse(
          read(
            '/usr/bin/xcrun',
            [
              'xcresulttool',
              'get',
              'test-results',
              'summary',
              '--path',
              resultBundle,
            ],
            env,
          ),
        );
        await writeJSON(path.join(evidence, 'test-summary.json'), summary);
      } catch {}
      if (udid) {
        // Only the simulator created by this invocation; never erase/shutdown all.
        try {
          const logs = read(
            '/usr/bin/xcrun',
            [
              'simctl',
              'spawn',
              udid,
              'log',
              'show',
              '--last',
              '10m',
              '--style',
              'compact',
              '--predicate',
              'process == "RabbyMobile"',
            ],
            env,
          );
          await fs.writeFile(path.join(evidence, 'app-system.log'), logs);
        } catch {}
        try {
          read(
            '/usr/bin/xcrun',
            [
              'simctl',
              'io',
              udid,
              'screenshot',
              path.join(evidence, 'last-screen.png'),
            ],
            env,
          );
        } catch {}
        try {
          read('/usr/bin/xcrun', ['simctl', 'shutdown', udid], env);
        } catch {}
        try {
          read('/usr/bin/xcrun', ['simctl', 'delete', udid], env);
        } catch {
          result.cleanupFailed = true;
          result.status = 'infrastructure-failed';
        }
      }
      result.qualificationPassed =
        binding.mode === 'qualification' && result.status === 'passed';
      results.push(result);
      await writeJSON(path.join(evidence, 'result.json'), result);
      console.log(`iOS ${runtime.version}: ${result.status}`);
    }
  }
  const passed =
    !cancelled &&
    results.length === selected.runtimes.length &&
    results.every(result => result.status === 'passed');
  await writeJSON(path.join(output, 'results.json'), {
    ...binding,
    commit: selected.commit,
    appHash,
    jsHash,
    buildMetadata: metadata,
    fullCoverage: selected.fullCoverage,
    passed,
    qualificationPassed: binding.mode === 'qualification' && passed,
    results,
  });
  const markdown = [
    '# iOS Simulator startup',
    '',
    binding.mode === 'probe'
      ? '**Diagnostic-only artifact probe: qualificationPassed=false. This does not validate the current checkout source.**'
      : 'Source qualification (for the selected runtime matrix).',
    '',
    `App source commit: ${binding.sourceCommit}; harness commit: ${binding.harnessCommit}`,
    '',
    `App SHA-256: ${appHash}; source provenance: ${metadata.sourceProvenance.status}`,
    '',
    `App compiler: ${selected.buildXcode.description.replaceAll('\n', ', ')}`,
    '',
    selected.fullCoverage
      ? 'Full declared major-version matrix.'
      : '**Partial matrix shard/subset: NOT full declared coverage on its own.**',
    '',
    '| Runtime | Test Xcode | Result |',
    '| --- | --- | --- |',
    ...results.map(
      result =>
        `| ${result.version} | ${result.testXcode.version} | ${result.status} |`,
    ),
    '',
    'Fresh-install welcome-screen checks only; not real-device, existing-wallet, or upgrade validation.',
    '',
  ].join('\n');
  await fs.writeFile(path.join(output, 'summary.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
  if (!passed)
    throw new Error(
      'Startup matrix did not pass; inspect per-runtime xcresult and logs',
    );
}

export async function main(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      output: { type: 'string' },
      majors: { type: 'string' },
      'build-xcode': { type: 'string' },
      'build-metadata': { type: 'string' },
      'runtime-version': { type: 'string' },
      plan: { type: 'string' },
      app: { type: 'string' },
      metadata: { type: 'string' },
      probe: { type: 'boolean', default: false },
    },
  });
  if (!values.output) throw new Error('--output must be a new directory');
  if (positionals[0] === 'plan') return plan(values);
  if (positionals[0] === 'test' && values.plan && values.app && values.metadata)
    return test(values);
  throw new Error(
    'Use plan --output DIR [--majors 16,17,18,26,27] [--build-xcode 26.3] [--build-metadata FILE] [--probe], or test --plan FILE --app APP --metadata FILE --output DIR [--probe]',
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
