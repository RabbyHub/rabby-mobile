import { renderHook } from '@testing-library/react-native';

import { useMakeSetState } from './useSetState';

describe('useMakeSetState', () => {
  it('passes both previous and next state into onNextState', () => {
    const getLatestState = jest.fn(() => 1);
    const onNextState = jest.fn((next: number, prev: number) => ({
      next,
      prev,
    }));

    const { result } = renderHook(() =>
      useMakeSetState({
        getLatestState,
        onNextState,
      }),
    );

    expect(result.current(3)).toEqual({
      next: 3,
      prev: 1,
    });
    expect(onNextState).toHaveBeenCalledWith(3, 1);
  });

  it('supports updater functions based on the latest state', () => {
    const getLatestState = jest.fn(() => 2);
    const onNextState = jest.fn((next: number, prev: number) => next + prev);

    const { result } = renderHook(() =>
      useMakeSetState({
        getLatestState,
        onNextState,
      }),
    );

    expect(result.current(prev => prev * 2)).toBe(6);
    expect(onNextState).toHaveBeenCalledWith(4, 2);
  });
});
