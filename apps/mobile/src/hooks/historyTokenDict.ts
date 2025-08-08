import { useCallback } from 'react';
import { useAtom } from 'jotai';
import {
  atomByMMKV,
  MMKVStorageStrategy,
  removeLegacyMMKVStorageByKey,
} from '@/core/storage/mmkv';

const historyTimeBase = atomByMMKV<Record<string, number>>(
  '@HistoryTimeDictV3',
  {} as Record<string, number>,
  { storage: MMKVStorageStrategy.compatJson },
);

const historyLoadingDict = atomByMMKV<Record<string, boolean>>(
  '@historyLoadingDict',
  {} as Record<string, boolean>,
  { storage: MMKVStorageStrategy.compatJson },
);

(() => {
  setTimeout(() => {
    removeLegacyMMKVStorageByKey('@HistoryTokenDict');
    removeLegacyMMKVStorageByKey('@HistoryProjectDict');
    removeLegacyMMKVStorageByKey('@historyEnsureNoDataDict');
  }, 1000);
})();

export function useHistoryTokenDict() {
  const [updateHistoryTime, setUpdateHistoryTime] = useAtom(historyTimeBase);
  const [historyLoading, setHistoryLoading] = useAtom(historyLoadingDict);

  const updateHistoryTimeSingleAddress = (add: string, time?: number) => {
    setUpdateHistoryTime(prev => ({
      ...prev,
      [add.toLowerCase()]: time || Date.now(),
    }));
  };

  const resetUpdateHistoryTime = useCallback(() => {
    setUpdateHistoryTime({});
  }, [setUpdateHistoryTime]);

  return {
    resetUpdateHistoryTime,
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
    historyLoading,
    setHistoryLoading,
  };
}
