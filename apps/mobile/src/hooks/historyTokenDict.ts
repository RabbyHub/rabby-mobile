import { useCallback } from 'react';
import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

export const historyTimeStore = zustandByMMKV<Record<string, number>>(
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
    // 0 means reset, so the next sync is not throttled
    [add.toLowerCase()]: time ?? Date.now(),
  }));
};

// last time (ms) the recent tx count was compared with the server, per address
export const historyTxCountCheckStore = zustandByMMKV<Record<string, number>>(
  '@HistoryTxCountCheckTime',
  {},
  { storage: MMKVStorageStrategy.compatJson },
);

export const markHistoryTxCountChecked = (add: string) => {
  historyTxCountCheckStore.setState(prev => ({
    ...prev,
    [add.toLowerCase()]: Date.now(),
  }));
};

/**
 * Time range (seconds) of local history known to be complete per address:
 * every tx with `from <= time_at <= to` has been written to the DB. `to` is the
 * newest synced tx, or `from` when the address had none.
 */
export type HistorySyncCoverage = { from: number; to: number };

export const historySyncCoverageStore = zustandByMMKV<
  Record<string, HistorySyncCoverage>
>('@HistorySyncCoverage', {}, { storage: MMKVStorageStrategy.compatJson });

export const setHistorySyncCoverage = (
  add: string,
  coverage: HistorySyncCoverage | null,
) => {
  historySyncCoverageStore.setState(prev => {
    const next = { ...prev };
    if (coverage) {
      next[add.toLowerCase()] = coverage;
    } else {
      delete next[add.toLowerCase()];
    }
    return next;
  }, true);
};

export const resetUpdateHistoryTime = () => {
  historyTimeStore.setState({}, true);
  historyTxCountCheckStore.setState({}, true);
  historySyncCoverageStore.setState({}, true);
};

export const setHistoryLoading = (
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
