import { useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

import type {
  ReadonlyStoreApi,
  StoreActivityScope,
} from '@/core/state/storeActivity';
import { perpsStore, type PerpsState } from '@/hooks/perps/usePerpsStore';
import { useStoreActivityScope } from '@/hooks/storeActivity/StoreActivityProvider';

import { resolvePerpsProMarketPresentation } from '../model/market';

// The position cards derive their mark price, liquidation distance and the
// position TP/SL summary from the live mark. At tick speed that re-renders the
// whole card (dozens of text nodes plus the dotted-underline measurement) many
// times per second. Keep the existing event-driven 500ms display window,
// but own its snapshot per consumer instead of mutating a shared coin cache
// from a selector (which may receive an inactive page's older source state).
const MARK_SNAPSHOT_THROTTLE_MS = 500;
type PerpsProPositionMarkSnapshot = ReturnType<
  typeof resolvePerpsProMarketPresentation
> & {
  markPrice: string | null;
  pxDecimals: number | undefined;
};

const selectPositionMark = (
  state: PerpsState,
  coin: string,
): PerpsProPositionMarkSnapshot => {
  const market = state.marketDataMap[coin];
  return {
    ...resolvePerpsProMarketPresentation(coin, market),
    markPrice: market?.markPx || null,
    pxDecimals: market?.pxDecimals,
  };
};

const createPositionMarkDisplayStore = (
  source: ReadonlyStoreApi<PerpsState>,
  scope: StoreActivityScope,
  coin: string,
): ReadonlyStoreApi<PerpsProPositionMarkSnapshot> => {
  let snapshot = selectPositionMark(source.getState(), coin);
  let sampledAt = Date.now();
  const listeners = new Set<
    Parameters<ReadonlyStoreApi<PerpsProPositionMarkSnapshot>['subscribe']>[0]
  >();
  let unsubscribeSource: (() => void) | undefined;
  let unsubscribeActivity: (() => void) | undefined;

  const update = (force: boolean) => {
    if (!scope.getActive()) {
      return;
    }
    const next = selectPositionMark(source.getState(), coin);
    const now = Date.now();
    if (
      !force &&
      now - sampledAt < MARK_SNAPSHOT_THROTTLE_MS &&
      snapshot.markPrice != null &&
      next.markPrice != null
    ) {
      return;
    }
    sampledAt = now;
    if (shallow(snapshot, next)) {
      return;
    }
    const previous = snapshot;
    snapshot = next;
    listeners.forEach(listener => listener(snapshot, previous));
  };

  return {
    getState: () => snapshot,
    getInitialState: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      if (listeners.size === 1) {
        // Register the bound source first: on activation its snapshot catches
        // up before our activity listener bypasses the display window. This
        // also refreshes a suppressed pre-blur tick when no hidden tick arrived.
        unsubscribeSource = source.subscribe(() => update(false));
        unsubscribeActivity = scope.subscribe(() => update(true));
        update(true);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeSource?.();
          unsubscribeActivity?.();
          unsubscribeSource = undefined;
          unsubscribeActivity = undefined;
        }
      };
    },
  };
};

export const usePerpsProPositionMark = (coin: string) => {
  const scope = useStoreActivityScope();
  // Bind the shared source, not each leaf adapter: scopes retain their bound
  // stores, including the always-active fallback outside a page boundary.
  const source = scope.bindStore(perpsStore);
  const displayStore = useMemo(
    () => createPositionMarkDisplayStore(source, scope, coin),
    [coin, scope, source],
  );
  return useStoreWithEqualityFn(displayStore);
};
