import { useAccounts } from '@/hooks/account';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { filterMyAccounts } from '@/utils/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React from 'react';

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
  const top10Addresses = [
    ...new Set(list.slice(0, 10).map(i => i.address.toLocaleLowerCase())),
  ];
  return {
    top10Addresses,
    list,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
  };
};
