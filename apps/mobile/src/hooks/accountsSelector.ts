import type { Account, IPinAddress } from '@/core/services/preference';
import { useAccounts, usePinAddresses } from './account';
import { useCallback, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export type AccountSwitcherScene = 'Receive' | 'GasAccount';

type SceneAccount = Account & {
  isPinned?: boolean;
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

  const computed = useMemo(() => {
    const result = {
      totalCountOfAccount: accounts.length,
      myAddresses: [] as SceneAccount[],
      // myRestAddresses: [] as SceneAccount[],
      watchAddresses: [] as SceneAccount[],
      safeAddresses: [] as SceneAccount[],
    };

    for (const [idx, origAccount] of accounts.entries()) {
      const account: SceneAccount = { ...origAccount };

      if (account.type === KEYRING_CLASS.WATCH) {
        result.watchAddresses.push(account);
      } else if (account.type === KEYRING_CLASS.GNOSIS) {
        result.safeAddresses.push(account);
      } else {
        result.myAddresses.push(account);
      }
    }

    return result;
  }, [accounts]);

  computed.myAddresses = useSortAddressList(computed.myAddresses);

  return {
    ...computed,
    isPinnedAccount,
  };
}
