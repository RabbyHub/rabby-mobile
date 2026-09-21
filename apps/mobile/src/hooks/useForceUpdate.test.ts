import { act, renderHook } from '@testing-library/react-native';

import { useForceUpdate } from './useForceUpdate';

describe('useForceUpdate', () => {
  it('returns a stable callback that forces rerenders', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useForceUpdate();
    });

    const firstRef = result.current;

    act(() => {
      result.current();
    });

    expect(renderCount).toBe(2);
    expect(result.current).toBe(firstRef);

    act(() => {
      result.current();
    });

    expect(renderCount).toBe(3);
  });
});
