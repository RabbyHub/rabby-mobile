import { KeyringAccountWithAlias, usePinAddresses } from '@/hooks/account';
import { sortAccountsByBalance } from '@/utils/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useMemo } from 'react';

export const useSortAddressList = (accounts: KeyringAccountWithAlias[]) => {
  const { pinAddresses: highlightedAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const list = useMemo(() => {
    const restAccounts = accounts;
    let highlightedAccounts: typeof accounts = [];

    highlightedAddresses.forEach(highlighted => {
      const idx = restAccounts.findIndex(
        account =>
          addressUtils.isSameAddress(account.address, highlighted.address) &&
          account.brandName === highlighted.brandName,
      );
      if (idx > -1) {
        highlightedAccounts.push(restAccounts[idx]);
        restAccounts.splice(idx, 1);
      }
    });
    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);

    const normalAccounts = highlightedAccounts
      .concat(sortAccountsByBalance(restAccounts))
      .filter(e => !!e);

    return normalAccounts;
  }, [accounts, highlightedAddresses]);

  return list;
};
