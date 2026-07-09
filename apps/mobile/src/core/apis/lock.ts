import { Platform } from 'react-native';
import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { BroadcastEvent } from '@/constant/event';
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
import { STARTUP_TASKS } from '../utils/startupTaskManifest';
import { perfEvents } from '../utils/perf';
import {
  getPersistedUnlockSessionExpireTime,
  refreshAutolockTimeout,
} from './autoLock';
import { logger } from '@/utils/logger';
import { traceAndroidInstant } from '../utils/androidTrace';
import { isNonProductionDiagnosticsEnabled } from '../utils/diagnosticEnv';
import { runAfterHomePostStartupReady } from '../utils/homeStartupReady';
import { recordKeyringRuntimeConvergenceDiagnostic } from '../utils/startupDiagnostics';

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
  deferKeyringRuntimeRestore?: boolean;
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
const KEYRING_RUNTIME_CONVERGENCE_FALLBACK_MS = 5000;

function traceAndroidUnlockPerf(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isAndroid || !isNonProductionDiagnosticsEnabled) {
    return;
  }

  logger.info(`[RabbyUnlockPerf:lock] ${event}`, data);
  console.info('[RabbyUnlockPerf:lock]', event, data);
  traceAndroidInstant(`unlock.lock_api.${event}`, data);
}

function getKeyringRuntimeDiagnosticState() {
  const state = keyringService.memStore.getState();

  return {
    runtimeReady: state.keyringRuntimeReady,
    runtimeRestoring: state.keyringRuntimeRestoring,
    runtimeError: state.keyringRuntimeRestoreError,
    keyringCount: state.keyrings.length,
  };
}

function traceKeyringRuntimeConvergence(
  event: string,
  data: Record<string, unknown> = {},
) {
  const payload = {
    ...getKeyringRuntimeDiagnosticState(),
    ...data,
  };

  recordKeyringRuntimeConvergenceDiagnostic(event, payload);
  traceAndroidUnlockPerf(event, payload);
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
  notifyPostUnlockUIReady();
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
    await perpsService.resetStore();
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
    await perpsService.resetStore();
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
    await perpsService.resetStore();
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
    await perpsService.resetStore();
  } catch (error) {
    result.error = 'Failed to cancel password';
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

export function isKeyringRuntimeReady() {
  return keyringService.isKeyringRuntimeReady();
}

export async function ensureKeyringRuntimeReady(reason = 'lock_api') {
  return keyringService.ensureKeyringRuntimeReady(reason);
}

const keyringRuntimeConvergenceRef = {
  generation: 0,
  cancel: null as (() => void) | null,
  running: false,
};

function cancelKeyringRuntimeConvergence(reason: string) {
  keyringRuntimeConvergenceRef.generation += 1;
  const cancel = keyringRuntimeConvergenceRef.cancel;
  keyringRuntimeConvergenceRef.cancel = null;
  cancel?.();
  keyringRuntimeConvergenceRef.cancel = null;
  traceKeyringRuntimeConvergence('keyring_runtime_convergence_cancel', {
    reason,
  });
}

export function scheduleKeyringRuntimeConvergence(reason = 'unknown') {
  if (!keyringService.isUnlocked()) {
    traceKeyringRuntimeConvergence('keyring_runtime_convergence_skip_locked', {
      reason,
    });
    return () => undefined;
  }

  keyringRuntimeConvergenceRef.cancel?.();
  const generation = keyringRuntimeConvergenceRef.generation + 1;
  keyringRuntimeConvergenceRef.generation = generation;

  traceKeyringRuntimeConvergence('keyring_runtime_convergence_scheduled', {
    reason,
    generation,
    fallbackMs: KEYRING_RUNTIME_CONVERGENCE_FALLBACK_MS,
    runtimeReady: keyringService.isKeyringRuntimeReady(),
  });

  const cancelHomeReadyWait = runAfterHomePostStartupReady(
    () => {
      if (generation !== keyringRuntimeConvergenceRef.generation) {
        traceKeyringRuntimeConvergence(
          'keyring_runtime_convergence_skip_stale',
          {
            reason,
            generation,
          },
        );
        return;
      }

      keyringRuntimeConvergenceRef.cancel = null;
      if (!keyringService.isUnlocked()) {
        traceKeyringRuntimeConvergence(
          'keyring_runtime_convergence_skip_locked_run',
          {
            reason,
            generation,
          },
        );
        return;
      }

      if (keyringRuntimeConvergenceRef.running) {
        traceKeyringRuntimeConvergence(
          'keyring_runtime_convergence_skip_running',
          {
            reason,
            generation,
          },
        );
        return;
      }

      keyringRuntimeConvergenceRef.running = true;
      const startedAt = Date.now();
      traceKeyringRuntimeConvergence('keyring_runtime_convergence_start', {
        reason,
        generation,
        runtimeReady: keyringService.isKeyringRuntimeReady(),
      });

      void Promise.resolve()
        .then(() =>
          (
            keyringService as KeyringServiceWithUnlockOptions
          ).refreshMemStoreKeyrings?.(),
        )
        .then(() => {
          traceKeyringRuntimeConvergence('keyring_runtime_convergence_end', {
            reason,
            generation,
            elapsedMs: Date.now() - startedAt,
            runtimeReady: keyringService.isKeyringRuntimeReady(),
          });
        })
        .catch(error => {
          traceKeyringRuntimeConvergence('keyring_runtime_convergence_error', {
            reason,
            generation,
            elapsedMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          keyringRuntimeConvergenceRef.running = false;
        });
    },
    {
      fallbackMs: KEYRING_RUNTIME_CONVERGENCE_FALLBACK_MS,
      label: 'keyring_runtime_convergence',
    },
  );

  const cancel = () => {
    if (generation !== keyringRuntimeConvergenceRef.generation) {
      return;
    }

    keyringRuntimeConvergenceRef.generation += 1;
    keyringRuntimeConvergenceRef.cancel = null;
    cancelHomeReadyWait();
    traceKeyringRuntimeConvergence('keyring_runtime_convergence_cancel', {
      reason: 'dispose',
    });
  };

  keyringRuntimeConvergenceRef.cancel = cancel;
  return cancel;
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
        deferKeyringRuntimeRestore: options.deferKeyringRuntimeRestore,
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
      notifyPostUnlockUIReady();
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

type WalletAuthUnlockedContext = {
  isFirstTimeAfterLaunch: boolean;
};

const pendingPostUnlockUIReadyRef = {
  current: null as WalletAuthUnlockedContext | null,
};

export function notifyPostUnlockUIReady(
  expectedCtx?: WalletAuthUnlockedContext,
) {
  const ctx = pendingPostUnlockUIReadyRef.current;
  if (!ctx || (expectedCtx && ctx !== expectedCtx)) {
    return;
  }

  pendingPostUnlockUIReadyRef.current = null;
  if (!keyringService.isUnlocked()) {
    return;
  }

  traceAndroidUnlockPerf('post_unlock_ui_ready_emit_start', {
    listenerCount: perfEvents.listenerCount('POST_UNLOCK_UI_READY'),
    legacyListenerCount: perfEvents.listenerCount(
      'USER_MANUALLY_UNLOCK_UI_READY',
    ),
  });
  perfEvents.emit('POST_UNLOCK_UI_READY', ctx);
  perfEvents.emit('USER_MANUALLY_UNLOCK_UI_READY', ctx);
  traceAndroidUnlockPerf('post_unlock_ui_ready_emit_end');
}

export function deferNotifyPostUnlockUIReady() {
  const ctx = pendingPostUnlockUIReadyRef.current;
  if (!ctx) {
    return null;
  }
  // Capture this unlock so delayed callbacks cannot consume a later unlock.
  return () => notifyPostUnlockUIReady(ctx);
}

/** @deprecated use notifyPostUnlockUIReady */
export function notifyUserManuallyUnlockUIReady(
  expectedCtx?: WalletAuthUnlockedContext,
) {
  notifyPostUnlockUIReady(expectedCtx);
}

/** @deprecated use deferNotifyPostUnlockUIReady */
export function deferNotifyUserManuallyUnlockUIReady() {
  return deferNotifyPostUnlockUIReady();
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
      pendingPostUnlockUIReadyRef.current = {
        isFirstTimeAfterLaunch,
      };
      traceAndroidUnlockPerf('wallet_auth_unlocked_emit_start', {
        isFirstTimeAfterLaunch,
        listenerCount: perfEvents.listenerCount('WALLET_AUTH_UNLOCKED'),
        legacyListenerCount: perfEvents.listenerCount('USER_MANUALLY_UNLOCK'),
      });
      perfEvents.emit('WALLET_AUTH_UNLOCKED', {
        isFirstTimeAfterLaunch,
      });
      perfEvents.emit('USER_MANUALLY_UNLOCK', {
        isFirstTimeAfterLaunch,
      });
      traceAndroidUnlockPerf('wallet_auth_unlocked_emit_end');
      scheduleKeyringRuntimeConvergence('wallet_auth_unlocked');
    }
  });
  keyringService.on('lock', () => {
    pendingPostUnlockUIReadyRef.current = null;
    cancelKeyringRuntimeConvergence('lock');
  });
}, STARTUP_TASKS.lockUnlockEventBridge);
