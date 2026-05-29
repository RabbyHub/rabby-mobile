import { act, renderHook } from '@testing-library/react-native';

import { useSlTpUsdInput, useUsdInput } from './useUsdInput';

describe('useUsdInput', () => {
  it('normalizes currency and comma decimal input', () => {
    const { result } = renderHook(() => useUsdInput());

    act(() => {
      result.current.onChangeText('$12,34');
    });

    expect(result.current.value).toBe('12.34');
    expect(result.current.displayedValue).toBe('$12.34');
  });

  it('keeps the last accepted value when input is invalid or too precise', () => {
    const { result } = renderHook(() => useUsdInput({ maxDecimals: 2 }));

    act(() => {
      result.current.onChangeText('1.23');
    });

    expect(result.current.value).toBe('1.23');

    act(() => {
      result.current.onChangeText('1.234');
    });

    expect(result.current.value).toBe('1.23');

    act(() => {
      result.current.onChangeText('abc');
    });

    expect(result.current.value).toBe('1.23');
  });
});

describe('useSlTpUsdInput', () => {
  it('allows integer and trailing-dot values without significant-figure limits', () => {
    const { result } = renderHook(() => useSlTpUsdInput({ szDecimals: 4 }));

    act(() => {
      result.current.onChangeText('$123456.');
    });

    expect(result.current.value).toBe('123456.');
    expect(result.current.displayedValue).toBe('$123456.');
  });

  it('rejects prices that exceed stop-loss/take-profit precision rules', () => {
    const { result } = renderHook(() => useSlTpUsdInput({ szDecimals: 4 }));

    act(() => {
      result.current.onChangeText('12.34');
    });

    expect(result.current.value).toBe('12.34');

    act(() => {
      result.current.onChangeText('12.345');
    });

    expect(result.current.value).toBe('12.34');

    act(() => {
      result.current.onChangeText('12345.6');
    });

    expect(result.current.value).toBe('12.34');
  });
});
