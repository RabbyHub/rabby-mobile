import assert from 'node:assert/strict';
import test from 'node:test';
import { compareVersions, parseMajors, selectRuntimes } from './run.mjs';

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
  assert.equal(selected[1].testXcodeVersion, '26.3');
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
  );
  assert.equal(selected[0].version, '17.5');
  assert.throws(
    () => selectRuntimes([runtime('17.6')], [17], '17.5'),
    /missing/,
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
