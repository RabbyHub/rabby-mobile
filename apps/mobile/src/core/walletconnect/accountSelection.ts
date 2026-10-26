import {
  getFallbackAccountSnapshot,
  getPinnedAddressSnapshot,
} from '@/core/serviceApi/preference';
import { getFirstMyAccountFromAccountSelectorList } from '@/utils/accountSelectorList';
import type { Account } from '@/types/account';
import {
  getWalletConnectLastApprovedAccountForOrigin,
  isSameWalletConnectAccount,
} from './accountPersistence';
import type { WalletConnectStoredAccountIdentity } from './accountPersistence';

export {
  forgetWalletConnectAccountForTopic,
  getWalletConnectAccountForTopic,
  getWalletConnectOriginFromUrl,
  isSameWalletConnectAccount,
  rememberWalletConnectAccountForOrigin,
  rememberWalletConnectAccountForTopic,
} from './accountPersistence';
export type { WalletConnectAccountIdentity } from './accountPersistence';

function findAccount(
  accounts: Account[],
  target?: WalletConnectStoredAccountIdentity | null,
) {
  if (!target) {
    return null;
  }

  return (
    accounts.find(account => isSameWalletConnectAccount(account, target)) ||
    null
  );
}

export function selectWalletConnectAccountForOrigin(
  origin: string,
  accounts: Account[],
  currentAccount?: Account | null,
) {
  return (
    findAccount(accounts, currentAccount) ||
    findAccount(
      accounts,
      origin ? getWalletConnectLastApprovedAccountForOrigin(origin) : null,
    ) ||
    getFirstMyAccountFromAccountSelectorList({
      accounts,
      pinAddresses: getPinnedAddressSnapshot(),
    }) ||
    getFallbackAccountSnapshot()
  );
}
