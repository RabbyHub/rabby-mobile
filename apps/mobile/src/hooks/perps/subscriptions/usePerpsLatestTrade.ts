import type { WsTrade } from '@rabby-wallet/hyperliquid-sdk';
import { useMemo } from 'react';

import { apisPerps } from '@/core/apis/perps';

import { PERPS_FAST_L2_DISPLAY_CACHE_MS } from './usePerpsFastL2';
import {
  usePerpsRealtimePublication,
  type PerpsRealtimeStatus,
} from './usePerpsRealtimePublication';

const MAX_LATEST_TRADE_CACHE_ENTRIES = 4;

export type PerpsLatestTrade = {
  coin: string;
  price: string;
  side: 'buy' | 'sell';
  size: string;
  tid: number;
  time: number;
};

export type LatestTradeSnapshot = {
  error: Error | null;
  identity: string;
  receivedAt: number | null;
  revision: number;
  status: PerpsRealtimeStatus;
  trade: PerpsLatestTrade | null;
};

type LatestTradeListener = (snapshot: LatestTradeSnapshot) => void;
type PerpsSdk = ReturnType<typeof apisPerps.getPerpsSDK>;

type LatestTradeRegistryEntry = {
  active: boolean;
  listeners: Set<LatestTradeListener>;
  release: () => void;
  sdk: PerpsSdk;
  snapshot: LatestTradeSnapshot;
};

type LatestTradeCacheEntry = {
  coin: string;
  receivedAt: number;
  revision: number;
  trade: PerpsLatestTrade;
  ws: PerpsSdk['ws'];
};

const latestTradeRegistry = new Map<string, LatestTradeRegistryEntry>();
const latestTradeCache = new Map<string, LatestTradeCacheEntry>();

const isFresh = (receivedAt: number | null, now = Date.now()) =>
  receivedAt != null && now - receivedAt < PERPS_FAST_L2_DISPLAY_CACHE_MS;

const peekLatestTradeCache = (
  coin: string,
  ws: PerpsSdk['ws'],
): LatestTradeCacheEntry | null => {
  const cached = latestTradeCache.get(coin);
  return cached?.ws === ws && isFresh(cached.receivedAt) ? cached : null;
};

const readLatestTradeCache = (
  coin: string,
  ws: PerpsSdk['ws'],
): LatestTradeCacheEntry | null => {
  const cached = peekLatestTradeCache(coin, ws);
  if (!cached) {
    latestTradeCache.delete(coin);
    return null;
  }
  latestTradeCache.delete(coin);
  latestTradeCache.set(coin, cached);
  return cached;
};

const writeLatestTradeCache = (
  entry: LatestTradeRegistryEntry,
  trade: PerpsLatestTrade,
  receivedAt: number,
  revision: number,
) => {
  latestTradeCache.delete(entry.snapshot.identity);
  latestTradeCache.set(entry.snapshot.identity, {
    coin: entry.snapshot.identity,
    receivedAt,
    revision,
    trade,
    ws: entry.sdk.ws,
  });
  while (latestTradeCache.size > MAX_LATEST_TRADE_CACHE_ENTRIES) {
    const oldestCoin = latestTradeCache.keys().next().value;
    if (!oldestCoin) {
      break;
    }
    latestTradeCache.delete(oldestCoin);
  }
};

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

const publishLatestTrade = (
  entry: LatestTradeRegistryEntry,
  snapshot: LatestTradeSnapshot,
) => {
  if (!entry.active) {
    return;
  }
  entry.snapshot = snapshot;
  entry.listeners.forEach(listener => listener(snapshot));
};

const retainFreshTrade = (
  entry: LatestTradeRegistryEntry,
): Pick<LatestTradeSnapshot, 'receivedAt' | 'revision' | 'trade'> => {
  if (entry.snapshot.trade && isFresh(entry.snapshot.receivedAt)) {
    return {
      receivedAt: entry.snapshot.receivedAt,
      revision: entry.snapshot.revision,
      trade: entry.snapshot.trade,
    };
  }
  const cached = readLatestTradeCache(entry.snapshot.identity, entry.sdk.ws);
  return cached
    ? {
        receivedAt: cached.receivedAt,
        revision: cached.revision,
        trade: cached.trade,
      }
    : {
        receivedAt: null,
        revision: entry.snapshot.revision,
        trade: null,
      };
};

const createLatestTradeRegistryEntry = (
  coin: string,
): LatestTradeRegistryEntry => {
  const sdk = apisPerps.getPerpsSDK();
  const cached = readLatestTradeCache(coin, sdk.ws);
  const entry: LatestTradeRegistryEntry = {
    active: true,
    listeners: new Set(),
    release: () => undefined,
    sdk,
    snapshot: cached
      ? {
          error: null,
          identity: coin,
          receivedAt: cached.receivedAt,
          revision: cached.revision,
          status: 'stale',
          trade: cached.trade,
        }
      : {
          error: null,
          identity: coin,
          receivedAt: null,
          revision: 0,
          status: 'loading',
          trade: null,
        },
  };
  const publishConnectionState = (status: 'loading' | 'stale') => {
    const retained = retainFreshTrade(entry);
    publishLatestTrade(entry, {
      ...retained,
      error: null,
      identity: coin,
      status,
    });
  };
  const handleConnectionLoss = () => publishConnectionState('stale');
  const handleOpen = () => publishConnectionState('loading');
  const handleReconnectFailed = () => {
    latestTradeCache.delete(coin);
    publishLatestTrade(entry, {
      error: new Error('Perps trades reconnect failed'),
      identity: coin,
      receivedAt: null,
      revision: entry.snapshot.revision,
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
      if (!entry.active) {
        return;
      }
      const candidate = selectLatestPerpsTrade(trades ?? [], coin);
      if (!candidate) {
        return;
      }
      const trade = isLaterTrade(candidate, entry.snapshot.trade)
        ? candidate
        : entry.snapshot.trade ?? candidate;
      const receivedAt = Date.now();
      const revision = entry.snapshot.revision + 1;
      writeLatestTradeCache(entry, trade, receivedAt, revision);
      publishLatestTrade(entry, {
        error: null,
        identity: coin,
        receivedAt,
        revision,
        status: 'ready',
        trade,
      });
    });
    unsubscribe = subscription.unsubscribe;
  } catch (error) {
    publishLatestTrade(entry, {
      error:
        error instanceof Error
          ? error
          : new Error('Failed to subscribe to Perps trades'),
      identity: coin,
      receivedAt: null,
      revision: entry.snapshot.revision,
      status: 'error',
      trade: null,
    });
  }

  entry.release = () => {
    if (!entry.active) {
      return;
    }
    entry.active = false;
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

const getLatestTradeRegistryEntry = (coin: string) => {
  const sdk = apisPerps.getPerpsSDK();
  let entry = latestTradeRegistry.get(coin);
  if (entry && entry.sdk.ws !== sdk.ws) {
    entry.release();
    latestTradeRegistry.delete(coin);
    latestTradeCache.delete(coin);
    entry = undefined;
  }
  if (!entry) {
    entry = createLatestTradeRegistryEntry(coin);
    latestTradeRegistry.set(coin, entry);
  }
  return entry;
};

const subscribeLatestPerpsTrade = (
  coin: string,
  listener: LatestTradeListener,
) => {
  const entry = getLatestTradeRegistryEntry(coin);
  entry.listeners.add(listener);
  listener(entry.snapshot);

  return () => {
    const liveEntry = latestTradeRegistry.get(coin);
    if (!liveEntry || liveEntry !== entry) {
      return;
    }
    liveEntry.listeners.delete(listener);
    if (liveEntry.listeners.size === 0) {
      liveEntry.release();
      latestTradeRegistry.delete(coin);
    }
  };
};

export const subscribeToPerpsLatestTrade = (
  coin: string,
  listener: LatestTradeListener,
) => subscribeLatestPerpsTrade(coin, listener);

const readLatestTradeSnapshot = (coin: string): LatestTradeSnapshot => {
  const sdk = apisPerps.getPerpsSDK();
  const liveEntry = latestTradeRegistry.get(coin);
  if (liveEntry?.sdk.ws === sdk.ws) {
    return liveEntry.snapshot;
  }
  const cached = readLatestTradeCache(coin, sdk.ws);
  return cached
    ? {
        error: null,
        identity: coin,
        receivedAt: cached.receivedAt,
        revision: cached.revision,
        status: 'stale',
        trade: cached.trade,
      }
    : {
        error: null,
        identity: coin,
        receivedAt: null,
        revision: 0,
        status: 'loading',
        trade: null,
      };
};

const peekLatestTradeSnapshot = (coin: string): LatestTradeSnapshot => {
  const sdk = apisPerps.getPerpsSDKSnapshot();
  if (!sdk) {
    return {
      error: null,
      identity: coin,
      receivedAt: null,
      revision: 0,
      status: 'loading',
      trade: null,
    };
  }
  const liveEntry = latestTradeRegistry.get(coin);
  if (liveEntry?.sdk.ws === sdk.ws) {
    return liveEntry.snapshot;
  }
  const cached = peekLatestTradeCache(coin, sdk.ws);
  return cached
    ? {
        error: null,
        identity: coin,
        receivedAt: cached.receivedAt,
        revision: cached.revision,
        status: 'stale',
        trade: cached.trade,
      }
    : {
        error: null,
        identity: coin,
        receivedAt: null,
        revision: 0,
        status: 'loading',
        trade: null,
      };
};

export const prewarmPerpsLatestTrade = ({
  coin,
  timeoutMs = 1500,
}: {
  coin: string;
  timeoutMs?: number;
}) => {
  let detached = false;
  let detach: (() => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const finish = () => {
    if (detached) {
      return;
    }
    detached = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    detach?.();
  };
  detach = subscribeLatestPerpsTrade(coin, snapshot => {
    if (snapshot.status === 'ready' && snapshot.trade) {
      finish();
    }
  });
  if (detached) {
    detach();
  } else {
    timeoutId = setTimeout(finish, Math.max(0, timeoutMs));
  }
  return finish;
};

const disabledLatestTradeSnapshot = (): LatestTradeSnapshot => ({
  error: null,
  identity: 'disabled',
  receivedAt: null,
  revision: 0,
  status: 'idle',
  trade: null,
});

const loadingLatestTradeSnapshot = (identity: string): LatestTradeSnapshot => ({
  error: null,
  identity,
  receivedAt: null,
  revision: 0,
  status: 'loading',
  trade: null,
});

const hasLatestTradeValue = (snapshot: LatestTradeSnapshot) => !!snapshot.trade;
const clearLatestTradeValue = (
  snapshot: LatestTradeSnapshot,
): LatestTradeSnapshot => ({
  ...snapshot,
  receivedAt: null,
  trade: null,
});

export const usePerpsLatestTrade = ({
  coin,
  enabled,
  publicationEnabled = enabled,
}: {
  coin: string;
  enabled: boolean;
  publicationEnabled?: boolean;
}) => {
  const identity = enabled && coin ? coin : 'disabled';
  const readSnapshot = useMemo(
    () => () => readLatestTradeSnapshot(coin),
    [coin],
  );
  const peekSnapshot = useMemo(
    () => () => peekLatestTradeSnapshot(coin),
    [coin],
  );
  const subscribe = useMemo(
    () =>
      identity === 'disabled'
        ? null
        : (listener: LatestTradeListener) =>
            subscribeLatestPerpsTrade(coin, listener),
    [coin, identity],
  );

  return usePerpsRealtimePublication({
    clearValue: clearLatestTradeValue,
    createDisabledSnapshot: disabledLatestTradeSnapshot,
    createLoadingSnapshot: loadingLatestTradeSnapshot,
    displayCacheMs: PERPS_FAST_L2_DISPLAY_CACHE_MS,
    hasValue: hasLatestTradeValue,
    identity,
    peekSnapshot,
    publicationEnabled,
    readSnapshot,
    subscribe,
  });
};

export const resetPerpsLatestTradeRegistryForTests = () => {
  latestTradeRegistry.forEach(entry => entry.release());
  latestTradeRegistry.clear();
  latestTradeCache.clear();
};
