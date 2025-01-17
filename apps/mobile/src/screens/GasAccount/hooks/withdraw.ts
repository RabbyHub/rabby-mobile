import { useAccounts } from '@/hooks/account';
import { useGasAccountSign } from './atom';
import { openapi } from '@/core/request';
import useAsync from 'react-use/lib/useAsync';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useMemo } from 'react';

export const useWithdrawData = () => {
  const { sig, accountId } = useGasAccountSign();

  const { accounts: accountsList } = useAccounts({ disableAutoFetch: true });

  const { value, loading } = useAsync(async () => {
    const data = await openapi.getWithdrawList({
      sig: sig!,
      id: accountId!,
    });
    console.log('useWithdrawData', data, sig, accountId);
    return data;
  }, [sig, accountId]);

  const withdrawList = useMemo(() => {
    return value
      ?.filter(item => {
        const { recharge_addr } = item;
        const idx = accountsList.findIndex(i =>
          isSameAddress(i.address, recharge_addr),
        );
        return idx > -1;
      })
      .sort((a, b) => b.total_withdraw_limit - a.total_withdraw_limit);
  }, [value, accountsList]);

  return {
    withdrawList,
    loading,
  };
};
