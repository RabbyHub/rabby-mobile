import { useState } from 'react';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { useGasAccountSign } from './atom';
import { openapi } from '@/core/request';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';

export const useGasAccountTxsCheck = ({
  isReady,
  txs,
  noCustomRPC,
  isSupportedAddr,
}: {
  isReady: boolean;
  txs: Tx[];
  noCustomRPC: boolean;
  isSupportedAddr: boolean;
}) => {
  const [gasMethod, setGasMethod] = useState<'native' | 'gasAccount'>('native');
  const { sig, accountId } = useGasAccountSign();
  const [isGasAccountLogin, setIsGasAccountLogin] = useState(
    !!sig && !!accountId,
  );

  const [{ value: gasAccountCost }, gasAccountCostFn] = useAsyncFn(async () => {
    if (!isReady) {
      return;
    }
    if (!sig || !accountId) {
      setIsGasAccountLogin(false);
    }
    return openapi.checkGasAccountTxs({
      sig: sig || '',
      account_id: accountId!,
      tx_list: txs,
    });
  }, [sig, accountId, isReady, txs]);

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
    !!gasAccountCost.is_gas_account;

  const canGotoUseGasAccount =
    isSupportedAddr &&
    noCustomRPC &&
    !!gasAccountCost?.balance_is_enough &&
    !gasAccountCost.chain_not_support &&
    !!gasAccountCost.is_gas_account;

  return {
    gasAccountCost,
    gasMethod,
    setGasMethod,
    isGasAccountLogin,
    setIsGasAccountLogin,
    gasAccountCanPay,
    canGotoUseGasAccount,
  };
};
