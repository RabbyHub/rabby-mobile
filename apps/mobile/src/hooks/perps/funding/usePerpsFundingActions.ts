import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import { useShallow } from 'zustand/react/shallow';

import { perpsStore, usePerpsStore } from '../usePerpsStore';
import { isSamePerpsFundingAccount } from './accountGuard';
import { executePerpsStableCoinOrder } from './perpsStableCoinOrder';
import { executePerpsWithdraw } from './perpsWithdraw';
import type { PerpsStableCoinOrderParams, PerpsWithdrawTarget } from './types';
import { usePerpsDeposit } from './usePerpsDeposit';

export const usePerpsFundingActions = () => {
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
    ) =>
      executePerpsWithdraw({
        account: currentPerpsAccount,
        amount,
        isAccountCurrent: expectedAccount => {
          const currentAccount = perpsStore.getState().currentPerpsAccount;
          return isSamePerpsFundingAccount(currentAccount, expectedAccount);
        },
        isHypeWithdraw,
        isSpotCollateralMode,
        targetAsset,
        setLocalLoadingHistory,
      }),
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
