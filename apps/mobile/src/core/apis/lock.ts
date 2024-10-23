import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { BroadcastEvent } from '@/constant/event';
import { keyringService, sessionService } from '../services';
import { makeEEClass } from './event';

export const enum PasswordStatus {
  Unknown = -1,
  UseBuiltIn = 1,
  Custom = 11,
}

export type UIAuthType = 'none' | 'password' | 'biometrics';
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
  object = throwErrorIfInvalidPwd;
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

export async function throwErrorIfInvalidPwd(password: string) {
  try {
    await keyringService.verifyPassword(password);
  } catch (error) {
    throw new Error(ERRORS.INCORRECT_PASSWORD);
  }
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

async function unlockWallet(password: string) {
  const unlockResult = {
    error: '',
  };

  try {
    await keyringService.verifyPassword(password);
  } catch (err) {
    unlockResult.error = 'Incorrect Password';
    return unlockResult;
  }

  await keyringService.submitPassword(password);
  sessionService.broadcastEvent(BroadcastEvent.unlock);

  return unlockResult;
}

export async function lockWallet() {
  await keyringService.setLocked();
  sessionService.broadcastEvent(BroadcastEvent.accountsChanged, []);
  sessionService.broadcastEvent(BroadcastEvent.lock);
}

const { EventEmitter: UnlockTimeEvent } = makeEEClass<{
  updated: (time: number) => void;
}>();
export const unlockTimeEvent = new UnlockTimeEvent();

const unlockTimeRef = {
  current: 0,
};

export function getUnlockTime() {
  return unlockTimeRef.current;
}

export async function updateUnlockTime() {
  const time = Date.now();
  unlockTimeRef.current = time;
  unlockTimeEvent.emit('updated', time);
}

function makeLockApiWithUpdateUnlockTime<T extends (...args: any[]) => any>(
  fn: T,
): T {
  return function (...args) {
    const res = fn(...args);
    updateUnlockTime();
    return res;
  } as T;
}

export const tryAutoUnlockRabbyMobileWithUpdateUnlockTime =
  makeLockApiWithUpdateUnlockTime(tryAutoUnlockRabbyMobile);
export const unlockWalletWithUpdateUnlockTime =
  makeLockApiWithUpdateUnlockTime(unlockWallet);
export const safeVerifyPasswordAndUpdateUnlockTime =
  makeLockApiWithUpdateUnlockTime(safeVerifyPassword);

export function subscribeAppLock(fn: () => any) {
  keyringService.on('locked', fn);

  const dispose = () => {
    keyringService.off('locked', fn);
  };

  return dispose;
}
