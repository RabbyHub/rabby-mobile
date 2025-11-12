import { atomByMMKV } from '@/core/storage/mmkv';
import { useAtom } from 'jotai';
import { useCallback } from 'react';

type Guidances = {
  multiTabs20251111Viewed: boolean;
};
const guidancePersistedAtom = atomByMMKV<Guidances>('@homeGuidance', {
  multiTabs20251111Viewed: true,
});

export function useGuidanceShown() {
  const [guidance, setGuidance] = useAtom(guidancePersistedAtom);

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
    [setGuidance],
  );

  return {
    multiTabs20251111Viewed: guidance.multiTabs20251111Viewed,
    toggleViewedGuidance,
  };
}
