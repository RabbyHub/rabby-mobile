import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { keyringService } from '../services';

const enum PasswordStatus {
  Unknown = -1,
  UseBuiltIn = 1,
  Custom = 11,
}

type RabbyUnlockResult = {
  pwdStatus: PasswordStatus;
};

function getLockInfo() {
  const info: RabbyUnlockResult = {
    pwdStatus: PasswordStatus.Unknown,
  };

  try {
    keyringService.verifyPassword(RABBY_MOBILE_KR_PWD);
    info.pwdStatus = PasswordStatus.UseBuiltIn;
  } catch (e) {
    info.pwdStatus = PasswordStatus.Custom;
  }

  return info;
}

export async function tryAutoUnlockRabbyMobile() {
  const isBooted = keyringService.isBooted();
  // // leave here for debugging
  console.debug(
    'tryAutoUnlockRabbyMobile:: RABBY_MOBILE_KR_PWD',
    RABBY_MOBILE_KR_PWD,
  );

  // if (!isBooted) {
  await keyringService.boot(RABBY_MOBILE_KR_PWD);
  // }

  const lockInfo = getLockInfo();

  const useBuiltInPwd = lockInfo.pwdStatus === PasswordStatus.UseBuiltIn;
  try {
    if (useBuiltInPwd) {
      const isUnlocked = keyringService.isUnlocked();
      if (!isUnlocked) {
        keyringService.submitPassword(RABBY_MOBILE_KR_PWD);
      }
    }
  } catch (e) {
    console.error('[tryAutoUnlockRabbyMobile]');
    console.error(e);
  }

  return {
    useBuiltInPwd,
  };
}
