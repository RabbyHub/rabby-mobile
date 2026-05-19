import * as apisKeychain from '@/core/apis/keychain';
import * as apisLock from '@/core/apis/lock';
import {
  isAuthenticatedByBiometrics,
  RequestGenericPurpose,
} from '@/core/apis/keychain';
import { setWalletUnlockRequester } from '@/utils/walletUnlockGuard';

type PendingWalletUnlock = {
  id: number;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
  hideModal?: () => void;
};

export class WalletUnlockCancelledError extends Error {
  constructor() {
    super('wallet.unlock.cancelled');
    this.name = 'WalletUnlockCancelledError';
  }
}

let nextUnlockRequestId = 1;
let pendingWalletUnlock: PendingWalletUnlock | null = null;

export function isWalletUnlockCancelled(error: unknown) {
  return (
    error instanceof WalletUnlockCancelledError ||
    (error as Error | undefined)?.name === 'WalletUnlockCancelledError' ||
    (error as Error | undefined)?.message === 'wallet.unlock.cancelled'
  );
}

export async function ensureWalletUnlockedForAction() {
  try {
    await ensureWalletUnlocked();
    return true;
  } catch (error) {
    if (isWalletUnlockCancelled(error)) {
      return false;
    }

    throw error;
  }
}

export function withWalletUnlockForAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  onCancel: (...args: TArgs) => TResult | Promise<TResult>,
) {
  return async (...args: TArgs) => {
    if (!(await ensureWalletUnlockedForAction())) {
      return onCancel(...args);
    }

    return fn(...args);
  };
}

export function cancelPendingWalletUnlock(unlockRequestId?: number) {
  if (!pendingWalletUnlock) {
    return;
  }

  if (
    typeof unlockRequestId === 'number' &&
    pendingWalletUnlock.id !== unlockRequestId
  ) {
    return;
  }

  const { hideModal, reject } = pendingWalletUnlock;
  pendingWalletUnlock = null;
  hideModal?.();
  reject(new WalletUnlockCancelledError());
}

async function hasAvailableBiometricsUnlock() {
  if (!isAuthenticatedByBiometrics()) {
    return false;
  }

  const supportedBiometryType = await apisKeychain
    .getSupportedBiometryType()
    .catch(() => null);

  return !!supportedBiometryType;
}

export async function ensureWalletUnlocked() {
  if (apisLock.isUnlocked()) {
    return;
  }

  if (pendingWalletUnlock) {
    return pendingWalletUnlock.promise;
  }

  const unlockRequestId = nextUnlockRequestId++;
  let resolvePending: PendingWalletUnlock['resolve'] = () => {};
  let rejectPending: PendingWalletUnlock['reject'] = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    resolvePending = resolve;
    rejectPending = reject;
  });

  pendingWalletUnlock = {
    id: unlockRequestId,
    promise,
    resolve: resolvePending,
    reject: rejectPending,
  };

  const resolveUnlock = () => {
    if (pendingWalletUnlock?.id !== unlockRequestId) {
      return;
    }

    const { resolve } = pendingWalletUnlock;
    pendingWalletUnlock = null;
    resolve();
  };

  const rejectUnlock = () => {
    if (pendingWalletUnlock?.id !== unlockRequestId) {
      return;
    }

    const { reject } = pendingWalletUnlock;
    pendingWalletUnlock = null;
    reject(new WalletUnlockCancelledError());
  };

  try {
    if (!(await hasAvailableBiometricsUnlock())) {
      throw new Error('Biometrics Disabled');
    }

    await apisKeychain.requestGenericPassword({
      purpose: RequestGenericPurpose.DECRYPT_PWD,
      onPlainPassword: async password => {
        await apisLock.verifyPasswordOrUnlock(password);
        resolveUnlock();
      },
    });
  } catch (error) {
    if (__DEV__) {
      console.error(error);
    }

    const { AuthenticationModal2024 } = await import(
      '@/components/AuthenticationModal/AuthenticationModal2024'
    );
    const { hideModal } = await AuthenticationModal2024.show({
      title: 'Unlock Rabby Wallet',
      authType: ['password'],
      onFinished: resolveUnlock,
      onCancel: rejectUnlock,
      onDismiss: rejectUnlock,
      validationHandler(password) {
        return apisLock.verifyPasswordOrUnlock(password);
      },
    });

    if (pendingWalletUnlock?.id === unlockRequestId) {
      pendingWalletUnlock.hideModal = hideModal;
    } else {
      hideModal();
    }
  }

  return promise;
}

setWalletUnlockRequester(ensureWalletUnlocked);
