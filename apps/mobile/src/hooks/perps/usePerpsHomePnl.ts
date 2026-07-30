import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';

export const usePerpsHomePnl = () => {
  const {
    currentPerpsAccount,
    homePositionPnl,
    isFetchAllDone,
    isSpotStateReady,
    isUserDataReady,
    userAbstraction,
    userAbstractionReady,
  } = perpsStore(
    useShallow(s => ({
      currentPerpsAccount: s.currentPerpsAccount,
      homePositionPnl: s.homePositionPnl,
      isFetchAllDone: s.isFetchAllDone,
      isSpotStateReady: s.isSpotStateReady,
      isUserDataReady: s.isUserDataReady,
      userAbstraction: s.userAbstraction,
      userAbstractionReady: s.userAbstractionReady,
    })),
  );
  const { availableBalance } = usePerpsAccount();
  const isUnifiedAccount =
    userAbstraction === UserAbstractionResp.unifiedAccount;
  const isSpotCollateralMode =
    isUnifiedAccount ||
    userAbstraction === UserAbstractionResp.portfolioMargin;
  const hasResolvedPositionInfo = currentPerpsAccount
    ? isUserDataReady || isFetchAllDone
    : isFetchAllDone;
  // unified availableBalance depends on both the spot and clearinghouse
  // channels — showing it with only one loaded renders a too-low number.
  // portfolioMargin reads the spot channel only, so it keeps the single wait.
  const hasResolvedAvailableBalance = currentPerpsAccount
    ? userAbstractionReady &&
      (isSpotCollateralMode
        ? isSpotStateReady && (!isUnifiedAccount || isUserDataReady)
        : isUserDataReady)
    : isFetchAllDone;
  const canShowResolvedZero = currentPerpsAccount
    ? userAbstractionReady &&
      (isSpotCollateralMode
        ? isSpotStateReady && (!isUnifiedAccount || hasResolvedPositionInfo)
        : hasResolvedPositionInfo)
    : isFetchAllDone;
  const shouldShowResolvedZero =
    !!currentPerpsAccount && canShowResolvedZero && !homePositionPnl.show;
  const displayType = shouldShowResolvedZero
    ? 'accountValue'
    : homePositionPnl.type;
  const shouldWaitForAccountValue =
    !!currentPerpsAccount &&
    homePositionPnl.show &&
    displayType === 'accountValue' &&
    !hasResolvedAvailableBalance;
  const shouldWaitForResolvedZero =
    !!currentPerpsAccount && !homePositionPnl.show && !canShowResolvedZero;
  const isLoading = currentPerpsAccount
    ? shouldWaitForAccountValue || shouldWaitForResolvedZero
    : !homePositionPnl.show && !hasResolvedPositionInfo;

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      show: homePositionPnl.show || shouldShowResolvedZero,
      type: displayType,
      isLoading,
      availableBalance: Number(availableBalance),
    },
  };
};
