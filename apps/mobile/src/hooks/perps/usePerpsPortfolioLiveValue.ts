import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { computeSpotPortfolioValue } from '@/screens/PerpsPro/model/accountPricing';
import { perpsStore } from './usePerpsStore';

/**
 * Live Portfolio Value from the WS-subscribed store, same basis as the
 * official site's Total Equity (and the Pro account panel):
 *
 * - unified / portfolio margin: USD value of all spot assets (the perps-side
 *   accountValue mirrors money the spot total already counts);
 * - manual: spot value + aggregated perps equity.
 *
 * Returns null until the relevant slices are ready — callers fall back to the
 * portfolio API's last point. The selector returns a single cent-rounded
 * number so price ticks only re-render subscribers when the displayed value
 * actually moves.
 *
 * The value is only meaningful for the CURRENT perps account (the WS slices
 * belong to it). Callers rendering many rows pass `enabled: false` for other
 * addresses — the selector then pins to null so ticks never re-render them.
 */
export const usePerpsPortfolioLiveValue = (enabled = true): number | null => {
  return useActivityStore(
    perpsStore,
    s => {
      if (!enabled) {
        return null;
      }
      const isSpotCollateral =
        s.userAbstraction === UserAbstractionResp.unifiedAccount ||
        s.userAbstraction === UserAbstractionResp.portfolioMargin;
      // Without spotMeta the spot pricing index cannot resolve non-USDC
      // assets (not even USDT0/USDH) and the value would silently miss most
      // of the spot side — fall back to the portfolio API instead.
      if (
        !s.spotMeta ||
        !s.isSpotStateReady ||
        (!isSpotCollateral && !s.isUserDataReady)
      ) {
        return null;
      }
      const spotValue =
        Number(
          computeSpotPortfolioValue(
            s.spotState.rawBalances,
            s.spotAssetCtxs,
            s.spotMeta,
          ).value,
        ) || 0;
      const total = isSpotCollateral
        ? spotValue
        : spotValue +
          (Number(s.currentClearinghouseState?.marginSummary?.accountValue) ||
            0);
      return Math.round(total * 100) / 100;
    },
    Object.is,
    { storeLabel: 'perps-portfolio-live-value' },
  );
};
