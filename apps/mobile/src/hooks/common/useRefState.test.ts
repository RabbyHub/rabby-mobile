import { act, renderHook } from '@testing-library/react-native';

import { useRefState } from './useRefState';

describe('useRefState', () => {
  it('updates both state and ref when rerender is requested', () => {
    const { result } = renderHook(() => useRefState(1));

    act(() => {
      result.current.setRefState(prev => prev + 1);
    });

    expect(result.current.state).toBe(2);
    expect(result.current.stateRef.current).toBe(2);
  });

  it('updates only the ref until the next rerender when triggerRerender is false', () => {
    const { result, rerender } = renderHook(() => useRefState(1));

    act(() => {
      result.current.setRefState(2, false);
    });

    expect(result.current.state).toBe(1);
    expect(result.current.stateRef.current).toBe(2);

    rerender({});

    expect(result.current.state).toBe(2);
    expect(result.current.stateRef.current).toBe(2);
  });
});
