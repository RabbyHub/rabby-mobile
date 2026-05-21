import { useMemo } from 'react';
import { sortBy } from 'lodash';
import { useShallow } from 'zustand/react/shallow';
import { OpenOrder, Leverage } from '@rabby-wallet/hyperliquid-sdk';
import { perpsStore, PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useActiveAssetDataMap } from '@/hooks/perps/useActiveAssetDataCache';
import { isLimitOrder, computeMarginUsage } from '@/utils/perps';

export type LimitOrderRow = {
  order: OpenOrder;
  leverage: Leverage | null;
  marginUsage: number; // 0 when leverage unknown
};

// Position leverage is reused when available to avoid a REST round-trip.
export const useHomeLimitOrders = (
  positionAndOpenOrders?: PositionAndOpenOrder[],
): LimitOrderRow[] => {
  // Filter inside the selector + shallow-eq the result so non-limit-order
  // updates (e.g. market-order fills) don't propagate to consumers.
  const limits = perpsStore(
    useShallow(s => (s.openOrders || []).filter(isLimitOrder)),
  );

  const positionLevByCoin = useMemo(() => {
    const map: Record<string, Leverage> = {};
    (positionAndOpenOrders || []).forEach(p => {
      map[p.position.coin] = p.position.leverage;
    });
    return map;
  }, [positionAndOpenOrders]);

  const coinsNeedFetch = useMemo(() => {
    const set = new Set<string>();
    limits.forEach(o => {
      if (!positionLevByCoin[o.coin]) {
        set.add(o.coin);
      }
    });
    return Array.from(set);
  }, [limits, positionLevByCoin]);

  const fetchedMap = useActiveAssetDataMap(coinsNeedFetch);

  return useMemo<LimitOrderRow[]>(() => {
    const list = limits.map(order => {
      const lev =
        positionLevByCoin[order.coin] ??
        fetchedMap[order.coin]?.leverage ??
        null;
      const marginUsage = lev
        ? computeMarginUsage(order.limitPx, order.sz, lev.value)
        : 0;
      return { order, leverage: lev, marginUsage };
    });
    return sortBy(list, r => -r.marginUsage);
  }, [limits, positionLevByCoin, fetchedMap]);
};

// Detail screen passes leverage directly from the WS subscription.
export const useDetailLimitOrders = (
  coin: string,
  leverage: Leverage | null,
): LimitOrderRow[] => {
  // Filter to this coin's limit orders inside the selector + shallow-eq so
  // updates on other coins don't cascade into this consumer.
  const coinLimitOrders = perpsStore(
    useShallow(s =>
      (s.openOrders || []).filter(o => o.coin === coin && isLimitOrder(o)),
    ),
  );
  return useMemo(() => {
    const list = coinLimitOrders.map(order => ({
      order,
      leverage,
      marginUsage: leverage
        ? computeMarginUsage(order.limitPx, order.sz, leverage.value)
        : 0,
    }));
    return sortBy(list, r => -r.marginUsage);
  }, [coinLimitOrders, leverage]);
};
