import { useCallback } from 'react';

import { zustandByMMKV } from '@/core/storage/mmkv';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type Guidances = {
  multiTabs20251205Viewed: boolean;
};

export const guidancePersistedStore = zustandByMMKV<Guidances>(
  '@homeGuidance',
  {
    multiTabs20251205Viewed: false,
  },
);

function setGuidance(valOrFunc: UpdaterOrPartials<Guidances>) {
  guidancePersistedStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function useGuidanceShown() {
  const multiTabs20251205Viewed = guidancePersistedStore(
    s => s.multiTabs20251205Viewed,
  );

  const toggleViewedGuidance = useCallback(
    (k: keyof Guidances, nextVal?: boolean) => {
      setGuidance(prev => {
        nextVal = nextVal ?? !prev[k];
        return {
          ...prev,
          [k]: nextVal,
        };
      });
    },
    [],
  );

  return {
    multiTabs20251205Viewed,
    toggleViewedGuidance,
  };
}
