import {
  KeyringAccountWithAlias,
  useAccounts,
  usePinAddresses,
} from '@/hooks/account';
import { sortAccountList } from '@/utils/sortAccountList';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';
import { useCallback } from 'react';

export const useSortAddressList = (accounts: KeyringAccountWithAlias[]) => {
  const { pinAddresses: highlightedAddresses, getPinAddressesAsync } =
    usePinAddresses({
      disableAutoFetch: true,
    });

  const list = useCreationWithShallowCompare(() => {
    return sortAccountList(accounts, {
      highlightedAddresses,
    });
  }, [accounts, highlightedAddresses]);

  return list;
};

export const useSortedAccounts = () => {
  const { accounts, fetchAccounts } = useAccounts();

  const { pinAddresses: highlightedAddresses, getPinAddressesAsync } =
    usePinAddresses({
      disableAutoFetch: true,
    });

  const sortedAccounts = useCreationWithShallowCompare(() => {
    return sortAccountList(accounts, {
      highlightedAddresses,
    });
  }, [accounts, highlightedAddresses]);

  const fetchSortedAccounts = useCallback(async () => {
    await Promise.all([fetchAccounts(), getPinAddressesAsync()]);
  }, [fetchAccounts, getPinAddressesAsync]);

  return {
    sortedAccounts,
    fetchSortedAccounts,
  };
};
