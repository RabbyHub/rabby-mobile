import { atom, useAtom } from 'jotai';
import { useAtomCallback } from 'jotai/utils';
import React, { useCallback, useRef, useState } from 'react';

export function useRefState<T extends Exclude<any, Function>>(
  initValue: T | null,
) {
  const stateRef = useRef<T>(initValue) as React.MutableRefObject<T>;
  const [, setSpinner] = useState(false);

  const setRefState = useCallback(
    (nextState: T | ((prev: T) => T), triggerRerender = true) => {
      const newState =
        typeof nextState === 'function'
          ? (nextState as Function)(stateRef.current)
          : nextState;
      stateRef.current = newState;
      if (triggerRerender) {
        setSpinner(prev => !prev);
      }
    },
    [],
  );

  return {
    state: stateRef.current,
    stateRef,
    setRefState,
  } as const;
}
