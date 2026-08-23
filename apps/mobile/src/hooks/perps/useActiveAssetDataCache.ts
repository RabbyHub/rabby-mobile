import { useEffect, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { ActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import { apisPerps } from '@/core/apis/perps';
import { perpsStore } from '@/hooks/perps/usePerpsStore';

const TTL_MS = 10 * 60 * 1000;
const LEVERAGE_CONFIRMATION_GUARD_MS = 30 * 1000;

type CacheEntry = {
  data: ActiveAssetData;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ActiveAssetData | null>>();
const revisions = new Map<string, number>();
const leverageConfirmations = new Map<
  string,
  { expiresAt: number; leverage: ActiveAssetData['leverage'] }
>();

const buildKey = (address: string, coin: string) =>
  `${address.toLowerCase()}::${coin}`;

// Lets the detail-screen WS subscription seed this cache so home doesn't re-REST.
export const writeActiveAssetDataToCache = (
  coin: string,
  address: string,
  data: ActiveAssetData,
): ActiveAssetData => {
  if (!coin || !address) {
    return data;
  }
  const key = buildKey(address, coin);
  const confirmation = leverageConfirmations.get(key);
  const confirmationActive =
    confirmation && confirmation.expiresAt > Date.now();
  const serverConfirmed =
    confirmationActive &&
    confirmation.leverage.type === data.leverage.type &&
    confirmation.leverage.value === data.leverage.value;
  if (confirmation && !confirmationActive) {
    leverageConfirmations.delete(key);
  }
  const effectiveData =
    confirmationActive && !serverConfirmed
      ? { ...data, leverage: { ...confirmation.leverage } }
      : data;
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
  cache.set(key, { data: effectiveData, fetchedAt: Date.now() });
  return effectiveData;
};

/**
 * A successful updateLeverage response confirms this exact configuration on
 * the server. Project it into the existing scoped snapshot immediately so a
 * rapid market round trip cannot resurrect the pre-update cache entry. A short
 * confirmation guard also projects delayed REST/WS frames onto the accepted
 * mode; after it expires, normal server snapshots are authoritative again.
 */
export const updateActiveAssetLeverageCache = (
  coin: string,
  address: string,
  leverage: ActiveAssetData['leverage'],
) => {
  const key = buildKey(address, coin);
  const cached = cache.get(key);
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
  leverageConfirmations.set(key, {
    expiresAt: Date.now() + LEVERAGE_CONFIRMATION_GUARD_MS,
    leverage: { ...leverage },
  });
  if (
    !cached ||
    cached.data.coin !== coin ||
    cached.data.user?.toLowerCase() !== address.toLowerCase()
  ) {
    return;
  }
  cache.set(key, {
    data: { ...cached.data, leverage: { ...leverage } },
    fetchedAt: Date.now(),
  });
};

// Synchronous read for callers that need an immediate value without triggering
// a REST round-trip — e.g. seeding the detail-screen state with whatever home
// already fetched, before the WS pushes its first frame.
export const readActiveAssetDataFromCache = (
  coin: string,
  address: string,
): ActiveAssetData | null => {
  if (!coin || !address) {
    return null;
  }
  const cached = cache.get(buildKey(address, coin));
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.fetchedAt >= TTL_MS) {
    return null;
  }
  return cached.data;
};

export const fetchActiveAssetDataWithCache = async (
  coin: string,
  address: string,
): Promise<ActiveAssetData | null> => {
  const key = buildKey(address, coin);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  const sdk = apisPerps.getPerpsSDK();
  const revisionAtStart = revisions.get(key) ?? 0;
  const promise = (async () => {
    try {
      const data = await sdk.info.getActiveAssetData(coin, address);
      if ((revisions.get(key) ?? 0) === revisionAtStart) {
        return writeActiveAssetDataToCache(coin, address, data);
      }
      return (
        cache.get(key)?.data ?? writeActiveAssetDataToCache(coin, address, data)
      );
    } catch (e) {
      console.error('[useActiveAssetDataCache] fetch failed', coin, e);
      // Prefer stale data over a blank cell on failure.
      return cached?.data ?? null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
};

export const useActiveAssetDataMap = (coins: string[]) => {
  const currentAddress = perpsStore(s => s.currentPerpsAccount?.address);
  const [map, setMap] = useState<Record<string, ActiveAssetData>>({});

  // Prevent prior account's leverage leaking into new account's marginUsage.
  useEffect(() => {
    setMap({});
  }, [currentAddress]);

  const refresh = useMemoizedFn(
    async (list: string[], expectedAddress: string) => {
      if (!expectedAddress || list.length === 0) {
        return;
      }
      const results = await Promise.all(
        list.map(async coin => {
          const data = await fetchActiveAssetDataWithCache(
            coin,
            expectedAddress,
          );
          return [coin, data] as const;
        }),
      );
      // Account switched mid-flight: don't write old data into new account's view.
      if (
        perpsStore.getState().currentPerpsAccount?.address !== expectedAddress
      ) {
        return;
      }
      setMap(prev => {
        const next = { ...prev };
        for (const [coin, data] of results) {
          if (data) {
            next[coin] = data;
          }
        }
        return next;
      });
    },
  );

  // Joined key avoids re-fetching on equal-content array re-renders;
  // address is in deps so account switch re-fetches even with identical coins.
  const coinsKey = coins.join('|');
  useEffect(() => {
    if (currentAddress) {
      refresh(coins, currentAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinsKey, currentAddress]);

  return map;
};
