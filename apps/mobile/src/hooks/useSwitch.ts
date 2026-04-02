import { useCallback, useMemo } from 'react';
import { useSafeState } from './useSafeState';

export const useSwitch = (initialState?: boolean) => {
  const [on, setOn] = useSafeState(!!initialState);

  const turnOn = useCallback(() => {
    setOn(true);
  }, [setOn]);

  const turnOff = useCallback(() => {
    setOn(false);
  }, [setOn]);

  const toggle = useCallback(() => {
    setOn(!on);
  }, [on, setOn]);

  return useMemo(
    () => ({
      on: on as boolean,
      turn: setOn,
      turnOff,
      turnOn,
      toggle,
    }),
    [on, setOn, toggle, turnOff, turnOn],
  );
};
