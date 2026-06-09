import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

import type { Account, IPinAddress } from '@/types/account';
import { sortAccountList } from '@/utils/sortAccountList';

export function getAccountSelectorDisplayGroups({
  accounts = [],
  pinAddresses,
}: {
  accounts: Account[];
  pinAddresses?: IPinAddress[];
}) {
  const myAddresses: Account[] = [];
  const watchAddresses: Account[] = [];
  const safeAddresses: Account[] = [];

  accounts.forEach(origAccount => {
    const account: Account = { ...origAccount };

    if (account.type === KEYRING_CLASS.WATCH) {
      watchAddresses.push(account);
    } else if (account.type === KEYRING_CLASS.GNOSIS) {
      safeAddresses.push(account);
    } else {
      myAddresses.push(account);
    }
  });

  return {
    myAddresses: sortAccountList(myAddresses, {
      highlightedAddresses: pinAddresses || [],
    }),
    safeAddresses,
    watchAddresses,
  };
}

export function getFirstMyAccountFromAccountSelectorList({
  accounts,
  pinAddresses,
}: {
  accounts: Account[];
  pinAddresses?: IPinAddress[];
}) {
  const { myAddresses } = getAccountSelectorDisplayGroups({
    accounts,
    pinAddresses,
  });

  return myAddresses[0] || null;
}
