import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import type { Account } from '@/types/account';

export type WalletConnectAccountIdentity = Pick<
  Account,
  'address' | 'type' | 'brandName'
>;

export type WalletConnectStoredAccountIdentity = Pick<
  Account,
  'address' | 'type'
> &
  Partial<Pick<Account, 'brandName'>>;
type StoredAccountsByKey = Record<
  string,
  WalletConnectStoredAccountIdentity | undefined
>;

export function getWalletConnectOriginFromUrl(url?: string | null) {
  const rawUrl = url || '';

  return safeGetOrigin(rawUrl) || rawUrl;
}

function getStoredAccountsByKey(storageKey: string): StoredAccountsByKey {
  const value = appStorage.getItem(storageKey) as StoredAccountsByKey | null;
  return value && typeof value === 'object'
    ? value
    : ({} as StoredAccountsByKey);
}

function rememberStoredAccount(
  storageKey: string,
  key: string,
  account: WalletConnectAccountIdentity,
) {
  if (!key) {
    return;
  }

  const accountsByKey = getStoredAccountsByKey(storageKey);
  appStorage.setItem(storageKey, {
    ...accountsByKey,
    [key]: {
      address: account.address,
      type: account.type,
      brandName: account.brandName,
    },
  });
}

function forgetStoredAccount(storageKey: string, key: string) {
  if (!key) {
    return;
  }

  const accountsByKey = getStoredAccountsByKey(storageKey);
  if (!accountsByKey[key]) {
    return;
  }

  const nextAccountsByKey = { ...accountsByKey };
  delete nextAccountsByKey[key];
  appStorage.setItem(storageKey, nextAccountsByKey);
}

function getStoredAccount(storageKey: string, key: string) {
  return getStoredAccountsByKey(storageKey)[key] || null;
}

export function getWalletConnectLastApprovedAccountForOrigin(origin: string) {
  return getStoredAccount(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS,
    origin,
  );
}

export function rememberWalletConnectAccountForOrigin(
  origin: string,
  account: Account,
) {
  rememberStoredAccount(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_LAST_APPROVED_ACCOUNTS,
    origin,
    account,
  );
}

export function rememberWalletConnectAccountForTopic(
  topic: string,
  account: Account,
) {
  rememberStoredAccount(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
    topic,
    account,
  );
}

export function forgetWalletConnectAccountForTopic(topic: string) {
  forgetStoredAccount(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
    topic,
  );
}

export function getWalletConnectAccountForTopic(topic: string) {
  return getStoredAccount(
    APP_MMKV_WEAK_KEYS.WALLETCONNECT_APPROVED_ACCOUNTS_BY_TOPIC,
    topic,
  );
}

export function isSameWalletConnectAccount(
  account: WalletConnectAccountIdentity,
  target?: WalletConnectStoredAccountIdentity | null,
) {
  if (!target?.address || !target.type) {
    return false;
  }

  if (!isSameAddress(account.address, target.address)) {
    return false;
  }
  if (account.type !== target.type) {
    return false;
  }

  return !target.brandName || account.brandName === target.brandName;
}
