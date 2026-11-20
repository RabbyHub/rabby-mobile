import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { shallow } from 'zustand/shallow';

import { resolvePerpsProMarketPresentation } from '../model/market';

export const usePerpsProMarketIdentity = (coin: string) =>
  useActivityStore(
    perpsStore,
    state => {
      const market = state.marketDataMap[coin];
      const presentation = resolvePerpsProMarketPresentation(coin, market);
      return {
        ...presentation,
        pxDecimals: market?.pxDecimals,
        szDecimals: market?.szDecimals,
      };
    },
    shallow,
  );
