import { act, renderHook } from '@testing-library/react-native';
import { useSafeState } from './useSafeState';

describe('useSafeState', () => {
  it('updates state while mounted', () => {
    const { result } = renderHook(() => useSafeState(1));

    act(() => {
      result.current[1](2);
    });

    expect(result.current[0]).toBe(2);
  });

  it('ignores state updates after unmount', () => {
    const { result, unmount } = renderHook(() => useSafeState(1));

    unmount();

    act(() => {
      result.current[1](2);
    });

    expect(result.current[0]).toBe(1);
  });
});
