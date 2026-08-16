import { perpsViewModeController } from '@/hooks/perps/viewMode/perpsViewModeController';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

export {
  createPerpsViewModeController,
  preparePerpsViewMode,
} from '@/hooks/perps/viewMode/perpsViewModeController';
export type {
  PerpsViewModeController,
  PerpsViewModeSnapshot,
} from '@/hooks/perps/viewMode/perpsViewModeController';

export const usePerpsViewMode = () => {
  const snapshot = useSyncExternalStore(
    perpsViewModeController.subscribe,
    perpsViewModeController.getSnapshot,
    perpsViewModeController.getSnapshot,
  );

  useEffect(() => {
    void perpsViewModeController.hydrate();
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      setViewMode: perpsViewModeController.setViewMode,
    }),
    [snapshot],
  );
};
