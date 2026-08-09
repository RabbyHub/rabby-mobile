import { DELETE_AGENT_EMPTY_ADDRESS } from '@/constant/perps';
import {
  fetchActiveAssetDataWithCache,
  readActiveAssetDataFromCache,
} from '@/hooks/perps/useActiveAssetDataCache';
import type { ActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import { useEffect, useState } from 'react';

/**
 * Mirrors Hyperliquid's disconnected trade-form baseline without treating the
 * observed zero-address value as a protocol-level `recommendedLeverage` field.
 */
export const usePerpsProRecommendedLeverage = (coin: string) => {
  const [data, setData] = useState<ActiveAssetData | null>(() =>
    coin
      ? readActiveAssetDataFromCache(coin, DELETE_AGENT_EMPTY_ADDRESS)
      : null,
  );

  useEffect(() => {
    let active = true;
    if (!coin) {
      setData(null);
      return () => {
        active = false;
      };
    }
    setData(readActiveAssetDataFromCache(coin, DELETE_AGENT_EMPTY_ADDRESS));
    void fetchActiveAssetDataWithCache(coin, DELETE_AGENT_EMPTY_ADDRESS).then(
      next => {
        if (active && next?.coin === coin) setData(next);
      },
    );
    return () => {
      active = false;
    };
  }, [coin]);

  return data?.coin === coin ? data.leverage : null;
};
