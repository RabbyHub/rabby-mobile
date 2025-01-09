import { useAccounts } from '@/hooks/account';
import { useGasAccountSign } from './atom';
import { openapi } from '@/core/request';
import useAsync from 'react-use/lib/useAsync';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const useWithdrawData = () => {
  const { sig, accountId } = useGasAccountSign();

  const { accounts: accountsList } = useAccounts({ disableAutoFetch: true });

  const { value, loading } = useAsync(async () => {
    const data = await openapi.getWithdrawList({
      sig: sig!,
      id: accountId!,
    });

    return data
      ?.filter(item => {
        const { recharge_addr } = item;
        const idx = accountsList.findIndex(
          i =>
            isSameAddress(i.address, recharge_addr) &&
            i.type !== KEYRING_CLASS.WATCH &&
            i.type !== KEYRING_CLASS.GNOSIS,
        );
        return idx > -1;
      })
      .sort((a, b) => b.total_withdraw_limit - a.total_withdraw_limit);
  }, [sig, accountId, accountsList]);

  return {
    withdrawList: value,
    loading,
  };
};
