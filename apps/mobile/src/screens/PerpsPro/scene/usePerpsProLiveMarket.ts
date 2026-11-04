import { useMemo } from 'react';

import { perpsStore, type PerpsState } from '@/hooks/perps/usePerpsStore';
import { buildPerpsProMarket } from '../model/market';

export const selectPerpsProMarketData = (
  state: Pick<PerpsState, 'marketData' | 'marketDataMap'>,
  canonicalCoin: string,
) =>
  canonicalCoin
    ? state.marketDataMap[canonicalCoin] ??
      state.marketData.find(market => market.name === canonicalCoin) ??
      null
    : null;

// Only the trade owner needs the complete live market (including risk limits).
// Presentation consumers select their own primitives from the same source.
export const usePerpsProLiveMarket = (canonicalCoin: string) => {
  const marketData = perpsStore(state =>
    selectPerpsProMarketData(state, canonicalCoin),
  );
  return useMemo(
    () => (marketData ? buildPerpsProMarket(marketData) : null),
    [marketData],
  );
};
