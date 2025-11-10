import type { Account, IPinAddress } from '@/core/services/preference';
import { useAccounts, usePinAddresses } from './account';
import { useCallback, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export type AccountSwitcherScene =
  | 'Receive'
  | 'GasAccount'
  | 'Lending'
  | 'TokenDetail';

type AccountToSelect = Account & {
  isPinned?: boolean;
};
export type RecentlyUsedAccount = Account & {
  lastUsedTime: number;
};
export function useSortAccountOnSelector() {
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

  const stableRets = useMemo(() => {
    const ret = {
      totalCountOfAccount: accounts.length,

      myAddresses: [] as AccountToSelect[],
      watchAddresses: [] as AccountToSelect[],
      safeAddresses: [] as AccountToSelect[],

      recentlyUsedAddresses: [] as AccountToSelect[],
      whitelistAddresses: [] as AccountToSelect[],
    };

    for (const [idx, origAccount] of accounts.entries()) {
      const account: AccountToSelect = { ...origAccount };

      if (account.type === KEYRING_CLASS.WATCH) {
        ret.watchAddresses.push(account);
      } else if (account.type === KEYRING_CLASS.GNOSIS) {
        ret.safeAddresses.push(account);
      } else {
        ret.myAddresses.push(account);
      }
    }

    return ret;
  }, [accounts]);

  stableRets.myAddresses = useSortAddressList(stableRets.myAddresses);

  return {
    ...stableRets,
    isPinnedAccount,
  };
}
