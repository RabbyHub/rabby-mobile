import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAccounts, usePinAddresses } from '@/hooks/account';
import { sortAccountsByBalance } from '@/utils/account';

export default function useHomePinAddress() {
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const pinAccounts = React.useMemo(() => {
    const restAccounts = [...accounts];
    let highlightedAccounts: typeof accounts = [];

    pinAddresses.forEach(highlighted => {
      const idx = restAccounts.findIndex(
        account =>
          isSameAddress(account.address, highlighted.address) &&
          account.brandName === highlighted.brandName &&
          account.type !== KEYRING_CLASS.WATCH &&
          account.type !== KEYRING_CLASS.GNOSIS &&
          account.type !== KEYRING_CLASS.WALLETCONNECT,
      );
      if (idx > -1) {
        highlightedAccounts.push(restAccounts[idx]);
      }
    });
    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);
    return highlightedAccounts.slice(0, 4);
  }, [accounts, pinAddresses]);

  const pinAccountsFirstFour = React.useMemo(() => {
    return pinAccounts.concat(new Array(4 - pinAccounts.length).fill(null)); // fill null to keep 4 items
  }, [pinAccounts]);

  const isShowPin = React.useMemo(() => {
    return pinAccounts.length > 0;
  }, [pinAccounts]);

  return {
    pinAccountsFirstFour,
    pinAccounts,
    isShowPin,
  };
}
