import { useCallback } from 'react';

import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type InnerDappSelectionState = {
  lending: string;
  perps: string;
};

const defaultState: InnerDappSelectionState = {
  lending: 'aave',
  perps: 'hyperliquid',
};

const innerDappSelectionStore = zustandByMMKV<InnerDappSelectionState>(
  '@InnerDappSelection',
  defaultState,
  { storage: MMKVStorageStrategy.compatJson },
);

function setInnerDappSelection(
  valOrFunc: UpdaterOrPartials<InnerDappSelectionState>,
) {
  innerDappSelectionStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function useInnerDappSelection() {
  const lending = innerDappSelectionStore(s => s.lending);
  const perps = innerDappSelectionStore(s => s.perps);

  const setLending = useCallback((id: string) => {
    setInnerDappSelection(prev => ({ ...prev, lending: id }));
  }, []);

  const setPerps = useCallback((id: string) => {
    setInnerDappSelection(prev => ({ ...prev, perps: id }));
  }, []);

  return {
    lending,
    perps,
    setLending,
    setPerps,
  };
}
