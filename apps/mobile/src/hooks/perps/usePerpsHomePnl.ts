import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';

export const usePerpsHomePnl = () => {
  const { homePositionPnl } = perpsStore(
    useShallow(s => ({
      homePositionPnl: s.homePositionPnl,
    })),
  );
  const { availableBalance } = usePerpsAccount();

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      show: true,
      availableBalance: Number(availableBalance),
    },
  };
};
