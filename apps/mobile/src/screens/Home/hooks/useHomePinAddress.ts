import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { usePinAddresses } from '@/hooks/account';
import { sortAccountsByBalance } from '@/utils/account';
import { balanceAccountType } from '@/hooks/useAccountsBalance';

export default function useHomePinAddress(
  balanceAccounts: balanceAccountType[],
) {
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  // const { accounts } = useAccounts({
  //   disableAutoFetch: true,
  // });

  const pinAccounts = React.useMemo(() => {
    // const restAccounts =
    //   balanceAccounts.length > 0 ? balanceAccounts : accounts;
    const restAccounts = balanceAccounts;
    let highlightedAccounts: balanceAccountType[] = [];

    pinAddresses.forEach(highlighted => {
      const idx = restAccounts.findIndex(
        account =>
          isSameAddress(account.address, highlighted.address) &&
          account.type !== KEYRING_CLASS.WATCH &&
          account.type !== KEYRING_CLASS.GNOSIS &&
          account.type !== KEYRING_CLASS.WALLETCONNECT,
      );
      if (idx > -1) {
        highlightedAccounts.push({
          ...restAccounts[idx],
          brandName: highlighted.brandName,
          balance: restAccounts[idx].balance ?? 0,
        });
      }
    });
    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);
    return highlightedAccounts.slice(0, 4);
  }, [balanceAccounts, pinAddresses]);

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
