import { useEffect, useState } from 'react';
import {
  fetchHomePerpsSnapshotHttp,
  isPerpsUserAbstractionModeKnown,
  perpsStore,
} from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

// The badge otherwise waits on WS first frames forever. After this window it
// pulls one HTTP snapshot and then drops the skeleton whatever the outcome.
export const HOME_PERPS_PNL_WS_FALLBACK_MS = 8_000;

export const usePerpsHomePnl = () => {
  const {
    currentAddress,
    homePositionPnl,
    isFetchAllDone,
    isModeKnown,
    isSpotStateReady,
    isUserDataReady,
    userAbstraction,
  } = useActivityStore(
    perpsStore,
    useShallow(s => ({
      currentAddress: s.currentPerpsAccount?.address ?? null,
      homePositionPnl: s.homePositionPnl,
      isFetchAllDone: s.isFetchAllDone,
      isModeKnown: isPerpsUserAbstractionModeKnown(s),
      isSpotStateReady: s.isSpotStateReady,
      isUserDataReady: s.isUserDataReady,
      userAbstraction: s.userAbstraction,
    })),
    Object.is,
    { storeLabel: 'home-overview-perps-pnl' },
  );
  const { availableBalance } = usePerpsAccount();
  const hasAccount = !!currentAddress;
  const isSpotCollateralMode =
    userAbstraction === UserAbstractionResp.unifiedAccount ||
    userAbstraction === UserAbstractionResp.portfolioMargin;
  const hasResolvedPositionInfo = hasAccount
    ? isUserDataReady || isFetchAllDone
    : isFetchAllDone;
  const hasResolvedAvailableBalance = hasAccount
    ? isModeKnown && (isSpotCollateralMode ? isSpotStateReady : isUserDataReady)
    : isFetchAllDone;
  const canShowResolvedZero = hasAccount
    ? isModeKnown &&
      (isSpotCollateralMode ? isSpotStateReady : hasResolvedPositionInfo)
    : isFetchAllDone;
  const shouldShowResolvedZero =
    hasAccount && canShowResolvedZero && !homePositionPnl.show;
  const displayType = shouldShowResolvedZero
    ? 'accountValue'
    : homePositionPnl.type;
  const shouldWaitForAccountValue =
    hasAccount &&
    homePositionPnl.show &&
    displayType === 'accountValue' &&
    !hasResolvedAvailableBalance;
  const shouldWaitForResolvedZero =
    hasAccount && !homePositionPnl.show && !canShowResolvedZero;
  const isWaitingForData = hasAccount
    ? shouldWaitForAccountValue || shouldWaitForResolvedZero
    : !homePositionPnl.show && !hasResolvedPositionInfo;

  // Keyed by address so an account switch starts a fresh wait.
  const fallbackKey = currentAddress?.toLowerCase() ?? '';
  const [settledFallbackKey, setSettledFallbackKey] = useState<string | null>(
    null,
  );
  const hasGivenUp = isWaitingForData && settledFallbackKey === fallbackKey;

  useEffect(() => {
    if (!isWaitingForData || settledFallbackKey === fallbackKey) {
      return;
    }
    let cancelled = false;
    const settle = () => {
      if (!cancelled) {
        setSettledFallbackKey(fallbackKey);
      }
    };
    const timer = setTimeout(() => {
      if (!fallbackKey) {
        settle();
        return;
      }
      fetchHomePerpsSnapshotHttp(fallbackKey).then(settle, settle);
    }, HOME_PERPS_PNL_WS_FALLBACK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fallbackKey, isWaitingForData, settledFallbackKey]);

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      // While still waiting, the only value that could surface is an
      // unresolved account value — after giving up it would read as a
      // misleading $0.
      show: (homePositionPnl.show || shouldShowResolvedZero) && !hasGivenUp,
      type: displayType,
      isLoading: isWaitingForData && !hasGivenUp,
      availableBalance: Number(availableBalance),
    },
  };
};
