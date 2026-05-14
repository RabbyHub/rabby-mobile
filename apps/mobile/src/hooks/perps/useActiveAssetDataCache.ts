import { useEffect, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { ActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import { apisPerps } from '@/core/apis/perps';
import { perpsStore } from '@/hooks/perps/usePerpsStore';

const TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  data: ActiveAssetData;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ActiveAssetData | null>>();

const buildKey = (address: string, coin: string) =>
  `${address.toLowerCase()}::${coin}`;

// Lets the detail-screen WS subscription seed this cache so home doesn't re-REST.
export const writeActiveAssetDataToCache = (
  coin: string,
  address: string,
  data: ActiveAssetData,
): void => {
  if (!coin || !address) {
    return;
  }
  cache.set(buildKey(address, coin), { data, fetchedAt: Date.now() });
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
  const promise = (async () => {
    try {
      const data = await sdk.info.getActiveAssetData(coin, address);
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
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
