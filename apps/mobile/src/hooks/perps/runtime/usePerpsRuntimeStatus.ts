import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { retryPerpsRuntime } from './ensurePerpsRuntime';
import {
  getPerpsRuntimeSnapshot,
  subscribePerpsRuntime,
} from './perpsRuntimeState';

export const usePerpsRuntimeStatus = () => {
  const snapshot = useSyncExternalStore(
    subscribePerpsRuntime,
    getPerpsRuntimeSnapshot,
    getPerpsRuntimeSnapshot,
  );
  const retry = useCallback(() => retryPerpsRuntime(), []);

  return useMemo(
    () => ({
      ...snapshot,
      retry,
    }),
    [retry, snapshot],
  );
};
