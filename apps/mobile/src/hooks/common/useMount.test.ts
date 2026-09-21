import { renderHook } from '@testing-library/react-native';

import { useUnmountedRef } from './useMount';

describe('useUnmountedRef', () => {
  it('starts as false and flips to true on unmount', () => {
    const { result, unmount } = renderHook(() => useUnmountedRef());

    expect(result.current.current).toBe(false);

    unmount();

    expect(result.current.current).toBe(true);
  });
});
