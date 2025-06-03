import type { Account, IPinAddress } from '@/core/services/preference';
import { useAccounts, usePinAddresses } from '@/hooks/account';
import { sortAccountList } from '@/utils/sortAccountList';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useCallback, useMemo } from 'react';

// todo move to single file
function isSameAccount(account: Account, saccount?: Account) {
  if (!saccount) return false;

  return (
    saccount?.address === account.address &&
    saccount?.brandName === account.brandName &&
    saccount?.type === account.type
  );
}

function computeAccountInfo({
  accounts = [],
  pinAddresses,
  currentAccount,
  isUsingAllAccounts = false,
}: {
  accounts: Account[];
  pinAddresses?: IPinAddress[];
  currentAccount?: Account | null;
  isUsingAllAccounts?: boolean;
}) {
  const result = {
    isUsingAllAccounts,
    totalCountOfAccount: accounts.length,
    myAddresses: [] as Account[],
    watchAddresses: [] as Account[],
    shouldWatchAddressesExpanded: false,
    safeAddresses: [] as Account[],
    shouldSafeAddressesExpanded: false,
  };

  for (const origAccount of accounts.values()) {
    const account: Account = { ...origAccount };

    if (account.type === KEYRING_CLASS.WATCH) {
      result.watchAddresses.push(account);
    } else if (account.type === KEYRING_CLASS.GNOSIS) {
      result.safeAddresses.push(account);
    } else {
      result.myAddresses.push(account);
    }
  }

  result.myAddresses = sortAccountList(result.myAddresses, {
    highlightedAddresses: pinAddresses || [],
  });

  if (!result.isUsingAllAccounts && currentAccount) {
    result.shouldSafeAddressesExpanded = !!result.safeAddresses.find(account =>
      isSameAccount(account, currentAccount),
    );
    if (!result.shouldSafeAddressesExpanded) {
      result.shouldWatchAddressesExpanded = !!result.watchAddresses.find(
        account => isSameAccount(account, currentAccount),
      );
    }
  }

  return result;
}

export function useAccountSelectorList({
  selectedAccount,
}: {
  selectedAccount?: Account | null;
}) {
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const { pinAddresses } = usePinAddresses({
    disableAutoFetch: true,
  });

  const pinAddressesDict = useMemo(() => {
    type MapKey = `${IPinAddress['brandName']}-${IPinAddress['address']}}`;
    return pinAddresses.reduce((acc, pinAddress) => {
      acc[pinAddress.brandName + '-' + pinAddress.address] = true;
      return acc;
    }, {} as Record<MapKey, boolean>);
  }, [pinAddresses]);

  const isPinnedAccount = useCallback(
    (account: Account) => {
      return !!pinAddressesDict[account.brandName + '-' + account.address];
    },
    [pinAddressesDict],
  );

  const computed = useMemo(() => {
    return computeAccountInfo({
      currentAccount: selectedAccount ?? null,
      isUsingAllAccounts: false,
      accounts,
      pinAddresses,
    });
  }, [selectedAccount, accounts, pinAddresses]);

  return {
    ...computed,
    isPinnedAccount,
  };
}
