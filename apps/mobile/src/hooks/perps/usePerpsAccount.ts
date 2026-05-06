import {
  USDC_TOKEN_ID,
  UserAbstractionResp,
} from '@rabby-wallet/hyperliquid-sdk';
import { useCallback, useMemo } from 'react';
import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { getSpotBalanceKey } from '@/utils/perps';

export const usePerpsAccount = () => {
  const {
    userAbstraction,
    perpsAccountValue,
    perpsWithdrawable,
    crossMaintenanceMarginUsed,
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
  // simple stablecoin sums miss LTV-weighted collateral (HYPE/UBTC/...) and
  // borrowed positions. unifiedAccount doesn't need this override; its
  // collateral is already accurately captured by stablecoin totals.
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
    return (
      Number(isSpotCollateralMode ? spotAvailableToTrade : perpsWithdrawable) ||
      0
    );
  }, [
    isPortfolioMargin,
    portfolioMarginAccountValue,
    isSpotCollateralMode,
    spotAvailableToTrade,
    perpsWithdrawable,
  ]);

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
    spotBalances: isSpotCollateralMode ? spotBalances || [] : [],
    spotBalancesMap: isSpotCollateralMode ? spotBalancesMap || {} : {},
    getSpotBalance,
    getAvailableByAsset,
  };
};
