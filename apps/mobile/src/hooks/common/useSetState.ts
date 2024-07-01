import { useCallback } from 'react';

export function useMakeSetState<T, U extends any = void>(options: {
  getLatestState: () => T;
  onNextState: (newState: T, prevState: T) => U;
}) {
  const { getLatestState, onNextState } = options;

  return useCallback<(ns: T | ((prev: T) => T)) => U>(
    function (nextState) {
      const prevState = getLatestState();
      const newState =
        typeof nextState === 'function'
          ? (nextState as Function)(prevState)
          : nextState;

      return onNextState(newState, prevState);
    },
    [getLatestState, onNextState],
  );
}
