'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { assertCanonicalXcodePaths } = require('./check_macho_paths');

const sha256 = buffer =>
  crypto.createHash('sha256').update(buffer).digest('hex');

test('accepts the canonical Xcode developer path', () => {
  const input = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk',
    'latin1',
  );
  assert.doesNotThrow(() => assertCanonicalXcodePaths(input));
});

test('rejects a versioned Xcode install path', () => {
  const input = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode-27.1.0.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk',
    'latin1',
  );
  assert.throws(
    () => assertCanonicalXcodePaths(input),
    /non-canonical Xcode path/,
  );
});

test('raw framework bytes still detect non-path data changes', () => {
  const first = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode.app/Contents/Developer DATA=AAAAAAAA',
    'latin1',
  );
  const second = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode.app/Contents/Developer DATA=AAAAAAAB',
    'latin1',
  );

  assert.doesNotThrow(() => assertCanonicalXcodePaths(first));
  assert.doesNotThrow(() => assertCanonicalXcodePaths(second));
  assert.notEqual(sha256(first), sha256(second));
});
