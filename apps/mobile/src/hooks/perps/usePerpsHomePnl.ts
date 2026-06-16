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
  const isLoading =
    !homePositionPnl.show &&
    (currentPerpsAccount ? !isUserDataReady : !isFetchAllDone);

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      isLoading,
      availableBalance: Number(availableBalance),
    },
  };
};
