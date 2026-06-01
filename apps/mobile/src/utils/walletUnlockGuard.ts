import * as apisLock from '@/core/apis/lock';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

type WalletUnlockRequester = () => Promise<void>;

let walletUnlockRequester: WalletUnlockRequester | null = null;

// Keep core APIs depending on this UI-free guard instead of the unlock modal module.
export function setWalletUnlockRequester(requester: WalletUnlockRequester) {
  walletUnlockRequester = requester;
}

export async function ensureWalletUnlocked() {
  if (apisLock.isUnlocked()) {
    return;
  }

  if (!walletUnlockRequester) {
    throw new Error('background.error.unlock');
  }

  await walletUnlockRequester();
}

export function isWalletUnlockRequired(error: unknown) {
  return (error as Error | undefined)?.message === 'background.error.unlock';
}

export function isSensitiveKeyringType(type?: string) {
  return type === KEYRING_TYPE.SimpleKeyring || type === KEYRING_TYPE.HdKeyring;
}

export function withWalletUnlock<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs) => {
    await ensureWalletUnlocked();
    return fn(...args);
  };
}

export function withWalletUnlockIf<TArgs extends unknown[], TResult>(
  shouldUnlock: (...args: TArgs) => boolean,
  fn: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs) => {
    if (shouldUnlock(...args)) {
      await ensureWalletUnlocked();
    }

    return fn(...args);
  };
}
