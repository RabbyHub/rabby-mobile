import { PerfEventBusListeners, perfEvents } from '@/core/utils/perf';

type TmpRefresherKey = keyof PerfEventBusListeners & `TMP_TRIGGER:${string}`;

export function triggerFetchHomeData<T extends TmpRefresherKey>(
  type: T,
  ...args: Parameters<PerfEventBusListeners[T]>
) {
  perfEvents.emit(type, ...args);
}

export function TmpHomeRefresher() {
  return null;
}
