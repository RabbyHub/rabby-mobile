import { perpsStore } from './usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';

export const usePerpsHomePnl = () => {
  const { homePositionPnl } = perpsStore(
    useShallow(s => ({
      homePositionPnl: s.homePositionPnl,
    })),
  );
  const { accountValue } = usePerpsAccount();

  return {
    perpsPositionInfo: {
      ...homePositionPnl,
      show: homePositionPnl.show || Number(accountValue) > 0,
      accountValue: Number(accountValue),
    },
  };
};
