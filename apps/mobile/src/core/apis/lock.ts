import { Platform } from 'react-native';
import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { BroadcastEvent } from '@/constant/event';
import { APP_TEST_PWD, NEED_DEVSETTINGBLOCKS } from '@/constant';
import {
  keyringService,
  perpsService,
  preferenceService,
  sessionService,
} from '../services';
import { makeEEClass } from './event';
import { formatTimeReadable } from '@/utils/time';
import {
  resetMultipleFailed,
  checkMultipleFailed,
  shouldRejectUnlockDueToMultipleFailed,
} from '../utils/unlockRateLimit';
import { runIIFEFunc } from '../utils/store';
import { perfEvents } from '../utils/perf';
import {
  getPersistedUnlockSessionExpireTime,
  refreshAutolockTimeout,
} from './autoLock';
import { logger } from '@/utils/logger';

export const enum PasswordStatus {
  Unknown = -1,
  UseBuiltIn = 1,
  Custom = 11,
}

export type UIAuthType = 'none' | 'password' | 'biometrics';
export type UnlockWalletOptions = {
  trustedPassword?: boolean;
  trustedVaultKeyString?: string;
  onTrustedVaultKeyString?: (vaultKeyString: string) => void | Promise<void>;
  deferMemStoreKeyringsUpdate?: boolean;
};
export type ValidationBehaviorOnFinishedContext = {
  hasSetupCustomPassword?: boolean;
  authType?: UIAuthType;
  getValidatedPassword: () => string;
};
export type ValidationBehaviorProps = {
  /**
   * @description external-defined validatie password user input.
   * Throw an error to interrupt the post process, and `error.message` will be shown.
   *
   * @param password
   */
  validationHandler?(password: string): void | Promise<void>;
  onFinished?(ctx: ValidationBehaviorOnFinishedContext): void;
};

const DefaultValidationPassword: ValidationBehaviorProps['validationHandler'] &
  object = verifyPasswordOrUnlock;
const noop = () => {};

export function parseValidationBehavior(props?: ValidationBehaviorProps) {
  const { validationHandler, onFinished } = props || {};
  return {
    validationHandler: validationHandler || DefaultValidationPassword,
    onFinished: onFinished || noop.bind(null),
  };
}

function getInitError(password: string) {
  if (password === RABBY_MOBILE_KR_PWD) {
    return {
      error: 'Incorret Password',
    };
  }

  return { error: '' };
}

/* ===================== Password:start ===================== */
async function safeVerifyPassword(password: string) {
  const result = { success: false, error: null as null | Error };
  try {
    await keyringService.verifyPassword(password);
    result.success = true;
  } catch (error: any) {
    result.success = false;
    result.error = error?.message;
  }

  return result;
}

const ERRORS = {
  INCORRECT_PASSWORD: 'Incorrect password',
  CURRENT_IS_INCORRET: 'Current password is incorrect',
};

const isAndroid = Platform.OS === 'android';

function traceAndroidUnlockPerf(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isAndroid) {
    return;
  }

  logger.info(`[RabbyUnlockPerf:lock] ${event}`, data);
  console.info('[RabbyUnlockPerf:lock]', event, data);
}

export async function throwErrorIfInvalidPwd(password: string) {
  try {
    await keyringService.verifyPassword(password);
  } catch (error) {
    throw new Error(ERRORS.INCORRECT_PASSWORD);
  }
}

export async function verifyPasswordOrUnlock(password: string) {
  if (keyringService.isUnlocked()) {
    await throwErrorIfInvalidPwd(password);
    updateUnlockTime();
    return;
  }

  const result = await unlockWallet(password);
  if (result.error) {
    throw new Error(result.formFieldError || ERRORS.INCORRECT_PASSWORD);
  }
  updateUnlockTime();
  notifyUserManuallyUnlockUIReady();
}

export async function setupWalletPassword(newPassword: string) {
  const result = getInitError(newPassword);
  if (result.error) return result;

  if (!newPassword) {
    result.error = 'Password cannot be empty';
    return result;
  }

  try {
    const r = await safeVerifyPassword(RABBY_MOBILE_KR_PWD);
    if (r.error) {
      console.log('r.error', r.error, RABBY_MOBILE_KR_PWD);
      throw new Error(ERRORS.CURRENT_IS_INCORRET);
    }
    await keyringService.updatePassword(RABBY_MOBILE_KR_PWD, newPassword);
  } catch (error: any) {
    result.error = error?.message || 'Failed to set password';
  }

  return result;
}

/**
 * @deprecated not used now
 */
export async function updateWalletPassword(
  oldPassword: string,
  newPassword: string,
) {
  const result = getInitError(newPassword);
  if (result.error) return result;

  try {
    const r = await safeVerifyPassword(oldPassword);
    if (r.error) throw new Error(ERRORS.CURRENT_IS_INCORRET);
  } catch (error) {
    result.error = ERRORS.CURRENT_IS_INCORRET;
    return result;
  }

  try {
    await keyringService.updatePassword(oldPassword, newPassword);
  } catch (error) {
    result.error = 'Failed to set password';
  }

  return result;
}

export async function shouldAskSetPassword() {
  const lockInfo = await getRabbyLockInfo();

  if (!lockInfo.isUseCustomPwd) return true;

  return (await keyringService.getCountOfAccountsInKeyring()) === 0;
}

export async function resetPasswordOnUI(newPassword: string) {
  const result = getInitError(newPassword);
  if (result.error) return result;

  try {
    const hasAccountsInKeyring =
      (await keyringService.getCountOfAccountsInKeyring()) > 0;

    if (hasAccountsInKeyring) {
      const lockInfo = await getRabbyLockInfo();
      if (!lockInfo.isUseCustomPwd) {
        await setupWalletPassword(newPassword);
      } else {
        throw new Error(
          'Cannot reset password when using custom password and have rest accounts',
        );
      }
      // await updateWalletPassword(RABBY_MOBILE_KR_PWD, newPassword);
    } else {
      await keyringService.resetPassword(newPassword);
      await perpsService.resetStore();
    }
  } catch (error) {
    console.error(error);
    result.error = 'Failed to reset password';
  }

  return result;
}

export async function dangerouslyResetPasswordAndKeyrings(
  oldPassword: string,
  newPassword?: string,
) {
  const result = { error: '' };
  if (result.error) return result;

  try {
    await keyringService.dangerouslyResetPasswordAndKeyrings(
      oldPassword,
      newPassword,
    );
  } catch (error) {
    console.error(error);
    result.error = 'Failed to reset password an clear keyrings';
  }

  return result;
}

/**
 * @warn ONLY used in test package, not used in production
 */
export async function clearCustomPassword(currentPassword: string) {
  const result = getInitError(currentPassword);
  if (result.error) return result;
  try {
    const r = await safeVerifyPassword(currentPassword);
    if (r.error) throw new Error(ERRORS.CURRENT_IS_INCORRET);
  } catch (error) {
    result.error = ERRORS.CURRENT_IS_INCORRET;
    return result;
  }

  try {
    await keyringService.updatePassword(currentPassword, RABBY_MOBILE_KR_PWD);
  } catch (error) {
    result.error = 'Failed to cancel password';
  }

  return result;
}

/**
 * Debug-only helper for dev/regression packages.
 * Requires the wallet to be unlocked, then re-encrypts the current vault with
 * the standard local test password.
 */
export async function debugSetUnlockedWalletPasswordToTestPassword() {
  const result = { error: '' };
  if (!NEED_DEVSETTINGBLOCKS || !APP_TEST_PWD) {
    result.error = 'Only available in non-production packages';
    return result;
  }

  if (!keyringService.isUnlocked()) {
    result.error = 'Unlock wallet before setting the test password';
    return result;
  }

  const debugKeyringService = keyringService as typeof keyringService & {
    dangerouslySetUnlockedPasswordForDebug?: (
      newPassword: string,
    ) => Promise<void>;
  };

  if (!debugKeyringService.dangerouslySetUnlockedPasswordForDebug) {
    result.error = 'Current keyring service does not support this debug action';
    return result;
  }

  try {
    await debugKeyringService.dangerouslySetUnlockedPasswordForDebug(
      APP_TEST_PWD,
    );
    resetMultipleFailed();
  } catch (error) {
    console.error(error);
    result.error = 'Failed to set test password';
  }

  return result;
}

/* ===================== Password:end ===================== */

export async function getRabbyLockInfo() {
  const info = {
    pwdStatus: PasswordStatus.Unknown,
    isUseBuiltInPwd: false,
    isUseCustomPwd: false,
    isUseBiometrics: false,
  };

  try {
    const verifyResult = await safeVerifyPassword(RABBY_MOBILE_KR_PWD);
    info.pwdStatus = verifyResult.success
      ? PasswordStatus.UseBuiltIn
      : PasswordStatus.Custom;
  } catch (e) {
    info.pwdStatus = PasswordStatus.Unknown;
  }

  info.isUseBuiltInPwd = info.pwdStatus === PasswordStatus.UseBuiltIn;
  info.isUseCustomPwd = info.pwdStatus === PasswordStatus.Custom;

  return info;
}

async function tryAutoUnlockRabbyMobile() {
  // // leave here for debugging
  if (__DEV__) {
    console.debug(
      'tryAutoUnlockRabbyMobile:: RABBY_MOBILE_KR_PWD',
      RABBY_MOBILE_KR_PWD,
    );
  }

  if (!keyringService.isBooted()) {
    await keyringService.boot(RABBY_MOBILE_KR_PWD);
  }
  const lockInfo = await getRabbyLockInfo();

  try {
    if (lockInfo.isUseBuiltInPwd && !keyringService.isUnlocked()) {
      await keyringService.submitPassword(RABBY_MOBILE_KR_PWD);
    } else if (!keyringService.isUnlocked()) {
      await keyringService.restoreUnencryptedKeyrings();
    }
  } catch (e) {
    console.error('[tryAutoUnlockRabbyMobile]');
    console.error(e);
  }

  return {
    lockInfo,
  };
}

export function isUnlocked() {
  return keyringService.isUnlocked();
}

export async function isLockedWithCustomPassword() {
  if (keyringService.isUnlocked()) return false;

  const lockInfo = await getRabbyLockInfo();
  return lockInfo.isUseCustomPwd;
}

export type UnlockResultErrors = {
  error: string;
  formFieldError?: string;
  toastError?: string;
};
type KeyringServiceWithUnlockOptions = typeof keyringService & {
  submitPassword: (
    password: string,
    options?: UnlockWalletOptions,
  ) => ReturnType<typeof keyringService.submitPassword>;
  refreshMemStoreKeyrings?: () => Promise<unknown>;
};

async function unlockWallet(
  password: string,
  options: UnlockWalletOptions = {},
) {
  const unlockResult = {
    error: '',
    formFieldError: '',
    toastError: '',
  } as UnlockResultErrors;
  const startedAt = Date.now();

  traceAndroidUnlockPerf('unlock_wallet_start');

  const checkReject = shouldRejectUnlockDueToMultipleFailed();
  if (checkReject.reject) {
    unlockResult.error = ERRORS.INCORRECT_PASSWORD;
    unlockResult.formFieldError = 'Too many failed attempts';
    unlockResult.toastError = `Too many failed attempts, please try again after ${formatTimeReadable(
      Math.floor(checkReject.timeDiff / 1e3),
    )}`;
    return unlockResult;
  }

  try {
    traceAndroidUnlockPerf('submit_password_start', {
      elapsedMs: Date.now() - startedAt,
    });
    await (keyringService as KeyringServiceWithUnlockOptions).submitPassword(
      password,
      {
        trustedPassword: options.trustedPassword,
        trustedVaultKeyString: options.trustedVaultKeyString,
        onTrustedVaultKeyString: options.onTrustedVaultKeyString,
        deferMemStoreKeyringsUpdate: options.deferMemStoreKeyringsUpdate,
      },
    );
    traceAndroidUnlockPerf('submit_password_end', {
      elapsedMs: Date.now() - startedAt,
    });
    resetMultipleFailed();
  } catch (err) {
    traceAndroidUnlockPerf('submit_password_error', {
      elapsedMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    unlockResult.error = ERRORS.INCORRECT_PASSWORD;
    checkMultipleFailed();
    return unlockResult;
  }

  traceAndroidUnlockPerf('post_submit_start', {
    elapsedMs: Date.now() - startedAt,
  });
  preferenceService.initCurrentAccount();
  sessionService.broadcastEvent(BroadcastEvent.unlock);
  traceAndroidUnlockPerf('unlock_wallet_end', {
    elapsedMs: Date.now() - startedAt,
  });

  return unlockResult;
}

export async function lockWallet() {
  await keyringService.setLocked();
  clearUnlockTime();
  sessionService.broadcastEvent(BroadcastEvent.accountsChanged, []);
  sessionService.broadcastEvent(BroadcastEvent.lock);
}

const { EventEmitter: UnlockTimeEvent } = makeEEClass<{
  updated: (time: number) => void;
}>();
export const unlockTimeEvent = new UnlockTimeEvent();

const unlockTimeRef = {
  current: normalizeUnlockTime(
    preferenceService.getPreference('lastUnlockTime'),
  ),
};

function normalizeUnlockTime(time: unknown) {
  return typeof time === 'number' && Number.isFinite(time) && time > 0
    ? time
    : 0;
}

export function getUnlockTime() {
  return unlockTimeRef.current;
}

export async function updateUnlockTime() {
  const time = Date.now();
  unlockTimeRef.current = time;
  preferenceService.setPreference({
    lastUnlockTime: time,
  });
  refreshAutolockTimeout();
  unlockTimeEvent.emit('updated', time);
}

export function clearUnlockTime() {
  unlockTimeRef.current = 0;
  preferenceService.setPreference({
    lastUnlockTime: 0,
    unlockSessionExpireTime: 0,
  });
  unlockTimeEvent.emit('updated', 0);
}

export function isUnlockSessionValid(now = Date.now()) {
  const unlockTime = getUnlockTime();
  if (!unlockTime) return false;
  if (unlockTime > now) return false;

  const expireTime = getPersistedUnlockSessionExpireTime();
  if (expireTime !== -1 && expireTime <= now) return false;

  if (
    !keyringService.isUnlocked() &&
    !keyringService.hasPublicAccountSnapshot()
  ) {
    return false;
  }

  return true;
}

function makeLockApiWithUpdateUnlockTime<T extends (...args: any[]) => any>(
  fn: T,
  shouldUpdateUnlockTime: (
    result: Awaited<ReturnType<T>>,
  ) => boolean | Promise<boolean> = () => true,
): T {
  return async function (...args) {
    const res = await fn(...args);
    if (await shouldUpdateUnlockTime(res)) {
      updateUnlockTime();
    }
    return res;
  } as T;
}

export const tryAutoUnlockRabbyMobileWithUpdateUnlockTime = async () => {
  const wasUnlocked = keyringService.isUnlocked();
  const result = await tryAutoUnlockRabbyMobile();
  if (keyringService.isUnlocked()) {
    updateUnlockTime();
    if (!wasUnlocked) {
      notifyUserManuallyUnlockUIReady();
    }
  }
  return result;
};
export const unlockWalletWithUpdateUnlockTime = makeLockApiWithUpdateUnlockTime(
  unlockWallet,
  result => !result.error,
);
export const safeVerifyPasswordAndUpdateUnlockTime =
  makeLockApiWithUpdateUnlockTime(safeVerifyPassword, result => result.success);

export function subscribeAppLock(fn: () => any) {
  keyringService.on('lock', fn);

  const dispose = () => {
    keyringService.off('lock', fn);
  };

  return dispose;
}

type UserManuallyUnlockContext = {
  isFirstTimeAfterLaunch: boolean;
};

const pendingUserManuallyUnlockUIReadyRef = {
  current: null as UserManuallyUnlockContext | null,
};

export function notifyUserManuallyUnlockUIReady(
  expectedCtx?: UserManuallyUnlockContext,
) {
  const ctx = pendingUserManuallyUnlockUIReadyRef.current;
  if (!ctx || (expectedCtx && ctx !== expectedCtx)) {
    return;
  }

  pendingUserManuallyUnlockUIReadyRef.current = null;
  if (!keyringService.isUnlocked()) {
    return;
  }

  void Promise.resolve()
    .then(() =>
      (
        keyringService as KeyringServiceWithUnlockOptions
      ).refreshMemStoreKeyrings?.(),
    )
    .catch(error => {
      traceAndroidUnlockPerf('refresh_memstore_keyrings_error', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  perfEvents.emit('USER_MANUALLY_UNLOCK_UI_READY', ctx);
}

export function deferNotifyUserManuallyUnlockUIReady() {
  const ctx = pendingUserManuallyUnlockUIReadyRef.current;
  if (!ctx) {
    return null;
  }
  // Capture this unlock so delayed callbacks cannot consume a later unlock.
  return () => notifyUserManuallyUnlockUIReady(ctx);
}

runIIFEFunc(() => {
  const isFirstTimeAfterLaunchRef = {
    current: true,
  };
  keyringService.on('unlock', ctx => {
    console.debug('[perf] keyringService unlock event ctx', ctx);
    if (ctx.scene === 'unlock') {
      const isFirstTimeAfterLaunch = isFirstTimeAfterLaunchRef.current;
      isFirstTimeAfterLaunchRef.current = false;
      pendingUserManuallyUnlockUIReadyRef.current = {
        isFirstTimeAfterLaunch,
      };
      perfEvents.emit('USER_MANUALLY_UNLOCK', {
        isFirstTimeAfterLaunch,
      });
    }
  });
  keyringService.on('lock', () => {
    pendingUserManuallyUnlockUIReadyRef.current = null;
  });
});
