import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';

export const usePerpsHomePnl = () => {
  const { homePositionPnl, userAbstractionReady } = perpsStore(
    useShallow(s => ({
      homePositionPnl: s.homePositionPnl,
      userAbstractionReady: s.userAbstractionReady,
    })),
  );
  const { availableBalance } = usePerpsAccount();

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      show: userAbstractionReady,
      availableBalance: Number(availableBalance),
    },
  };
};
