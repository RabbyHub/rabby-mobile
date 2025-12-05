import { appStorageForZustand, atomByMMKV } from '@/core/storage/mmkv';
import { zCreate, zCreateJSONStorage, zPersist } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useAtom } from 'jotai';
import { useCallback } from 'react';

type Guidances = {
  multiTabs20251205Viewed: boolean;
};
// const guidancePersistedAtom = atomByMMKV<Guidances>('@homeGuidance', {
//   multiTabs20251205Viewed: true,
// });

export const guidancePersistedStore = zCreate(
  zPersist<Guidances>(
    (set, get) => ({
      multiTabs20251205Viewed: false,
    }),
    {
      name: '@homeGuidance',
      storage: zCreateJSONStorage(() => appStorageForZustand),
    },
  ),
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
  // const [guidance, setGuidance] = useAtom(guidancePersistedAtom);
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
