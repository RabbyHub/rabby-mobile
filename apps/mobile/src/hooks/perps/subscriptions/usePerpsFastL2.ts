import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import { useMemo } from 'react';

import { apisPerps } from '@/core/apis/perps';

import type { PerpsBookPrecision } from './perpsBookTypes';
import {
  usePerpsRealtimePublication,
  type PerpsRealtimeStatus,
} from './usePerpsRealtimePublication';

export type { PerpsRealtimeStatus } from './usePerpsRealtimePublication';

export const PERPS_FAST_L2_DISPLAY_CACHE_MS = 3000;
const MAX_FAST_L2_DISPLAY_CACHE_ENTRIES = 4;

export type FastL2Snapshot = {
  book: L2Book | null;
  error: Error | null;
  identity: string;
  receivedAt: number | null;
  revision: number;
  status: PerpsRealtimeStatus;
};

type FastL2Listener = (snapshot: FastL2Snapshot) => void;
type PerpsSdk = ReturnType<typeof apisPerps.getPerpsSDK>;

type FastL2RegistryEntry = {
  active: boolean;
  listeners: Set<FastL2Listener>;
  release: () => void;
  sdk: PerpsSdk;
  snapshot: FastL2Snapshot;
};

type FastL2DisplayCacheEntry = {
  book: L2Book;
  identity: string;
  receivedAt: number;
  revision: number;
  ws: PerpsSdk['ws'];
};

const fastL2Registry = new Map<string, FastL2RegistryEntry>();
const fastL2DisplayCache = new Map<string, FastL2DisplayCacheEntry>();

export const createPerpsFastL2Identity = (
  coin: string,
  precision: PerpsBookPrecision | null,
) =>
  coin && precision
    ? `${coin}:${precision.nSigFigs}:${precision.mantissa ?? 'null'}`
    : 'disabled';

const hasFastL2BookShape = (data: L2Book | null | undefined): data is L2Book =>
  Array.isArray(data?.levels) &&
  Array.isArray(data.levels[0]) &&
  Array.isArray(data.levels[1]);

const isFresh = (receivedAt: number | null, now = Date.now()) =>
  receivedAt != null && now - receivedAt < PERPS_FAST_L2_DISPLAY_CACHE_MS;

const deleteFastL2DisplayCache = (identity: string, ws?: PerpsSdk['ws']) => {
  const cached = fastL2DisplayCache.get(identity);
  if (!cached || (ws && cached.ws !== ws)) {
    return;
  }
  fastL2DisplayCache.delete(identity);
};

const readFastL2DisplayCache = (
  identity: string,
  ws: PerpsSdk['ws'],
): FastL2DisplayCacheEntry | null => {
  const cached = fastL2DisplayCache.get(identity);
  if (!cached) {
    return null;
  }
  if (cached.ws !== ws || !isFresh(cached.receivedAt)) {
    fastL2DisplayCache.delete(identity);
    return null;
  }
  fastL2DisplayCache.delete(identity);
  fastL2DisplayCache.set(identity, cached);
  return cached;
};

const writeFastL2DisplayCache = (
  entry: FastL2RegistryEntry,
  book: L2Book,
  receivedAt: number,
  revision: number,
) => {
  fastL2DisplayCache.delete(entry.snapshot.identity);
  fastL2DisplayCache.set(entry.snapshot.identity, {
    book,
    identity: entry.snapshot.identity,
    receivedAt,
    revision,
    ws: entry.sdk.ws,
  });
  while (fastL2DisplayCache.size > MAX_FAST_L2_DISPLAY_CACHE_ENTRIES) {
    const oldestIdentity = fastL2DisplayCache.keys().next().value;
    if (!oldestIdentity) {
      break;
    }
    fastL2DisplayCache.delete(oldestIdentity);
  }
};

const publishFastL2 = (
  entry: FastL2RegistryEntry,
  snapshot: FastL2Snapshot,
) => {
  if (!entry.active) {
    return;
  }
  entry.snapshot = snapshot;
  entry.listeners.forEach(listener => listener(snapshot));
};

const retainFreshBook = (
  entry: FastL2RegistryEntry,
): Pick<FastL2Snapshot, 'book' | 'receivedAt' | 'revision'> => {
  if (entry.snapshot.book && isFresh(entry.snapshot.receivedAt)) {
    return {
      book: entry.snapshot.book,
      receivedAt: entry.snapshot.receivedAt,
      revision: entry.snapshot.revision,
    };
  }
  const cached = readFastL2DisplayCache(entry.snapshot.identity, entry.sdk.ws);
  return cached
    ? {
        book: cached.book,
        receivedAt: cached.receivedAt,
        revision: cached.revision,
      }
    : {
        book: null,
        receivedAt: null,
        revision: entry.snapshot.revision,
      };
};

const createFastL2RegistryEntry = (
  coin: string,
  precision: PerpsBookPrecision,
  identity: string,
): FastL2RegistryEntry => {
  const sdk = apisPerps.getPerpsSDK();
  const cached = readFastL2DisplayCache(identity, sdk.ws);
  const entry: FastL2RegistryEntry = {
    active: true,
    listeners: new Set(),
    release: () => undefined,
    sdk,
    snapshot: cached
      ? {
          book: cached.book,
          error: null,
          identity,
          receivedAt: cached.receivedAt,
          revision: cached.revision,
          status: 'stale',
        }
      : {
          book: null,
          error: null,
          identity,
          receivedAt: null,
          revision: 0,
          status: 'loading',
        },
  };

  const publishConnectionState = (status: 'loading' | 'stale') => {
    const retained = retainFreshBook(entry);
    publishFastL2(entry, {
      ...retained,
      error: null,
      identity,
      status,
    });
  };
  const handleConnectionLoss = () => publishConnectionState('stale');
  const handleOpen = () => publishConnectionState('loading');
  const handleReconnectFailed = () => {
    deleteFastL2DisplayCache(identity, sdk.ws);
    publishFastL2(entry, {
      book: null,
      error: new Error('Perps order book reconnect failed'),
      identity,
      receivedAt: null,
      revision: entry.snapshot.revision,
      status: 'error',
    });
  };

  sdk.ws.on('close', handleConnectionLoss);
  sdk.ws.on('reconnecting', handleConnectionLoss);
  sdk.ws.on('open', handleOpen);
  sdk.ws.on('reconnectFailed', handleReconnectFailed);

  let unsubscribe: () => void = () => undefined;
  try {
    const subscription = sdk.ws.subscribeToFastL2(
      {
        coin,
        nSigFigs: precision.nSigFigs,
        mantissa: precision.mantissa ?? undefined,
      },
      data => {
        if (!entry.active || !data || data.coin !== coin) {
          return;
        }
        if (!hasFastL2BookShape(data)) {
          const retained = retainFreshBook(entry);
          publishFastL2(entry, {
            ...retained,
            error: new Error('Invalid Perps order book payload'),
            identity,
            status: retained.book ? 'stale' : 'error',
          });
          return;
        }
        const receivedAt = Date.now();
        const revision = entry.snapshot.revision + 1;
        writeFastL2DisplayCache(entry, data, receivedAt, revision);
        publishFastL2(entry, {
          book: data,
          error: null,
          identity,
          receivedAt,
          revision,
          status: 'ready',
        });
      },
    );
    unsubscribe = subscription.unsubscribe;
  } catch (error) {
    publishFastL2(entry, {
      book: null,
      error:
        error instanceof Error
          ? error
          : new Error('Failed to subscribe to Perps order book'),
      identity,
      receivedAt: null,
      revision: entry.snapshot.revision,
      status: 'error',
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
      console.error('[usePerpsFastL2] unsubscribe failed', error);
    }
  };
  return entry;
};

const getFastL2RegistryEntry = (
  coin: string,
  precision: PerpsBookPrecision,
  identity: string,
) => {
  const sdk = apisPerps.getPerpsSDK();
  let entry = fastL2Registry.get(identity);
  if (entry && entry.sdk.ws !== sdk.ws) {
    entry.release();
    fastL2Registry.delete(identity);
    deleteFastL2DisplayCache(identity);
    entry = undefined;
  }
  if (!entry) {
    entry = createFastL2RegistryEntry(coin, precision, identity);
    fastL2Registry.set(identity, entry);
  }
  return entry;
};

const subscribePerpsFastL2 = (
  coin: string,
  precision: PerpsBookPrecision,
  listener: FastL2Listener,
) => {
  const identity = createPerpsFastL2Identity(coin, precision);
  const entry = getFastL2RegistryEntry(coin, precision, identity);
  entry.listeners.add(listener);
  listener(entry.snapshot);

  return () => {
    const liveEntry = fastL2Registry.get(identity);
    if (!liveEntry || liveEntry !== entry) {
      return;
    }
    liveEntry.listeners.delete(listener);
    if (liveEntry.listeners.size === 0) {
      liveEntry.release();
      fastL2Registry.delete(identity);
    }
  };
};

const readPerpsFastL2Snapshot = (
  coin: string,
  precision: PerpsBookPrecision,
): FastL2Snapshot => {
  const identity = createPerpsFastL2Identity(coin, precision);
  const sdk = apisPerps.getPerpsSDK();
  const liveEntry = fastL2Registry.get(identity);
  if (liveEntry?.sdk.ws === sdk.ws) {
    return liveEntry.snapshot;
  }
  const cached = readFastL2DisplayCache(identity, sdk.ws);
  return cached
    ? {
        book: cached.book,
        error: null,
        identity,
        receivedAt: cached.receivedAt,
        revision: cached.revision,
        status: 'stale',
      }
    : {
        book: null,
        error: null,
        identity,
        receivedAt: null,
        revision: 0,
        status: 'loading',
      };
};

export const prewarmPerpsFastL2 = ({
  coin,
  precision,
  timeoutMs = 1500,
}: {
  coin: string;
  precision: PerpsBookPrecision;
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
  detach = subscribePerpsFastL2(coin, precision, snapshot => {
    if (snapshot.status === 'ready' && snapshot.book) {
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

const disabledFastL2Snapshot = (): FastL2Snapshot => ({
  book: null,
  error: null,
  identity: 'disabled',
  receivedAt: null,
  revision: 0,
  status: 'idle',
});

const loadingFastL2Snapshot = (identity: string): FastL2Snapshot => ({
  book: null,
  error: null,
  identity,
  receivedAt: null,
  revision: 0,
  status: 'loading',
});

const hasFastL2Value = (snapshot: FastL2Snapshot) => !!snapshot.book;
const clearFastL2Value = (snapshot: FastL2Snapshot): FastL2Snapshot => ({
  ...snapshot,
  book: null,
  receivedAt: null,
});

export const usePerpsFastL2 = ({
  coin,
  enabled,
  precision,
  publicationEnabled = enabled,
}: {
  coin: string;
  enabled: boolean;
  precision: PerpsBookPrecision | null;
  publicationEnabled?: boolean;
}) => {
  const nSigFigs = precision?.nSigFigs;
  const mantissa = precision?.mantissa;
  const stablePrecision = useMemo<PerpsBookPrecision | null>(
    () =>
      nSigFigs == null
        ? null
        : {
            mantissa: mantissa ?? null,
            nSigFigs,
          },
    [mantissa, nSigFigs],
  );
  const identity = enabled
    ? createPerpsFastL2Identity(coin, stablePrecision)
    : 'disabled';
  const readSnapshot = useMemo(
    () => () =>
      stablePrecision
        ? readPerpsFastL2Snapshot(coin, stablePrecision)
        : disabledFastL2Snapshot(),
    [coin, stablePrecision],
  );
  const subscribe = useMemo(
    () =>
      stablePrecision
        ? (listener: FastL2Listener) =>
            subscribePerpsFastL2(coin, stablePrecision, listener)
        : null,
    [coin, stablePrecision],
  );

  return usePerpsRealtimePublication({
    clearValue: clearFastL2Value,
    createDisabledSnapshot: disabledFastL2Snapshot,
    createLoadingSnapshot: loadingFastL2Snapshot,
    displayCacheMs: PERPS_FAST_L2_DISPLAY_CACHE_MS,
    hasValue: hasFastL2Value,
    identity,
    publicationEnabled,
    readSnapshot,
    subscribe,
  });
};

export const resetPerpsFastL2RegistryForTests = () => {
  fastL2Registry.forEach(entry => entry.release());
  fastL2Registry.clear();
  fastL2DisplayCache.clear();
};
