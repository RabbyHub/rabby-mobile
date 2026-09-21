import { coerceNumber, coerceSecond } from './coerce';

describe('coerceNumber', () => {
  it('parses numeric-like input', () => {
    expect(coerceNumber('12.34')).toBe(12.34);
  });

  it('returns the fallback when parseFloat fails', () => {
    expect(coerceNumber('not-a-number', 7)).toBe(7);
  });

  it('treats falsy input as 0 before applying the fallback', () => {
    expect(coerceNumber('', 7)).toBe(0);
    expect(coerceNumber(null, 9)).toBe(0);
  });
});

describe('coerceSecond', () => {
  it('treats falsy input as 0 instead of using the millisecond fallback', () => {
    expect(coerceSecond(undefined, 6000)).toBe(0);
  });

  it('returns the parsed seconds when input is usable', () => {
    expect(coerceSecond('4.5', 6000)).toBe(4.5);
  });
});
