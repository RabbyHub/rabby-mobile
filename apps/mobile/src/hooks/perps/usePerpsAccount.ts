import {
  USDC_TOKEN_ID,
  UserAbstractionResp,
} from '@rabby-wallet/hyperliquid-sdk';
import { useCallback, useMemo } from 'react';
import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { getSpotBalanceKey } from '@/utils/perps';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

export const usePerpsAccount = () => {
  const {
    userAbstraction,
    perpsAccountValue,
    perpsWithdrawable,
    crossMaintenanceMarginUsed,
    spotAccountValue,
    spotBalances,
    spotBalancesMap,
    tokenToAvailableAfterMaintenance,
    hasAccount,
    currentAddress,
    userAbstractionReady,
    userAbstractionCachedAddress,
    isSpotStateReady,
    isUserDataReady,
  } = useActivityStore(
    perpsStore,
    useShallow(s => ({
      userAbstraction: s.userAbstraction,
      perpsAccountValue:
        s.currentClearinghouseState?.marginSummary?.accountValue,
      perpsWithdrawable: s.currentClearinghouseState?.withdrawable,
      crossMaintenanceMarginUsed:
        s.currentClearinghouseState?.crossMaintenanceMarginUsed,

      spotAccountValue: s.spotState.accountValue,
      spotBalances: s.spotState.balances,
      spotBalancesMap: s.spotState.balancesMap,
      tokenToAvailableAfterMaintenance:
        s.spotState.tokenToAvailableAfterMaintenance,

      hasAccount: !!s.currentPerpsAccount,
      currentAddress: s.currentPerpsAccount?.address,
      userAbstractionReady: s.userAbstractionReady,
      userAbstractionCachedAddress: s.userAbstractionCachedAddress,
      isSpotStateReady: s.isSpotStateReady,
      isUserDataReady: s.isUserDataReady,
    })),
    Object.is,
    { storeLabel: 'perps-account' },
  );

  const isUnifiedAccount = useMemo(() => {
    return userAbstraction === UserAbstractionResp.unifiedAccount;
  }, [userAbstraction]);

  const isPortfolioMargin = useMemo(() => {
    return userAbstraction === UserAbstractionResp.portfolioMargin;
  }, [userAbstraction]);

  // unifiedAccount and portfolioMargin both keep collateral on the spot side.
  // Route both modes through the spot-derived account value.
  //
  // Perps `marginSummary.accountValue` only reads "0" here while no position is
  // open; it is `totalRawUsd + Σ signed position value`, and these modes borrow
  // against spot instead of transferring, so `totalRawUsd` goes negative. Once a
  // position is open it mirrors USDC that the spot `total` already counts — it is
  // NOT extra equity, so never add it to the spot value. Verified 2026-08-11:
  // Hyperliquid's own Total Equity equals the spot assets alone.
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
    if (isUnifiedAccount) {
      // USDC only (2026-08-25 requirement): spot USDC available plus any
      // perps-side withdrawable — no longer the sum of all 4 stablecoins.
      return (
        (Number(spotBalancesMap.USDC?.available) || 0) +
        (Number(perpsWithdrawable) || 0)
      );
    }
    return Number(perpsWithdrawable) || 0;
  }, [
    isPortfolioMargin,
    portfolioMarginAccountValue,
    isUnifiedAccount,
    spotBalancesMap,
    perpsWithdrawable,
  ]);

  // `userAbstraction` initialises to `default` (manual), so an account whose
  // mode has not resolved yet — or whose fetch failed — is silently treated
  // as manual and its available balance reads as the perps-side withdrawable
  // (0 for a unified account that keeps everything on the spot side). Callers
  // must not render a resolved "$0" until this is true; same guard the Home
  // PnL widget uses.
  const isAvailableBalanceReady = useMemo(() => {
    if (!hasAccount) {
      return true;
    }
    // Known = resolved from the network this session, or restored from the
    // MMKV cache for this very address.
    const isModeKnown =
      userAbstractionReady ||
      (!!userAbstractionCachedAddress &&
        !!currentAddress &&
        isSameAddress(userAbstractionCachedAddress, currentAddress));
    if (!isModeKnown) {
      return false;
    }
    // Match each mode to the slices its number actually reads:
    // PM   -> spot only (server-computed net free margin);
    // unified -> BOTH, it sums spot USDC and the perps withdrawable, so spot
    //            landing first would publish a partial balance;
    // manual  -> perps only.
    if (isPortfolioMargin) {
      return isSpotStateReady;
    }
    if (isUnifiedAccount) {
      return isSpotStateReady && isUserDataReady;
    }
    return isUserDataReady;
  }, [
    hasAccount,
    currentAddress,
    userAbstractionReady,
    userAbstractionCachedAddress,
    isPortfolioMargin,
    isUnifiedAccount,
    isSpotStateReady,
    isUserDataReady,
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
    isAvailableBalanceReady,
    crossMaintenanceMarginUsed,
    isUnifiedAccount,
    isPortfolioMargin,
    spotBalances: isSpotCollateralMode ? spotBalances || [] : [],
    spotBalancesMap: isSpotCollateralMode ? spotBalancesMap || {} : {},
    getSpotBalance,
    getAvailableByAsset,
  };
};
