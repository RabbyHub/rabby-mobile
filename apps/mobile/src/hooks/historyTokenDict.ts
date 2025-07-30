import { useCallback } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { atomByMMKV } from '@/core/storage/mmkv';

const historyTimeBase = atomByMMKV<Record<string, number>>(
  '@HistoryTimeDictV3',
  {} as Record<string, number>,
);

const historyLoadingDict = atomByMMKV<Record<string, boolean>>(
  '@historyLoadingDict',
  {} as Record<string, boolean>,
);

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
