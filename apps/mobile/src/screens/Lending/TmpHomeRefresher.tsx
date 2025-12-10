import { useLayoutEffect } from 'react';
import { useLendingData } from './hooks';
import { perfEvents } from '@/core/utils/perf';

export function triggerFetchLendingData() {
  perfEvents.emit('TMP_TRIGGER_FETCH_LENDING_DATA');
}

export function TmpHomeRefresher() {
  const { fetchData: fetchLendingData } = useLendingData();

  useLayoutEffect(() => {
    const subscription = perfEvents.subscribe(
      'TMP_TRIGGER_FETCH_LENDING_DATA',
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
