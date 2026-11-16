'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeAsmPaths } = require('./normalize_asm_paths');

test('normalizes Xcode developer paths from different installs', () => {
  const input = [
    'literal pool for: "/Applications/Xcode-26.3.0.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS26.3.sdk"',
    'literal pool for: "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk"',
  ].join('\n');

  const output = normalizeAsmPaths(input, {
    repoRoot: '/tmp/validate-rabby-mobile-abc123',
    repoRootAlt: '/private/tmp/validate-rabby-mobile-abc123',
    developerDir: '/Applications/Xcode-26.3.0.app/Contents/Developer',
    exportDir:
      '/tmp/validate-rabby-mobile-abc123/apps/mobile/validation_exports_20261105-120000',
  });

  assert.equal((output.match(/\/__rabby_xcode_developer__/g) || []).length, 2);
  assert.ok(
    !output.includes('/Applications/Xcode-26.3.0.app/Contents/Developer'),
  );
  assert.ok(!output.includes('/Applications/Xcode.app/Contents/Developer'));
});

test('normalizes both /tmp and /private/tmp validation workspace forms', () => {
  const input = [
    '/tmp/validate-rabby-mobile-abc123/apps/mobile/ios/Foo.mm',
    '/private/tmp/validate-rabby-mobile-abc123/apps/mobile/ios/Foo.mm',
  ].join('\n');

  const output = normalizeAsmPaths(input, {
    repoRoot: '/tmp/validate-rabby-mobile-abc123',
    repoRootAlt: '/private/tmp/validate-rabby-mobile-abc123',
  });

  assert.equal((output.match(/\/__rabby_repo__/g) || []).length, 2);
  assert.ok(!output.includes('/tmp/validate-rabby-mobile-abc123'));
  assert.ok(!output.includes('/private/tmp/validate-rabby-mobile-abc123'));
});

test('normalizes the export directory before its parent workspace path', () => {
  const exportDir =
    '/tmp/validate-rabby-mobile-abc123/apps/mobile/validation_exports_20261105-120000';
  const output = normalizeAsmPaths(`${exportDir}/ios/build.log`, {
    repoRoot: '/tmp/validate-rabby-mobile-abc123',
    exportDir,
  });

  assert.equal(output, '/__rabby_hashcheck_export__/ios/build.log');
});
