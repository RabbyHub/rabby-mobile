// run: ./node_modules/.bin/jest ./src/core/utils/compare.test.ts
import { depsAreDeepSame, depsAreShallowSame } from './compare';

describe('depsAreShallowSame', () => {
  const func1 = () => {};
  const func2 = () => {};

  it('returns true for identical primitive values', () => {
    expect(depsAreShallowSame([1, 'a', true], [1, 'a', true])).toBe(true);
  });

  it('returns false for different primitive values', () => {
    expect(depsAreShallowSame([1, 'a', true], [2, 'a', true])).toBe(false);
  });

  it('returns true for same object references', () => {
    const obj = { key: 'value' };
    expect(depsAreShallowSame([obj, func1], [obj, func1])).toBe(true);
  });

  it('returns false for different object references with same content', () => {
    expect(depsAreShallowSame([{ key: 'value' }], [{ key: 'value' }])).toBe(
      false,
    );
  });

  it('returns false for different function references', () => {
    expect(depsAreShallowSame([func1], [func2])).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(depsAreShallowSame([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe('depsAreDeepSame', () => {
  const func1 = () => {};
  const func2 = () => {};

  it('returns true for identical primitive values', () => {
    expect(depsAreDeepSame([1, 'a', true], [1, 'a', true])).toBe(true);
  });

  it('returns false for different primitive values', () => {
    expect(depsAreDeepSame([1, 'a', true], [2, 'a', true])).toBe(false);
  });

  it('returns true for different object references with same content', () => {
    expect(depsAreDeepSame([{ key: 'value' }], [{ key: 'value' }])).toBe(true);
  });

  it('returns false for different function references', () => {
    expect(depsAreDeepSame([func1], [func2])).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(depsAreDeepSame([1, 2], [1, 2, 3])).toBe(false);
  });

  describe('nested structures', () => {
    it('returns true for deeply equal nested structures', () => {
      const dep1 = [{ a: [1, 2, { b: 'c' }] }, 3];
      const dep2 = [{ a: [1, 2, { b: 'c' }] }, 3];
      expect(depsAreDeepSame([dep1], [dep2])).toBe(true);
    });

    it('returns false for non-deeply equal nested structures', () => {
      const dep1 = [{ a: [1, 2, { b: 'c' }] }, 3];
      const dep2 = [{ a: [1, 2, { b: 'd' }] }, 3];
      expect(depsAreDeepSame([dep1], [dep2])).toBe(false);
    });
  });
});
