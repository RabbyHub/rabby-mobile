#!/usr/bin/env node

/**
 * Production-isolation gate for the biz-mock deeplink surface.
 *
 * Fails when any non-production-only entry point could be registered in a
 * production build:
 * - the iOS Info.plist preprocessor must drop the RABBYMOCK scheme for release;
 * - the Android main manifest must not register a rabbymock scheme;
 * - the JS listeners/overrides must keep their isNonPublicProductionEnv guard.
 *
 * Pass --apk <path> to additionally inspect a built release APK's manifest.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function read(relative) {
  return readFileSync(path.join(appRoot, relative), 'utf8');
}

function checkInfoPlist() {
  const plist = path.join(appRoot, 'ios/RabbyMobile/Info.plist');
  const release = execFileSync(
    'cpp',
    ['-P', '-DRABBYMOCK_SCHEME_ENABLED=0', plist],
    { encoding: 'utf8' },
  );
  const regression = execFileSync(
    'cpp',
    ['-P', '-DRABBYMOCK_SCHEME_ENABLED=1', plist],
    { encoding: 'utf8' },
  );
  record(
    'ios-info-plist-release',
    !release.includes('RABBYMOCK_SCHEMA'),
    'release preprocess output must not contain RABBYMOCK_SCHEMA',
  );
  record(
    'ios-info-plist-regression',
    (regression.match(/RABBYMOCK_SCHEMA/g) || []).length === 1,
    'regression preprocess output must contain RABBYMOCK_SCHEMA once',
  );
}

function checkXcodeConfig() {
  const pbxproj = read('ios/RabbyMobile.xcodeproj/project.pbxproj');
  const off = (pbxproj.match(/RABBYMOCK_SCHEME_ENABLED=0/g) || []).length;
  const on = (pbxproj.match(/RABBYMOCK_SCHEME_ENABLED=1/g) || []).length;
  record(
    'xcode-release-flag',
    off >= 1,
    'release config sets RABBYMOCK_SCHEME_ENABLED=0',
  );
  record(
    'xcode-nonprod-flag',
    on >= 2,
    'debug/regression configs set RABBYMOCK_SCHEME_ENABLED=1',
  );
}

function checkAndroidManifests() {
  const main = read('android/app/src/main/AndroidManifest.xml');
  record(
    'android-main-manifest',
    !/rabbymock/i.test(main),
    'main manifest must not register a rabbymock scheme',
  );
  const debug = read('android/app/src/debug/AndroidManifest.xml');
  const regression = read('android/app/src/regression/AndroidManifest.xml');
  record(
    'android-debug-manifest',
    /rabbymock/i.test(debug),
    'debug manifest registers the rabbymock scheme',
  );
  record(
    'android-regression-manifest',
    /rabbymock/i.test(regression),
    'regression manifest registers the rabbymock scheme',
  );
}

function checkSourceGuards() {
  const guarded = [
    'src/devtools/bizMock/useBizMockDeeplink.ts',
    'src/devtools/bizMock/protocol.ts',
    'src/devtools/bizMock/useBizMockAction.ts',
    'src/devtools/bizMock/tokenBalanceOverrides.ts',
  ];
  for (const relative of guarded) {
    const source = read(relative);
    record(
      `guard:${path.basename(relative)}`,
      source.includes('isNonPublicProductionEnv'),
      'must keep the isNonPublicProductionEnv guard',
    );
  }
}

function checkApk(apkPath) {
  if (!apkPath) {
    record('android-release-apk', true, 'skipped (no --apk)');
    return;
  }
  try {
    const xml = execFileSync(
      'aapt2',
      ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apkPath],
      { encoding: 'utf8' },
    );
    record(
      'android-release-apk',
      !/rabbymock/i.test(xml),
      'built APK manifest must not contain rabbymock',
    );
  } catch (error) {
    record(
      'android-release-apk',
      false,
      `aapt2 inspection failed: ${error.message}`,
    );
  }
}

function main() {
  const apkIndex = process.argv.indexOf('--apk');
  const apkPath = apkIndex > -1 ? process.argv[apkIndex + 1] : undefined;

  try {
    checkInfoPlist();
  } catch (error) {
    record('ios-info-plist', false, `cpp preprocess failed: ${error.message}`);
  }
  checkXcodeConfig();
  checkAndroidManifests();
  checkSourceGuards();
  checkApk(apkPath);

  const ok = checks.every(check => check.ok);
  console.log(JSON.stringify({ ok, checks }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

main();
