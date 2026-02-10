import { initialState, perpsStore, usePerpsStore } from './usePerpsStore';
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
      accountValue: Number(accountValue),
    },
  };
};
