import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useShallow } from 'zustand/react/shallow';

import { buildPerpsProMarketDescriptor } from '../model/market';

export const usePerpsProMarketIdentity = (coin: string) =>
  perpsStore(
    useShallow(state => {
      const market = state.marketDataMap[coin];
      const descriptor = market ? buildPerpsProMarketDescriptor(market) : null;
      return {
        displayBase: descriptor?.displayBase || coin,
        displayPair: descriptor?.displayPair || coin,
        pxDecimals: market?.pxDecimals,
        quoteAsset: market?.quoteAsset || 'USDC',
        sourceTag: descriptor?.sourceTag || null,
        szDecimals: market?.szDecimals,
      };
    }),
  );
