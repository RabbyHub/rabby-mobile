import { useCallback } from 'react';
import {
  MMKVStorageStrategy,
  removeLegacyMMKVStorageByKey,
  zustandByMMKV,
} from '@/core/storage/mmkv';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';

const historyTimeBase = zustandByMMKV<Record<string, number>>(
  '@HistoryTimeDictV3',
  {} as Record<string, number>,
  { storage: MMKVStorageStrategy.compatJson },
);

function setUpdateHistoryTime(
  valOrFunc: UpdaterOrPartials<Record<string, number>>,
) {
  return historyTimeBase.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

const historyLoadingDict = zustandByMMKV<Record<string, boolean>>(
  '@historyLoadingDict',
  {} as Record<string, boolean>,
  { storage: MMKVStorageStrategy.compatJson },
);

function setHistoryLoading(
  valOrFunc: UpdaterOrPartials<Record<string, boolean>>,
) {
  return historyLoadingDict.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });

    if (!changed) return prev;

    return newVal;
  });
}

runIIFEFunc(() => {
  setTimeout(() => {
    removeLegacyMMKVStorageByKey('@HistoryTokenDict');
    removeLegacyMMKVStorageByKey('@HistoryProjectDict');
    removeLegacyMMKVStorageByKey('@historyEnsureNoDataDict');
  }, 1000);
});

const updateHistoryTimeSingleAddress = (add: string, time?: number) => {
  setUpdateHistoryTime(prev => ({
    ...prev,
    [add.toLowerCase()]: time || Date.now(),
  }));
};

const resetUpdateHistoryTime = () => {
  setUpdateHistoryTime({});
};

export function useHistoryTokenDict() {
  const updateHistoryTime = historyTimeBase(s => s);
  const historyLoading = historyLoadingDict(s => s);

  return {
    resetUpdateHistoryTime,
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
    historyLoading,
    setHistoryLoading,
  };
}
