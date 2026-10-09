import { useShallow } from 'zustand/react/shallow';

import { perpsStore, type MarketData } from '@/hooks/perps/usePerpsStore';

import type { SpotMarket } from './spotMarkets';

/**
 * Logo for a spot token, borrowed from the perp market of the same coin.
 * Unit-bridged tokens (UBTC, UETH, USOL…) map to their underlying perp.
 */
export const resolveSpotTokenLogo = (
  marketDataMap: Record<string, Pick<MarketData, 'logoUrl'> | undefined>,
  baseName: string,
): string => {
  const direct = marketDataMap[baseName]?.logoUrl;
  if (direct) {
    return direct;
  }
  if (baseName.length > 1 && baseName.startsWith('U')) {
    return marketDataMap[baseName.slice(1)]?.logoUrl || '';
  }
  return '';
};

/** Logo per base token name; re-renders only when a logo actually changes. */
export const useSpotTokenLogos = (
  markets: ReadonlyArray<Pick<SpotMarket, 'baseName'>>,
): Record<string, string> =>
  perpsStore(
    useShallow(s => {
      const logos: Record<string, string> = {};
      for (const market of markets) {
        logos[market.baseName] = resolveSpotTokenLogo(
          s.marketDataMap,
          market.baseName,
        );
      }
      return logos;
    }),
  );
