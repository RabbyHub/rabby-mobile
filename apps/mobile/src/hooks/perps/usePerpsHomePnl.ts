import { shallow } from 'zustand/shallow';
import { useActivityPerpsAccount } from './usePerpsAccount';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useActivityPerpsStore } from './useActivityPerpsStore';

export const usePerpsHomePnl = () => {
  const {
    currentPerpsAccount,
    homePositionPnl,
    isFetchAllDone,
    isSpotStateReady,
    isUserDataReady,
    userAbstraction,
    userAbstractionReady,
  } = useActivityPerpsStore(
    s => ({
      currentPerpsAccount: s.currentPerpsAccount,
      homePositionPnl: s.homePositionPnl,
      isFetchAllDone: s.isFetchAllDone,
      isSpotStateReady: s.isSpotStateReady,
      isUserDataReady: s.isUserDataReady,
      userAbstraction: s.userAbstraction,
      userAbstractionReady: s.userAbstractionReady,
    }),
    shallow,
  );
  const { availableBalance } = useActivityPerpsAccount();
  const isSpotCollateralMode =
    userAbstraction === UserAbstractionResp.unifiedAccount ||
    userAbstraction === UserAbstractionResp.portfolioMargin;
  const hasResolvedPositionInfo = currentPerpsAccount
    ? isUserDataReady || isFetchAllDone
    : isFetchAllDone;
  const hasResolvedAvailableBalance = currentPerpsAccount
    ? userAbstractionReady &&
      (isSpotCollateralMode ? isSpotStateReady : isUserDataReady)
    : isFetchAllDone;
  const canShowResolvedZero = currentPerpsAccount
    ? userAbstractionReady &&
      (isSpotCollateralMode ? isSpotStateReady : hasResolvedPositionInfo)
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
