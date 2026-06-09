import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import { preferenceService } from '@/core/services';
import { getFirstMyAccountFromAccountSelectorList } from '@/utils/accountSelectorList';
import type { Account } from '@/types/account';

type LastApprovedAccount = Pick<Account, 'address' | 'type'>;
type LastApprovedAccountsByOrigin = Record<
  string,
  LastApprovedAccount | undefined
>;

export function getWalletConnectOriginFromUrl(url?: string | null) {
  const rawUrl = url || '';

  return safeGetOrigin(rawUrl) || rawUrl;
}

function getLastApprovedAccountsByOrigin(): LastApprovedAccountsByOrigin {
  const value = appStorage.getItem(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS,
  ) as LastApprovedAccountsByOrigin | null;
  return value && typeof value === 'object'
    ? value
    : ({} as LastApprovedAccountsByOrigin);
}

function getLastApprovedAccountForOrigin(origin: string) {
  return getLastApprovedAccountsByOrigin()[origin];
}

export function rememberWalletConnectAccountForOrigin(
  origin: string,
  account: Account,
) {
  if (!origin) {
    return;
  }

  const accountsByOrigin = getLastApprovedAccountsByOrigin();
  appStorage.setItem(APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS, {
    ...accountsByOrigin,
    [origin]: {
      address: account.address,
      type: account.type,
    },
  });
}

function findAccount(accounts: Account[], target?: LastApprovedAccount | null) {
  if (!target) {
    return null;
  }

  return (
    accounts.find(
      account =>
        isSameAddress(account.address, target.address) &&
        account.type === target.type,
    ) || null
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
      origin ? getLastApprovedAccountForOrigin(origin) : null,
    ) ||
    getFirstMyAccountFromAccountSelectorList({
      accounts,
      pinAddresses: preferenceService.getPinAddresses(),
    }) ||
    preferenceService.getFallbackAccount()
  );
}
