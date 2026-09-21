import { renderHook } from '@testing-library/react-native';

import useCachedValue from './useCachedValue';

describe('useCachedValue', () => {
  it('keeps the last cached value when the object becomes unavailable', () => {
    const { result, rerender } = renderHook(
      ({
        obj,
        key,
      }: {
        obj?: {
          a?: number;
          b?: number;
        } | null;
        key: 'a' | 'b';
      }) => useCachedValue(obj, key),
      {
        initialProps: {
          obj: { a: 1 },
          key: 'a' as const,
        },
      },
    );

    expect(result.current).toBe(1);

    rerender({
      obj: undefined,
      key: 'a',
    });

    expect(result.current).toBe(1);
  });

  it('reuses a single cache slot even after the requested key changes', () => {
    const { result, rerender } = renderHook(
      ({
        obj,
        key,
      }: {
        obj: {
          a?: number;
          b?: number;
        };
        key: 'a' | 'b';
      }) => useCachedValue(obj, key),
      {
        initialProps: {
          obj: { a: 1 },
          key: 'a' as const,
        },
      },
    );

    rerender({
      obj: { a: 1 },
      key: 'b',
    });

    expect(result.current).toBe(1);

    rerender({
      obj: { a: 1, b: 2 },
      key: 'b',
    });

    expect(result.current).toBe(2);
  });

  it('overwrites the cache with undefined when the key exists but the value is undefined', () => {
    const { result, rerender } = renderHook(
      ({
        obj,
      }: {
        obj: {
          a?: number;
        };
      }) => useCachedValue(obj, 'a'),
      {
        initialProps: {
          obj: { a: 1 },
        },
      },
    );

    rerender({
      obj: { a: undefined },
    });

    expect(result.current).toBeUndefined();
  });
});
