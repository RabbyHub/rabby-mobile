import * as apisLock from '@/core/apis/lock';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

type WalletUnlockRequester = () => Promise<void>;

let walletUnlockRequester: WalletUnlockRequester | null = null;

/**
 * Kept in sync with WALLET_LOCKED_ERROR_PREFIX in
 * `@rabby-wallet/service-keyring`. Duplicated rather than imported so this
 * guard stays free of the keyring package (see the UI-free note below).
 */
const WALLET_LOCKED_ERROR_PREFIX = 'background.error.unlock';

// Keep core APIs depending on this UI-free guard instead of the unlock modal module.
export function setWalletUnlockRequester(requester: WalletUnlockRequester) {
  walletUnlockRequester = requester;
}

export async function ensureWalletUnlocked() {
  if (apisLock.isUnlocked()) {
    await apisLock.ensureKeyringRuntimeReady('wallet_unlock_guard');
    return;
  }

  if (!walletUnlockRequester) {
    throw new Error(`${WALLET_LOCKED_ERROR_PREFIX}:no_unlock_requester`);
  }

  await walletUnlockRequester();
  await apisLock.ensureKeyringRuntimeReady('wallet_unlock_guard_after_request');
}

export function isWalletUnlockRequired(error: unknown) {
  const message = (error as Error | undefined)?.message;
  if (typeof message !== 'string') {
    return false;
  }

  // Guards append `:<source>` to the sentinel so Sentry can tell them apart;
  // the bare form still ships from older builds and from any site not yet
  // migrated, so both shapes must match.
  return (
    message === WALLET_LOCKED_ERROR_PREFIX ||
    message.startsWith(`${WALLET_LOCKED_ERROR_PREFIX}:`)
  );
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
