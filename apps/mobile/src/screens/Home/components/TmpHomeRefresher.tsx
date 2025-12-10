import { useLayoutEffect } from 'react';
import { PerfEventBusListeners, perfEvents } from '@/core/utils/perf';
import { useAccountInfo } from '@/screens/Address/components/MultiAssets/hooks';

import { useLendingData } from '@/screens/Lending/hooks';
import { useSyncHistoryDB } from '@/databases/hooks/history';

type TmpRefresherKey = keyof PerfEventBusListeners & `TMP_TRIGGER:${string}`;

export function triggerFetchHomeData<T extends TmpRefresherKey>(
  type: T,
  ...args: Parameters<PerfEventBusListeners[T]>
) {
  perfEvents.emit(type, ...args);
}

export function TmpHomeRefresher() {
  const { top10Addresses } = useAccountInfo();

  const { fetchData: fetchLendingData } = useLendingData();
  const { syncTop10History } = useSyncHistoryDB(top10Addresses);

  useLayoutEffect(() => {
    const subscription = perfEvents.subscribe(
      'TMP_TRIGGER:FETCH_LENDING_DATA',
      () => {
        fetchLendingData();
      },
    );
    return () => {
      subscription.remove();
    };
  }, [fetchLendingData]);

  useLayoutEffect(() => {
    const subscription = perfEvents.subscribe(
      'TMP_TRIGGER:SYNC_TOP10_HISTORY',
      (force = false) => {
        syncTop10History(force);
      },
    );
    return () => {
      subscription.remove();
    };
  }, [syncTop10History]);

  return null;
}
