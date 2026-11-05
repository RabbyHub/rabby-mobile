'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { normalizeMachoPaths } = require('./normalize_macho_paths');

const sha256 = buffer =>
  crypto.createHash('sha256').update(buffer).digest('hex');

test('normalizes known Xcode/user paths without changing binary length', () => {
  const input = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode-27.1.0.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk -fno-common /Users/build/agent-work-debank/apps/mobile',
    'latin1',
  );

  const output = normalizeMachoPaths(input);
  const text = output.toString('latin1');

  assert.equal(output.length, input.length);
  assert.ok(!text.includes('/Applications/Xcode-27.1.0.app'));
  assert.ok(!text.includes('/Users/build/agent-work-debank'));
  assert.ok(text.includes('/__rabby_xcode__'));
  assert.ok(text.includes('/__rabby_user__'));
});

test('changing a non-path data byte still changes the normalized hash', () => {
  const first = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode.app/Contents/Developer DATA=AAAAAAAA',
    'latin1',
  );
  const second = Buffer.from(
    'compiler: cc -isysroot /Applications/Xcode.app/Contents/Developer DATA=AAAAAAAB',
    'latin1',
  );

  assert.notEqual(
    sha256(normalizeMachoPaths(first)),
    sha256(normalizeMachoPaths(second)),
  );
});
