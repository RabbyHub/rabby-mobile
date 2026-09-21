import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useShallow } from 'zustand/react/shallow';

import { resolvePerpsProMarketPresentation } from '../model/market';

export const usePerpsProMarketIdentity = (coin: string) =>
  perpsStore(
    useShallow(state => {
      const market = state.marketDataMap[coin];
      const presentation = resolvePerpsProMarketPresentation(coin, market);
      return {
        ...presentation,
        pxDecimals: market?.pxDecimals,
        szDecimals: market?.szDecimals,
      };
    }),
  );
