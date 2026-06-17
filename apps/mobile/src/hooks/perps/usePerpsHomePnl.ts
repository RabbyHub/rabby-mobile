import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';

export const usePerpsHomePnl = () => {
  const {
    currentPerpsAccount,
    homePositionPnl,
    isFetchAllDone,
    isUserDataReady,
  } = perpsStore(
    useShallow(s => ({
      currentPerpsAccount: s.currentPerpsAccount,
      homePositionPnl: s.homePositionPnl,
      isFetchAllDone: s.isFetchAllDone,
      isUserDataReady: s.isUserDataReady,
    })),
  );
  const { availableBalance } = usePerpsAccount();
  const hasResolvedPositionInfo = currentPerpsAccount
    ? isUserDataReady || isFetchAllDone
    : isFetchAllDone;
  const shouldShowResolvedZero =
    !!currentPerpsAccount && hasResolvedPositionInfo && !homePositionPnl.show;
  const isLoading = !homePositionPnl.show && !hasResolvedPositionInfo;

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      show: homePositionPnl.show || shouldShowResolvedZero,
      type: shouldShowResolvedZero ? 'accountValue' : homePositionPnl.type,
      isLoading,
      availableBalance: Number(availableBalance),
    },
  };
};
