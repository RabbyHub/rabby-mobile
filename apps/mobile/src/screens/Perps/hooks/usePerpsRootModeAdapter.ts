import {
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  createPerpsRootModeAdapter,
  type PerpsRootModePreferenceSource,
} from './perpsRootModeAdapter';

/** Mount below the hydrated preference gate, not on its temporary Simple value. */
export function usePerpsRootModeAdapter(source: PerpsRootModePreferenceSource) {
  const [adapter] = useState(() => createPerpsRootModeAdapter(source));
  const snapshot = useSyncExternalStore(
    adapter.subscribe,
    adapter.getSnapshot,
    adapter.getSnapshot,
  );
  useLayoutEffect(() => {
    adapter.setActive(true);
    return () => adapter.setActive(false);
  }, [adapter]);
  return useMemo(
    () => ({
      ...snapshot,
      requestMode: adapter.requestMode,
      onSettled: adapter.onSettled,
    }),
    [adapter, snapshot],
  );
}
