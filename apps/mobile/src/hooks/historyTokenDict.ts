import { useCallback } from 'react';
import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

const historyTimeStore = zustandByMMKV<Record<string, number>>(
  '@HistoryTimeDictV3',
  {},
  { storage: MMKVStorageStrategy.compatJson },
);

const historyLoadingStore = zustandByMMKV<Record<string, boolean>>(
  '@historyLoadingDict',
  {},
  { storage: MMKVStorageStrategy.compatJson },
);

export const updateHistoryTimeSingleAddress = (add: string, time?: number) => {
  historyTimeStore.setState(prev => ({
    ...prev,
    [add.toLowerCase()]: time || Date.now(),
  }));
};

export const resetUpdateHistoryTime = () => {
  historyTimeStore.setState({}, true);
};

const setHistoryLoading = (
  valOrFunc: UpdaterOrPartials<Record<string, boolean>>,
) => {
  historyLoadingStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    return newVal;
  }, true);
};

export const useHistoryLoading = () => {
  return historyLoadingStore(s => s);
};

export function useHistoryTokenDict() {
  const updateHistoryTime = historyTimeStore(s => s);

  return {
    resetUpdateHistoryTime,
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
    setHistoryLoading,
  };
}
