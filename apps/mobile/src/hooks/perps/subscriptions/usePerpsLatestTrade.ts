import type { WsTrade } from '@rabby-wallet/hyperliquid-sdk';
import { useEffect, useMemo, useState } from 'react';

import { apisPerps } from '@/core/apis/perps';

import type { PerpsRealtimeStatus } from './usePerpsFastL2';

export type PerpsLatestTrade = {
  coin: string;
  price: string;
  side: 'buy' | 'sell';
  size: string;
  tid: number;
  time: number;
};

type LatestTradeSnapshot = {
  error: Error | null;
  identity: string;
  status: PerpsRealtimeStatus;
  trade: PerpsLatestTrade | null;
};

type LatestTradeListener = (snapshot: LatestTradeSnapshot) => void;

type LatestTradeRegistryEntry = {
  listeners: Set<LatestTradeListener>;
  release: () => void;
  sdk: ReturnType<typeof apisPerps.getPerpsSDK>;
  snapshot: LatestTradeSnapshot;
};

const latestTradeRegistry = new Map<string, LatestTradeRegistryEntry>();

const isLaterTrade = (
  candidate: PerpsLatestTrade,
  current: PerpsLatestTrade | null,
) =>
  !current ||
  candidate.time > current.time ||
  (candidate.time === current.time && candidate.tid > current.tid);

export const selectLatestPerpsTrade = (
  trades: WsTrade[],
  coin: string,
  current: PerpsLatestTrade | null = null,
) =>
  trades.reduce<PerpsLatestTrade | null>((latest, trade) => {
    const price = Number(trade.px);
    const size = Number(trade.sz);
    if (
      trade.coin !== coin ||
      !Number.isFinite(trade.time) ||
      !Number.isFinite(trade.tid) ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(size) ||
      size < 0 ||
      (trade.side !== 'A' && trade.side !== 'B')
    ) {
      return latest;
    }
    const candidate: PerpsLatestTrade = {
      coin,
      price: trade.px,
      side: trade.side === 'B' ? 'buy' : 'sell',
      size: trade.sz,
      tid: trade.tid,
      time: trade.time,
    };
    return isLaterTrade(candidate, latest) ? candidate : latest;
  }, current);

const createLatestTradeRegistryEntry = (
  coin: string,
): LatestTradeRegistryEntry => {
  const sdk = apisPerps.getPerpsSDK();
  const entry: LatestTradeRegistryEntry = {
    listeners: new Set(),
    release: () => undefined,
    sdk,
    snapshot: {
      error: null,
      identity: coin,
      status: 'loading',
      trade: null,
    },
  };
  const publish = (snapshot: LatestTradeSnapshot) => {
    entry.snapshot = snapshot;
    entry.listeners.forEach(listener => listener(snapshot));
  };
  const handleConnectionLoss = () => {
    publish({ error: null, identity: coin, status: 'stale', trade: null });
  };
  const handleOpen = () => {
    publish({ error: null, identity: coin, status: 'loading', trade: null });
  };
  const handleReconnectFailed = () => {
    publish({
      error: new Error('Perps trades reconnect failed'),
      identity: coin,
      status: 'error',
      trade: null,
    });
  };

  sdk.ws.on('close', handleConnectionLoss);
  sdk.ws.on('reconnecting', handleConnectionLoss);
  sdk.ws.on('open', handleOpen);
  sdk.ws.on('reconnectFailed', handleReconnectFailed);

  let unsubscribe: () => void = () => undefined;
  try {
    const subscription = sdk.ws.subscribeToTrades(coin, trades => {
      const trade = selectLatestPerpsTrade(
        trades ?? [],
        coin,
        entry.snapshot.trade,
      );
      if (trade === entry.snapshot.trade) {
        return;
      }
      publish({ error: null, identity: coin, status: 'ready', trade });
    });
    unsubscribe = subscription.unsubscribe;
  } catch (error) {
    publish({
      error:
        error instanceof Error
          ? error
          : new Error('Failed to subscribe to Perps trades'),
      identity: coin,
      status: 'error',
      trade: null,
    });
  }

  entry.release = () => {
    sdk.ws.off('close', handleConnectionLoss);
    sdk.ws.off('reconnecting', handleConnectionLoss);
    sdk.ws.off('open', handleOpen);
    sdk.ws.off('reconnectFailed', handleReconnectFailed);
    try {
      unsubscribe();
    } catch (error) {
      console.error('[usePerpsLatestTrade] unsubscribe failed', error);
    }
  };
  return entry;
};

const subscribeLatestPerpsTrade = (
  coin: string,
  listener: LatestTradeListener,
) => {
  const sdk = apisPerps.getPerpsSDK();
  let entry = latestTradeRegistry.get(coin);
  if (entry && entry.sdk.ws !== sdk.ws) {
    entry.release();
    latestTradeRegistry.delete(coin);
    entry = undefined;
  }
  if (!entry) {
    entry = createLatestTradeRegistryEntry(coin);
    latestTradeRegistry.set(coin, entry);
  }
  entry.listeners.add(listener);
  listener(entry.snapshot);

  return () => {
    const liveEntry = latestTradeRegistry.get(coin);
    if (!liveEntry) {
      return;
    }
    liveEntry.listeners.delete(listener);
    if (liveEntry.listeners.size === 0) {
      liveEntry.release();
      latestTradeRegistry.delete(coin);
    }
  };
};

export const usePerpsLatestTrade = ({
  coin,
  enabled,
}: {
  coin: string;
  enabled: boolean;
}) => {
  const identity = enabled && coin ? coin : 'disabled';
  const [snapshot, setSnapshot] = useState<LatestTradeSnapshot>({
    error: null,
    identity,
    status: identity === 'disabled' ? 'idle' : 'loading',
    trade: null,
  });

  useEffect(() => {
    setSnapshot({
      error: null,
      identity,
      status: identity === 'disabled' ? 'idle' : 'loading',
      trade: null,
    });
    if (identity === 'disabled') {
      return;
    }
    return subscribeLatestPerpsTrade(coin, setSnapshot);
  }, [coin, identity]);

  return useMemo(
    () =>
      snapshot.identity === identity
        ? snapshot
        : {
            error: null,
            identity,
            status:
              identity === 'disabled'
                ? ('idle' as const)
                : ('loading' as const),
            trade: null,
          },
    [identity, snapshot],
  );
};
