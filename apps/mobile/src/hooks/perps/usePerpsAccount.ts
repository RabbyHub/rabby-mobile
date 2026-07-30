import {
  USDC_TOKEN_ID,
  UserAbstractionResp,
} from '@rabby-wallet/hyperliquid-sdk';
import { useCallback, useMemo } from 'react';
import { getDexQuoteAsset, perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { getSpotBalanceKey } from '@/utils/perps';

export const usePerpsAccount = () => {
  const {
    userAbstraction,
    perpsAccountValue,
    perpsWithdrawable,
    crossMaintenanceMarginUsed,
    crossAvailableAllDexs,
    crossAvailableByDex,
    spotAccountValue,
    spotAvailableToTrade,
    spotBalances,
    spotBalancesMap,
    tokenToAvailableAfterMaintenance,
  } = perpsStore(
    useShallow(s => ({
      userAbstraction: s.userAbstraction,
      perpsAccountValue:
        s.currentClearinghouseState?.marginSummary?.accountValue,
      perpsWithdrawable: s.currentClearinghouseState?.withdrawable,
      crossMaintenanceMarginUsed:
        s.currentClearinghouseState?.crossMaintenanceMarginUsed,
      crossAvailableAllDexs: s.currentClearinghouseState?.crossAvailableAllDexs,
      crossAvailableByDex: s.currentClearinghouseState?.crossAvailableByDex,

      spotAccountValue: s.spotState.accountValue,
      spotAvailableToTrade: s.spotState.availableToTrade,
      spotBalances: s.spotState.balances,
      spotBalancesMap: s.spotState.balancesMap,
      tokenToAvailableAfterMaintenance:
        s.spotState.tokenToAvailableAfterMaintenance,
    })),
  );

  const isUnifiedAccount = useMemo(() => {
    return userAbstraction === UserAbstractionResp.unifiedAccount;
  }, [userAbstraction]);

  const isPortfolioMargin = useMemo(() => {
    return userAbstraction === UserAbstractionResp.portfolioMargin;
  }, [userAbstraction]);

  // unifiedAccount and portfolioMargin both keep collateral on the spot side
  // (perps clearinghouse `marginSummary.accountValue` reads as "0" for them).
  // Route both modes through the spot-derived account value.
  const isSpotCollateralMode = useMemo(() => {
    return isUnifiedAccount || isPortfolioMargin;
  }, [isUnifiedAccount, isPortfolioMargin]);

  // Portfolio margin needs the server-computed net free margin in USDC —
  // simple stablecoin sums miss LTV-weighted collateral and borrowed
  // positions.
  const portfolioMarginAccountValue = useMemo(() => {
    if (!isPortfolioMargin) {
      return 0;
    }
    const entry = tokenToAvailableAfterMaintenance?.find(
      ([tokenId]) => tokenId === USDC_TOKEN_ID,
    );
    return entry ? Number(entry[1]) || 0 : 0;
  }, [isPortfolioMargin, tokenToAvailableAfterMaintenance]);

  const accountValue = useMemo<number>(() => {
    if (isPortfolioMargin) {
      return portfolioMarginAccountValue ?? 0;
    }
    return isSpotCollateralMode
      ? Number(spotAccountValue) || 0
      : Number(perpsAccountValue) || 0;
  }, [
    isPortfolioMargin,
    portfolioMarginAccountValue,
    isSpotCollateralMode,
    spotAccountValue,
    perpsAccountValue,
  ]);

  const availableBalance = useMemo<number>(() => {
    if (isPortfolioMargin) {
      return portfolioMarginAccountValue ?? 0;
    }
    if (isSpotCollateralMode) {
      return (
        (Number(spotAvailableToTrade) || 0) +
        (Number(crossAvailableAllDexs) || 0)
      );
    }
    return Number(perpsWithdrawable) || 0;
  }, [
    isPortfolioMargin,
    portfolioMarginAccountValue,
    isSpotCollateralMode,
    spotAvailableToTrade,
    crossAvailableAllDexs,
    perpsWithdrawable,
  ]);

  // Per-coin display availability: each dex's free cross margin belongs to
  // the dex's quote stablecoin. Only the home-card chips consume this —
  // withdraw/swap keep reading spotBalancesMap (actual spot free, since held
  // funds can't be withdrawn or swapped).
  const displaySpotBalances = useMemo(() => {
    // unified only: portfolioMargin's cross summary is LTV-weighted margin
    // capacity, not spot-held cash, so the add-back would inflate its chips
    if (!isUnifiedAccount || !spotBalances?.length) {
      return spotBalances || [];
    }
    const extraByCoin: Record<string, number> = {};
    for (const [dexId, free] of Object.entries(crossAvailableByDex || {})) {
      const coin = getSpotBalanceKey(getDexQuoteAsset(dexId));
      extraByCoin[coin] = (extraByCoin[coin] || 0) + (Number(free) || 0);
    }
    return spotBalances.map(b => {
      const extra = extraByCoin[b.coin];
      return extra
        ? { ...b, available: String(Number(b.available) + extra) }
        : b;
    });
  }, [isUnifiedAccount, spotBalances, crossAvailableByDex]);

  const getSpotBalance = useCallback(
    (coin: string) => {
      const balance = spotBalancesMap[getSpotBalanceKey(coin)];
      return balance ? Number(balance.available) || 0 : 0;
    },
    [spotBalancesMap],
  );

  const getAvailableByAsset = useCallback(
    (coin: string) => {
      if (isPortfolioMargin && coin === 'USDC') {
        return portfolioMarginAccountValue ?? 0;
      }
      if (isSpotCollateralMode) {
        return getSpotBalance(coin);
      }
      return coin === 'USDC' ? Number(perpsWithdrawable) || 0 : 0;
    },
    [
      isPortfolioMargin,
      portfolioMarginAccountValue,
      isSpotCollateralMode,
      getSpotBalance,
      perpsWithdrawable,
    ],
  );

  return {
    accountValue,
    availableBalance,
    crossMaintenanceMarginUsed,
    isUnifiedAccount,
    isPortfolioMargin,
    spotBalances: isSpotCollateralMode ? displaySpotBalances : [],
    spotBalancesMap: isSpotCollateralMode ? spotBalancesMap || {} : {},
    getSpotBalance,
    getAvailableByAsset,
  };
};
