import { act, renderHook } from '@testing-library/react-native';

import {
  useDebouncedValue,
  useThrottledValueLeading,
  useThrottledValueTrailing,
} from './delayLikeValue';

describe('delayLikeValue hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('useDebouncedValue delays updates until the timeout completes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebouncedValue(value, delay),
      {
        initialProps: {
          value: 'a',
          delay: 20,
        },
      },
    );

    rerender({
      value: 'b',
      delay: 20,
    });

    expect(result.current).toBe('a');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20);
    });

    expect(result.current).toBe('b');
  });

  it('useThrottledValueLeading updates immediately only after the delay window has elapsed', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useThrottledValueLeading(value, delay),
      {
        initialProps: {
          value: 'a',
          delay: 100,
        },
      },
    );

    expect(result.current).toBe('a');

    nowSpy.mockReturnValue(50);
    rerender({
      value: 'b',
      delay: 100,
    });
    expect(result.current).toBe('a');

    nowSpy.mockReturnValue(100);
    rerender({
      value: 'c',
      delay: 100,
    });
    expect(result.current).toBe('c');
  });

  it('useThrottledValueTrailing keeps only the latest pending value', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useThrottledValueTrailing(value, delay),
      {
        initialProps: {
          value: 'a',
          delay: 20,
        },
      },
    );

    rerender({
      value: 'b',
      delay: 20,
    });
    rerender({
      value: 'c',
      delay: 20,
    });

    expect(result.current).toBe('a');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(20);
    });

    expect(result.current).toBe('c');
  });
});
