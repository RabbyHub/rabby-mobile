import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { stableSerializeAccounts } from '@/utils/account';
import { sortAccountList } from '@/utils/sortAccountList';
import { useMemo } from 'react';

export const useSortAddressList = (accounts: KeyringAccountWithAlias[]) => {
  const { pinAddresses: highlightedAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const myAccountsJSON = useMemo(
    () => stableSerializeAccounts(accounts),
    [accounts],
  );

  const list = useMemo(() => {
    return sortAccountList(JSON.parse(myAccountsJSON), {
      highlightedAddresses,
    });
  }, [myAccountsJSON, highlightedAddresses]);

  return list;
};
