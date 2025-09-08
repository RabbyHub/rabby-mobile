import { useState } from 'react';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useGasAccountSign } from './atom';
import { openapi } from '@/core/request';
import useDebounce from 'react-use/lib/useDebounce';
import { Account } from '@/core/services/preference';
import { useRequest } from 'ahooks';

export const GAS_ACCOUNT_INSUFFICIENT_TIP =
  'Gas balance is not enough for transaction';

export const useGasAccountTxsCheck = ({
  isReady,
  txs,
  noCustomRPC,
  isSupportedAddr,
  currentAccount,
}: {
  isReady: boolean;
  txs: Tx[];
  noCustomRPC: boolean;
  isSupportedAddr: boolean;
  currentAccount: Account;
}) => {
  const [gasMethod, setGasMethod] = useState<'native' | 'gasAccount'>('native');
  const { sig, accountId } = useGasAccountSign();
  const [isGasAccountLogin, setIsGasAccountLogin] = useState(
    !!sig && !!accountId,
  );
  const [isFirstGasCostLoading, setIsFirstGasCostLoading] = useState(true);

  const gasAccountAddress = accountId || currentAccount.address;

  const { data: gasAccountCost, runAsync: gasAccountCostFn } = useRequest(
    async () => {
      if (!isReady) {
        return;
      }
      if (!sig || !accountId) {
        setIsGasAccountLogin(false);
      }
      const res = await openapi.checkGasAccountTxs({
        sig: sig || '',
        account_id: gasAccountAddress,
        tx_list: txs,
      });

      return res;
    },
    {
      refreshDeps: [sig, accountId, isReady, txs],
      onFinally() {
        if (isReady) {
          setIsFirstGasCostLoading(false);
        }
      },
    },
  );

  useDebounce(
    () => {
      gasAccountCostFn();
    },
    300,
    [sig, accountId, isReady, txs],
  );

  const gasAccountCanPay =
    gasMethod === 'gasAccount' &&
    isSupportedAddr &&
    noCustomRPC &&
    !!gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support &&
    !!gasAccountCost.is_gas_account &&
    !gasAccountCost.err_msg;

  const canGotoUseGasAccount =
    isSupportedAddr &&
    noCustomRPC &&
    gasAccountCost &&
    !!gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support;
  // &&
  // !!gasAccountCost.is_gas_account;

  const canDepositUseGasAccount =
    isSupportedAddr &&
    noCustomRPC &&
    gasAccountCost &&
    !gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support;
  // &&
  // !!gasAccountCost.is_gas_account;

  return {
    gasAccountCost,
    gasMethod,
    setGasMethod,
    isGasAccountLogin,
    setIsGasAccountLogin,
    gasAccountCanPay,
    canGotoUseGasAccount,
    canDepositUseGasAccount,
    gasAccountCostFn,
    gasAccountAddress,
    sig,
    isFirstGasCostLoading,
  };
};
