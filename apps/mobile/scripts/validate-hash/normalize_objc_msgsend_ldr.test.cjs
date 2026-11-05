'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  normalizeMachOLayoutNoise,
} = require('./normalize_objc_msgsend_ldr');

test('normalizes literal-pool adrp/add and adrp/ldr pairs consistently', () => {
  const first = [
    '0000000000063654\tadrp\tx0, 12263 ; 0x304a000',
    '0000000000063658\tadd\tx0, x0, #0x3f9 ; literal pool for: "foo"',
    '000000000006365c\tadrp\tx8, 12262 ; 0x3049000',
    '0000000000063660\tldr\tx8, [x8, #0x3c0] ; literal pool symbol address: _objc_msgSend',
  ].join('\n');
  const second = [
    '0000000000063654\tadrp\tx0, 12262 ; 0x3049000',
    '0000000000063658\tadd\tx0, x0, #0x2c2 ; literal pool for: "foo"',
    '000000000006365c\tadrp\tx8, 12261 ; 0x3048000',
    '0000000000063660\tldr\tx8, [x8, #0x5a0] ; literal pool symbol address: _objc_msgSend',
  ].join('\n');
  const expected = [
    '0000000000063654\tadrp\tx0, 0 ; 0x0',
    '0000000000063658\tadd\tx0, x0, #0x0 ; literal pool for: "foo"',
    '000000000006365c\tadrp\tx8, 0 ; 0x0',
    '0000000000063660\tldr\tx8, [x8, #0x0] ; literal pool symbol address: _objc_msgSend',
  ].join('\n');

  assert.equal(normalizeMachOLayoutNoise(first), expected);
  assert.equal(normalizeMachOLayoutNoise(second), expected);
});

test('preserves unrelated adrp destinations and their page identity', () => {
  const first = [
    '0000000000063654\tadrp\tx8, 1 ; 0x2000',
    '0000000000063658\tstr\tw0, [x8, #0x10]',
  ].join('\n');
  const second = [
    '0000000000063654\tadrp\tx8, 2 ; 0x3000',
    '0000000000063658\tstr\tw0, [x8, #0x10]',
  ].join('\n');

  const normalizedFirst = normalizeMachOLayoutNoise(first);
  const normalizedSecond = normalizeMachOLayoutNoise(second);

  assert.match(normalizedFirst, /adrp\tx8, 1 ; 0x2000/);
  assert.match(normalizedSecond, /adrp\tx8, 2 ; 0x3000/);
  assert.notEqual(normalizedFirst, normalizedSecond);
});

test('does not normalize an adrp whose next instruction uses another base', () => {
  const input = [
    '0000000000063654\tadrp\tx0, 12263 ; 0x304a000',
    '0000000000063658\tadd\tx1, x2, #0x3f9 ; literal pool for: "foo"',
  ].join('\n');

  assert.match(
    normalizeMachOLayoutNoise(input),
    /adrp\tx0, 12263 ; 0x304a000/,
  );
  assert.match(
    normalizeMachOLayoutNoise(input),
    /add\tx1, x2, #0x3f9 ; literal pool for: "foo"/,
  );
});
