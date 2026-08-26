import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import { useShallow } from 'zustand/react/shallow';

import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { computeSpotPortfolioValue } from '@/screens/PerpsPro/model/accountPricing';
import { perpsStore } from './usePerpsStore';

export type PerpsBreakdownMode = 'manual' | 'unified' | 'portfolioMargin';

/**
 * Amounts for the "Portfolio Value" breakdown popup (spec 2026-08-25).
 *
 * - manual: Perps = aggregated perps equity (marginSummary.accountValue),
 *   Spot = USD value of all spot assets.
 * - unified / portfolio margin: Perps = Σ position.marginUsed — the same
 *   per-position number the Positions list right below the card shows —
 *   and the second row ("Other Assets" / "Net Other Assets") is defined as
 *   Portfolio Value − Perps so the two rows always sum to the displayed PV.
 *
 * Values are computed lazily from a store snapshot at press time: subscribing
 * to spotAssetCtxs would re-render the card on every spot price tick just to
 * keep numbers fresh for a popup that is rarely open.
 */
export const computePortfolioBreakdownValues = (
  mode: PerpsBreakdownMode,
  portfolioValue: number,
): { perpsValue: number; secondaryValue: number } => {
  const state = perpsStore.getState();

  if (mode === 'manual') {
    return {
      perpsValue:
        Number(state.currentClearinghouseState?.marginSummary?.accountValue) ||
        0,
      secondaryValue:
        Number(
          computeSpotPortfolioValue(
            state.spotState.rawBalances,
            state.spotAssetCtxs,
            state.spotMeta,
          ).value,
        ) || 0,
    };
  }

  const perpsValue = (
    state.currentClearinghouseState?.assetPositions || []
  ).reduce((acc, asset) => {
    return acc + (Number(asset.position?.marginUsed) || 0);
  }, 0);
  return { perpsValue, secondaryValue: portfolioValue - perpsValue };
};

export const usePerpsPortfolioBreakdown = () => {
  // Icon visibility only needs "does any spot asset exist" — a boolean that
  // flips on balance changes, not on price ticks — plus the account mode.
  const { hasNonPerpsAssets, userAbstraction } = useActivityStore(
    perpsStore,
    useShallow(s => ({
      hasNonPerpsAssets: s.spotState.rawBalances.some(b => Number(b.total) > 0),
      userAbstraction: s.userAbstraction,
    })),
    Object.is,
    { storeLabel: 'perps-portfolio-breakdown' },
  );

  const breakdownMode: PerpsBreakdownMode =
    userAbstraction === UserAbstractionResp.portfolioMargin
      ? 'portfolioMargin'
      : userAbstraction === UserAbstractionResp.unifiedAccount
      ? 'unified'
      : 'manual';

  const getBreakdownValues = useMemoizedFn((portfolioValue: number) =>
    computePortfolioBreakdownValues(breakdownMode, portfolioValue),
  );

  return {
    hasNonPerpsAssets,
    breakdownMode,
    getBreakdownValues,
  };
};
