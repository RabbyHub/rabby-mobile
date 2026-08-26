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
 * Perps row (all modes): aggregated `marginSummary.accountValue` — the
 * perps-side net equity summed across every dex (HIP-3 sub-dex positions
 * included). Verified 2026-08-25 on a unified test account: this equals all
 * margins plus ALL unrealized pnl — Σ position.marginUsed would miss
 * cross-margin pnl (a cross position's marginUsed is only its requirement,
 * while an isolated position's floats with its pnl).
 *
 * Second row: manual "Spot" = USD value of all spot assets; unified /
 * portfolio margin ("Other Assets" / "Net Other Assets") = Portfolio Value −
 * Perps, so the two rows always sum to the displayed PV.
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
  const perpsValue =
    Number(state.currentClearinghouseState?.marginSummary?.accountValue) || 0;

  if (mode === 'manual') {
    return {
      perpsValue,
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
