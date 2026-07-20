import { useIsFocused } from '@react-navigation/native';
import { useStoreWithEqualityFn } from 'zustand/traditional';

import { perpsStore } from './usePerpsStore';

type PerpsState = ReturnType<typeof perpsStore.getState>;

const inactivePerpsStore = {
  getState: perpsStore.getState,
  getInitialState: perpsStore.getInitialState,
  subscribe: (() => () => {}) as typeof perpsStore.subscribe,
};

export function useFocusedPerpsStore<Selected>(
  selector: (state: PerpsState) => Selected,
  equalityFn: (left: Selected, right: Selected) => boolean = Object.is,
) {
  const isFocused = useIsFocused();

  return useStoreWithEqualityFn(
    isFocused ? perpsStore : inactivePerpsStore,
    selector,
    equalityFn,
  );
}
