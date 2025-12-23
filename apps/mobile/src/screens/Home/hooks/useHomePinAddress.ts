import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAccounts, usePinAddresses } from '@/hooks/account';
import { sortAccountsByBalance } from '@/utils/account';
import { BalanceAccountType } from '@/hooks/useAccountsBalance';
import { ellipsisAddress } from '@/utils/address';

export default function useHomePinAddress(
  balanceAccounts: BalanceAccountType[],
) {
  const { pinAddresses, togglePinAddressAsync } = usePinAddresses({
    disableAutoFetch: true,
  });

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const pinAccounts = React.useMemo(() => {
    // const restAccounts =
    //   balanceAccounts.length > 0 ? balanceAccounts : accounts;
    const restAccounts = balanceAccounts;
    let highlightedAccounts: BalanceAccountType[] = [];

    pinAddresses.forEach(highlighted => {
      if (
        accounts.findIndex(
          a =>
            isSameAddress(a.address, highlighted.address) &&
            a.brandName === highlighted.brandName,
        ) === -1
      ) {
        return;
      }
      const idx = restAccounts.findIndex(
        account =>
          isSameAddress(account.address, highlighted.address) &&
          account.type !== KEYRING_CLASS.WATCH &&
          account.type !== KEYRING_CLASS.GNOSIS &&
          account.type !== KEYRING_CLASS.WALLETCONNECT,
      );
      if (idx > -1) {
        const alias =
          accounts.find(
            account =>
              account.type !== KEYRING_CLASS.WATCH &&
              account.type !== KEYRING_CLASS.GNOSIS &&
              account.type !== KEYRING_CLASS.WALLETCONNECT &&
              account.brandName === highlighted.brandName &&
              isSameAddress(account.address, highlighted.address),
          )?.aliasName || ellipsisAddress(highlighted.address);
        highlightedAccounts.push({
          ...restAccounts[idx],
          brandName: highlighted.brandName,
          balance: restAccounts[idx].balance ?? 0,
          alias,
          aliasName: alias,
        });
      }
    });
    highlightedAccounts = sortAccountsByBalance(highlightedAccounts);
    return highlightedAccounts.slice(0, 4);
  }, [accounts, balanceAccounts, pinAddresses]);

  const pinAccountsFirstFour = React.useMemo(() => {
    return pinAccounts.concat(new Array(4 - pinAccounts.length).fill(null)); // fill null to keep 4 items
  }, [pinAccounts]);

  const isShowPin = React.useMemo(() => {
    return pinAccounts.length > 0;
  }, [pinAccounts]);

  const unPinAddress = (address: string, brandName: string) => {
    togglePinAddressAsync({
      address,
      brandName,
      nextPinned: false,
    });
  };

  return {
    pinAccountsFirstFour,
    pinAccounts,
    isShowPin,
    unPinAddress,
  };
}
