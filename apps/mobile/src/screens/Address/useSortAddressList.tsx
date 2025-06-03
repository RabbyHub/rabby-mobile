import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { sortAccountList } from '@/utils/sortAccountList';
import { useMemo } from 'react';

export const useSortAddressList = (accounts: KeyringAccountWithAlias[]) => {
  const { pinAddresses: highlightedAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const list = useMemo(() => {
    return sortAccountList(accounts, {
      highlightedAddresses,
    });
  }, [accounts, highlightedAddresses]);

  return list;
};
