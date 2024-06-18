import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { BroadcastEvent } from '@/constant/event';
import { keyringService, sessionService } from '../services';

export const enum PasswordStatus {
  Unknown = -1,
  UseBuiltIn = 1,
  Custom = 11,
}

function getInitError(password: string) {
  if (password === RABBY_MOBILE_KR_PWD) {
    return {
      error: 'Incorret Password',
    };
  }

  return { error: '' };
}

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

export async function getRabbyLockInfo() {
  const info = {
    pwdStatus: PasswordStatus.Unknown,
    isUseBuiltInPwd: false,
    isUseCustomPwd: false,
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

export async function tryAutoUnlockRabbyMobile() {
  const isBooted = keyringService.isBooted();
  // // leave here for debugging
  console.debug(
    'tryAutoUnlockRabbyMobile:: RABBY_MOBILE_KR_PWD',
    RABBY_MOBILE_KR_PWD,
  );

  if (!isBooted) {
    await keyringService.boot(RABBY_MOBILE_KR_PWD);
  }

  const lockInfo = await getRabbyLockInfo();

  const useBuiltInPwd = lockInfo.pwdStatus === PasswordStatus.UseBuiltIn;
  try {
    if (useBuiltInPwd) {
      const isUnlocked = keyringService.isUnlocked();
      if (!isUnlocked) {
        await keyringService.submitPassword(RABBY_MOBILE_KR_PWD);
      }
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

export async function unlockWallet(password: string) {
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
