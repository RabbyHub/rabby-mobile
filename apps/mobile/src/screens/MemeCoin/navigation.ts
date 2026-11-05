import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import type { TransactionNavigatorParamList } from '@/navigation-type';
import { naviPush, navigationRef } from '@/utils/navigation';

let homeResetPending = false;

/** Read by the MemeCoin home when it regains focus after a trade was finished or stopped. */
export const consumeMemeCoinHomeReset = () => {
  const pending = homeResetPending;
  homeResetPending = false;
  return pending;
};

export const pushMemeCoinBuy = (
  params: TransactionNavigatorParamList[typeof RootNames.MemeCoinBuy],
) =>
  naviPush(RootNames.StackTransaction, {
    screen: RootNames.MemeCoinBuy,
    params,
  });

export const pushMemeCoinExecute = (
  params: TransactionNavigatorParamList[typeof RootNames.MemeCoinExecute],
) =>
  naviPush(RootNames.StackTransaction, {
    screen: RootNames.MemeCoinExecute,
    params,
  });

/**
 * Every MemeCoin page is its own root-stack route, so the buy flow sits two
 * routes above the home (Buy + Execute) and the sell flow one (Execute).
 */
export const returnToMemeCoinHome = (mode: 'buy' | 'sell') => {
  if (!navigationRef.isReady()) {
    return;
  }
  homeResetPending = true;
  navigationRef.dispatch({
    ...StackActions.pop(mode === 'buy' ? 2 : 1),
    target: navigationRef.getRootState().key,
  });
};
