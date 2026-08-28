import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import { useShallow } from 'zustand/react/shallow';

import {
  getPerpsAccountRuntimeContext,
  perpsStore,
  queryUserAbstraction,
  reconcileUserAbstractionSnapshot,
  usePerpsStore,
} from '../usePerpsStore';
import { isSamePerpsFundingAccount } from './accountGuard';
import { executePerpsStableCoinOrder } from './perpsStableCoinOrder';
import { executePerpsWithdraw } from './perpsWithdraw';
import { createPerpsWithdrawLiveAbstractionQuery } from './perpsWithdrawLiveGuard';
import type { PerpsStableCoinOrderParams, PerpsWithdrawTarget } from './types';
import { usePerpsDeposit } from './usePerpsDeposit';

export type PerpsWithdrawModeValidation = 'cached' | 'live';

export const usePerpsFundingActions = ({
  withdrawModeValidation = 'cached',
}: {
  withdrawModeValidation?: PerpsWithdrawModeValidation;
} = {}) => {
  const { currentPerpsAccount, userAbstraction } = perpsStore(
    useShallow(state => ({
      currentPerpsAccount: state.currentPerpsAccount,
      userAbstraction: state.userAbstraction,
    })),
  );
  const { setLocalLoadingHistory } = usePerpsStore();
  const { handleDeposit } = usePerpsDeposit({ currentPerpsAccount });
  const isSpotCollateralMode =
    userAbstraction === UserAbstractionResp.unifiedAccount ||
    userAbstraction === UserAbstractionResp.portfolioMargin;

  const handleWithdraw = useMemoizedFn(
    (
      amount: number | string,
      isHypeWithdraw = false,
      targetAsset: PerpsWithdrawTarget = 'USDC',
    ) => {
      const expectedRuntime = getPerpsAccountRuntimeContext();
      const expectedAccount = currentPerpsAccount
        ? { ...currentPerpsAccount }
        : null;
      const queryLiveUserAbstraction =
        withdrawModeValidation === 'live' && expectedAccount
          ? createPerpsWithdrawLiveAbstractionQuery({
              account: expectedAccount,
              generation: expectedRuntime.generation,
              getRuntimeContext: getPerpsAccountRuntimeContext,
              query: queryUserAbstraction,
              reconcile: liveUserAbstraction =>
                reconcileUserAbstractionSnapshot({
                  account: expectedAccount,
                  generation: expectedRuntime.generation,
                  userAbstraction: liveUserAbstraction,
                }),
            })
          : undefined;

      return executePerpsWithdraw({
        account: currentPerpsAccount,
        amount,
        isAccountCurrent: expectedFundingAccount => {
          const currentAccount = perpsStore.getState().currentPerpsAccount;
          return isSamePerpsFundingAccount(
            currentAccount,
            expectedFundingAccount,
          );
        },
        isHypeWithdraw,
        isSpotCollateralMode,
        queryLiveUserAbstraction,
        targetAsset,
        setLocalLoadingHistory,
      });
    },
  );

  const handleStableCoinOrder = useMemoizedFn(
    (params: PerpsStableCoinOrderParams) =>
      executePerpsStableCoinOrder(currentPerpsAccount, params),
  );

  return {
    currentPerpsAccount,
    handleDeposit,
    handleWithdraw,
    handleStableCoinOrder,
  };
};
