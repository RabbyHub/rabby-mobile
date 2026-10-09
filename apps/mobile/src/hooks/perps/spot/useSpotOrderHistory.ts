import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  UserHistoricalOrders,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';

import { apisPerps } from '@/core/apis/perps';

import type { SpotMarket } from './spotMarkets';
import { buildSpotOrderHistoryItems } from './spotOrderHistory';

type HistorySnapshot = {
  address: string;
  history: UserHistoricalOrders[];
  fills: WsFill[];
};

/**
 * Closed spot orders, fetched once when `enabled` turns on and on `reload`.
 * Not polled: both endpoints return up to 2000 rows for the whole account.
 */
export const useSpotOrderHistory = ({
  address,
  markets,
  enabled,
}: {
  address: string | undefined;
  markets: SpotMarket[];
  enabled: boolean;
}) => {
  const [snapshot, setSnapshot] = useState<HistorySnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!address) {
      return;
    }
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setIsError(false);
    try {
      const sdk = apisPerps.getPerpsSDK();
      const [history, fills] = await Promise.all([
        sdk.info.getUserHistoricalOrders(address),
        // Fills only add the average price; the list still works without.
        sdk.info.getUserFills(address).catch(() => [] as WsFill[]),
      ]);
      if (requestId === requestIdRef.current) {
        setSnapshot({ address, history: history ?? [], fills: fills ?? [] });
      }
    } catch (error) {
      console.error('[perpsSpot] order history fetch failed', error);
      if (requestId === requestIdRef.current) {
        setIsError(true);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [address]);

  useEffect(() => {
    if (enabled) {
      reload();
    }
  }, [enabled, reload]);

  const current = snapshot && snapshot.address === address ? snapshot : null;
  const items = useMemo(
    () =>
      current
        ? buildSpotOrderHistoryItems(current.history, current.fills, markets)
        : [],
    [current, markets],
  );

  return {
    items,
    isLoading: isLoading && !current,
    isRefreshing: isLoading && !!current,
    isError: isError && !current,
    reload,
  };
};
