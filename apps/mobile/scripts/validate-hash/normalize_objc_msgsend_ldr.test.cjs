'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  normalizeMachOLayoutNoise,
} = require('./normalize_objc_msgsend_ldr');

test('normalizes adrp pages and literal-pool offsets consistently', () => {
  const first = [
    '0000000000063654\tadrp\tx0, 12263 ; 0x304a000',
    '0000000000063658\tadd\tx0, x0, #0x3f9 ; literal pool for: "foo"',
    '000000000006365c\tldr\tx8, [x8, #0x3c0] ; literal pool symbol address: _objc_msgSend',
  ].join('\n');
  const second = [
    '0000000000063654\tadrp\tx0, 12262 ; 0x3049000',
    '0000000000063658\tadd\tx0, x0, #0x2c2 ; literal pool for: "foo"',
    '000000000006365c\tldr\tx8, [x8, #0x5a0] ; literal pool symbol address: _objc_msgSend',
  ].join('\n');
  const expected = [
    '0000000000063654\tadrp\tx0, 0 ; 0x0',
    '0000000000063658\tadd\tx0, x0, #0x0 ; literal pool for: "foo"',
    '000000000006365c\tldr\tx8, [x8, #0x0] ; literal pool symbol address: _objc_msgSend',
  ].join('\n');

  assert.equal(normalizeMachOLayoutNoise(first), expected);
  assert.equal(normalizeMachOLayoutNoise(second), expected);
});

test('preserves non-literal instructions', () => {
  const input = [
    '0000000000063654\tadrp\tx0, 12263 ; 0x304a000',
    '0000000000063658\tadd\tx0, x0, #0x10',
    '000000000006365c\tmov\tw8, #0x48',
  ].join('\n');

  assert.equal(
    normalizeMachOLayoutNoise(input),
    ['0000000000063654\tadrp\tx0, 0 ; 0x0', '0000000000063658\tadd\tx0, x0, #0x10', '000000000006365c\tmov\tw8, #0x48'].join('\n'),
  );
});
