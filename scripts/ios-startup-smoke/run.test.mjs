import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareVersions,
  createSourceBinding,
  parseMajors,
  readRuntimeInventory,
  selectRuntimes,
  validateBuildReceipt,
  validateTestBinding,
} from './run.mjs';

test('preflight runtime inventory has its own bounded two-minute budget', () => {
  const env = { DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' };
  const inventory = { runtimes: [] };
  let calls = 0;
  assert.deepEqual(
    readRuntimeInventory(env, (executable, args, options) => {
      calls++;
      assert.equal(executable, '/usr/bin/xcrun');
      assert.deepEqual(args, ['simctl', 'list', 'runtimes', '--json']);
      assert.deepEqual(options, {
        encoding: 'utf8',
        env,
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
      });
      return JSON.stringify(inventory);
    }),
    inventory,
  );
  assert.equal(calls, 1);
  const timeout = Object.assign(new Error('inventory timeout'), {
    code: 'ETIMEDOUT',
  });
  assert.throws(
    () =>
      readRuntimeInventory(env, () => {
        throw timeout;
      }),
    error => error === timeout,
  );
  assert.throws(() => readRuntimeInventory(env, () => 'invalid JSON'));
});

const sourceCommit = 'a'.repeat(40);
const harnessCommit = 'b'.repeat(40);
const metadataSha256 = 'c'.repeat(64);
const appHash = 'd'.repeat(64);
const jsHash = 'e'.repeat(64);
const buildMetadata = (overrides = {}) => ({
  schemaVersion: 2,
  sourceCommit,
  xcode: 'Xcode 26.3\nBuild version 17C529',
  sourceProvenance: {
    status: 'clean',
    headCommit: sourceCommit,
    changedFiles: [],
  },
  platform: 'iphonesimulator',
  configuration: 'Regression',
  executableSha256: appHash,
  jsBundleSha256: jsHash,
  ...overrides,
});
const planBinding = (options = {}) => {
  const binding = createSourceBinding({
    harnessCommit: sourceCommit,
    metadata: buildMetadata(),
    metadataSha256,
    ...options,
  });
  return { ...binding, commit: binding.sourceCommit };
};

test('qualification binds the clean app and harness to the same checkout', () => {
  const selected = planBinding();
  assert.equal(selected.mode, 'qualification');
  assert.equal(selected.sourceCommit, sourceCommit);
  assert.equal(selected.harnessCommit, sourceCommit);
  assert.equal(selected.buildMetadataSha256, metadataSha256);
  assert.equal(selected.evidenceScope, 'source-qualification');
  assert.throws(
    () => planBinding({ harnessCommit }),
    /does not match this checkout/,
  );
});

test('explicit probe keeps the artifact source separate from the current harness', () => {
  const selected = planBinding({ harnessCommit, probe: true });
  assert.equal(selected.mode, 'probe');
  assert.equal(selected.sourceCommit, sourceCommit);
  assert.equal(selected.commit, sourceCommit);
  assert.equal(selected.harnessCommit, harnessCommit);
  assert.equal(selected.evidenceScope, 'diagnostic-only');
  assert.throws(
    () => createSourceBinding({ harnessCommit, probe: true }),
    /requires --build-metadata/,
  );
});

test('modified sources are diagnostic-only, including HEAD drift without file changes', () => {
  for (const sourceProvenance of [
    {
      status: 'modified',
      headCommit: sourceCommit,
      changedFiles: ['Podfile.lock'],
    },
    { status: 'modified', headCommit: harnessCommit, changedFiles: [] },
  ]) {
    const metadata = buildMetadata({ sourceProvenance });
    assert.throws(
      () => planBinding({ metadata }),
      /requires clean build source provenance/,
    );
    assert.equal(
      planBinding({ metadata, probe: true }).evidenceScope,
      'diagnostic-only',
    );
  }
});

test('both modes reject legacy or contradictory source provenance', () => {
  for (const metadata of [
    buildMetadata({ schemaVersion: 1 }),
    buildMetadata({ sourceProvenance: undefined }),
    buildMetadata({
      sourceProvenance: {
        status: 'unknown',
        headCommit: sourceCommit,
        changedFiles: [],
      },
    }),
    buildMetadata({
      sourceProvenance: {
        status: 'clean',
        headCommit: harnessCommit,
        changedFiles: [],
      },
    }),
    buildMetadata({
      sourceProvenance: {
        status: 'clean',
        headCommit: sourceCommit,
        changedFiles: ['Podfile.lock'],
      },
    }),
    buildMetadata({
      sourceProvenance: {
        status: 'modified',
        headCommit: sourceCommit,
        changedFiles: [],
      },
    }),
  ]) {
    for (const probe of [false, true])
      assert.throws(() => planBinding({ metadata, probe }), /provenance/);
  }
});

test('test requires the explicit probe flag to agree with the saved plan', () => {
  for (const probe of [false, true]) {
    const selected = planBinding({ probe });
    const input = {
      selected,
      harnessCommit: sourceCommit,
      metadata: buildMetadata(),
      metadataSha256,
    };
    assert.equal(validateTestBinding({ ...input, probe }).mode, selected.mode);
    assert.throws(
      () => validateTestBinding({ ...input, probe: !probe }),
      /must match the runtime plan mode/,
    );
  }
});

test('probe still rejects a changed checkout or a substituted receipt', () => {
  const input = {
    selected: planBinding({ harnessCommit, probe: true }),
    harnessCommit,
    metadata: buildMetadata(),
    metadataSha256,
    probe: true,
  };
  assert.equal(validateTestBinding(input).sourceCommit, sourceCommit);
  assert.throws(
    () => validateTestBinding({ ...input, harnessCommit: sourceCommit }),
    /checkout changed/,
  );
  assert.throws(
    () => validateTestBinding({ ...input, metadataSha256: 'f'.repeat(64) }),
    /receipt does not match/,
  );
  assert.throws(
    () => validateTestBinding({ ...input, metadata: undefined }),
    /receipt is required/,
  );
  assert.throws(
    () =>
      validateTestBinding({
        ...input,
        selected: { ...input.selected, buildMetadataSha256: null },
      }),
    /receipt does not match/,
  );
  assert.throws(
    () =>
      validateTestBinding({
        ...input,
        selected: { ...input.selected, sourceCommit: harnessCommit },
      }),
    /receipt does not match/,
  );
});

test('qualification rechecks source cleanliness at test time for a pre-build plan', () => {
  const selected = planBinding({ metadata: undefined });
  const input = {
    selected,
    harnessCommit: sourceCommit,
    metadata: buildMetadata(),
    metadataSha256,
  };
  assert.equal(validateTestBinding(input).mode, 'qualification');
  assert.throws(
    () =>
      validateTestBinding({
        ...input,
        metadata: buildMetadata({
          sourceProvenance: {
            status: 'modified',
            headCommit: sourceCommit,
            changedFiles: ['Info.plist'],
          },
        }),
      }),
    /requires clean/,
  );
});

test('artifact probes do not weaken platform, configuration or binary/JS hash checks', () => {
  const input = { metadata: buildMetadata(), sourceCommit, appHash, jsHash };
  assert.doesNotThrow(() => validateBuildReceipt(input));
  for (const mismatch of [
    { sourceCommit: harnessCommit },
    { platform: 'iphoneos' },
    { configuration: 'Debug' },
    { executableSha256: 'f'.repeat(64) },
    { jsBundleSha256: 'f'.repeat(64) },
  ]) {
    assert.throws(
      () =>
        validateBuildReceipt({ ...input, metadata: buildMetadata(mismatch) }),
      /receipt does not match/,
    );
  }
});

const iphone = {
  identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-13-mini',
  productFamily: 'iPhone',
};
const runtime = (version, extra = {}) => ({
  version,
  identifier:
    'com.apple.CoreSimulator.SimRuntime.iOS-' + version.replaceAll('.', '-'),
  isAvailable: true,
  supportedDeviceTypes: [iphone],
  ...extra,
});

test('default declared major versions, not a fictitious 16..27 range', () => {
  assert.deepEqual(parseMajors('16,17,18,26,27'), [16, 17, 18, 26, 27]);
  assert.deepEqual(parseMajors('17,16'), [16, 17]);
  for (const input of [
    '',
    '16,16',
    '15',
    '19',
    '16,latest',
    '16, 17',
    '16;whoami',
  ]) {
    assert.throws(() => parseMajors(input));
  }
});

test('compares version components numerically', () => {
  assert(compareVersions('17.10', '17.9') > 0);
  assert(compareVersions('26.3.1', '26.3') > 0);
  assert.equal(compareVersions('26.3', '26.3.0'), 0);
});

test('selects latest available runtime per major and never changes its actual identifier', () => {
  const actualId = 'com.apple.CoreSimulator.SimRuntime.iOS-26-3';
  const selected = selectRuntimes(
    [
      runtime('17.9'),
      runtime('17.10'),
      runtime('17.11', { isAvailable: false }),
      runtime('26.3.1', { identifier: actualId }),
    ],
    [17, 26],
  );
  assert.equal(selected[0].version, '17.10');
  assert.equal(selected[1].identifier, actualId);
  assert.equal(selected[1].testXcodeVersion, '27.1');
});

test('a missing required OS version is an infrastructure failure, not a skipped pass', () => {
  assert.throws(
    () => selectRuntimes([runtime('16.4'), runtime('17.5')], [16, 17, 18]),
    /iOS 18/,
  );
  assert.throws(
    () => selectRuntimes([runtime('16.4', { isAvailable: false })], [16]),
    /unavailable/,
  );
});

test('hosted shards use the provisioned exact runtime, not a newer preinstalled minor', () => {
  const selected = selectRuntimes(
    [runtime('17.5'), runtime('17.6')],
    [17],
    '17.5',
    'hosted',
  );
  assert.equal(selected[0].version, '17.5');
  assert.equal(selected[0].testXcodeVersion, '26.3');
  assert.throws(
    () => selectRuntimes([runtime('17.6')], [17], '17.5'),
    /missing/,
  );
});

test('local planning pins only iOS16 to26.3 and never chooses an implicit hosted fallback', () => {
  const selected = selectRuntimes(
    [
      runtime('16.4'),
      runtime('17.5'),
      runtime('18.3.1'),
      runtime('26.2'),
      runtime('27.0'),
    ],
    [16, 17, 18, 26, 27],
  );
  assert.deepEqual(
    selected.map(item => item.testXcodeVersion),
    ['26.3', '27.1', '27.1', '27.1', '27.1'],
  );
  assert.throws(
    () => selectRuntimes([runtime('16.4')], [16], undefined, 'auto'),
    /explicitly/,
  );
});

test('device type follows runtime support, including iPhone Duo-only runtimes', () => {
  const duo = {
    identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-Duo',
    productFamily: 'iPhone',
  };
  const [selected] = selectRuntimes(
    [runtime('27.1', { supportedDeviceTypes: [duo] })],
    [27],
  );
  assert.equal(selected.deviceType, duo.identifier);
  assert.equal(selected.testXcodeVersion, '27.1');
  assert.throws(
    () => selectRuntimes([runtime('16.4', { supportedDeviceTypes: [] })], [16]),
    /device type/,
  );
});

test('non-iOS/unavailable/malformed inventory cannot satisfy the matrix', () => {
  assert.throws(
    () =>
      selectRuntimes(
        [
          runtime('16.4', {
            identifier: 'com.apple.CoreSimulator.SimRuntime.tvOS-16-4',
          }),
          runtime('16.4-beta'),
        ],
        [16],
      ),
    /missing/,
  );
});
