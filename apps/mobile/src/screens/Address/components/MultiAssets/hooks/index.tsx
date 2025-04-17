import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React, { useMemo } from 'react';

export const useAccountInfo = () => {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });

  const filterAccounts = React.useMemo(
    () => [...filterMyAccounts(accounts)],
    [accounts],
  );

  const list = useSortAddressList(filterAccounts);
  const hasWatchAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.WATCH);
  }, [accounts]);
  const hasSafeAddress = React.useMemo(() => {
    return accounts.some(account => account.type === KEYRING_CLASS.GNOSIS);
  }, [accounts]);
  const { addresses: top10Addresses, totalBalance: top10Balance } =
    useMemo(() => {
      const top10Account = list.slice(0, 10);

      const addresses = [
        ...new Set(list.slice(0, 10).map(i => i.address.toLocaleLowerCase())),
      ];
      let totalBalance = 0;
      addresses.forEach(address => {
        const account = top10Account.find(acc =>
          isSameAddress(acc.address, address),
        );
        totalBalance += account?.balance || 0;
      });
      return {
        addresses,
        totalBalance,
      };
    }, [list]);
  return {
    top10Addresses,
    top10Balance,
    list,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
  };
};
