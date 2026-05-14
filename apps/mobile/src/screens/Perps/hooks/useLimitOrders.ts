import { useMemo } from 'react';
import { sortBy } from 'lodash';
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
  const openOrders = perpsStore(s => s.openOrders);

  const limits = useMemo(
    () => (openOrders || []).filter(isLimitOrder),
    [openOrders],
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
        ? computeMarginUsage(order.limitPx, order.origSz, lev.value)
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
  const openOrders = perpsStore(s => s.openOrders);
  return useMemo(() => {
    const list = (openOrders || [])
      .filter(o => o.coin === coin && isLimitOrder(o))
      .map(order => ({
        order,
        leverage,
        marginUsage: leverage
          ? computeMarginUsage(order.limitPx, order.origSz, leverage.value)
          : 0,
      }));
    return sortBy(list, r => -r.marginUsage);
  }, [openOrders, coin, leverage]);
};
