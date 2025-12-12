import { useLayoutEffect } from 'react';
import { PerfEventBusListeners, perfEvents } from '@/core/utils/perf';

import { useLendingData } from '@/screens/Lending/hooks';

type TmpRefresherKey = keyof PerfEventBusListeners & `TMP_TRIGGER:${string}`;

export function triggerFetchHomeData<T extends TmpRefresherKey>(
  type: T,
  ...args: Parameters<PerfEventBusListeners[T]>
) {
  perfEvents.emit(type, ...args);
}

export function TmpHomeRefresher() {
  const { fetchData: fetchLendingData } = useLendingData();

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

  return null;
}
