import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';

// A single process-local presentation clock, retained only by visible TWAP
// duration cells. Quotes, trading inputs and parent scenes do not subscribe.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let appSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
const sync = (state: string) => {
  if (timer) clearInterval(timer);
  timer = undefined;
  if (state !== 'active' || !listeners.size) return;
  const tick = () => {
    now = Date.now();
    listeners.forEach(listener => listener());
  };
  tick();
  timer = setInterval(tick, 1000);
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    appSubscription = AppState.addEventListener('change', sync);
    sync(AppState.currentState);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      if (timer) clearInterval(timer);
      timer = undefined;
      appSubscription?.remove();
      appSubscription = undefined;
    }
  };
};
const inactiveSubscribe = () => () => {};
const snapshot = () => now;
export const usePerpsProTwapClock = (enabled: boolean) => {
  const scope = useStoreActivityScope();
  const pageActive = useSyncExternalStore(
    scope.subscribe,
    scope.getActive,
    scope.getActive,
  );
  return useSyncExternalStore(
    enabled && pageActive ? subscribe : inactiveSubscribe,
    snapshot,
    snapshot,
  );
};
