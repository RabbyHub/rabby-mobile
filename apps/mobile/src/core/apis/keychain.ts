import { EncryptorAdapter } from '@rabby-wallet/service-keyring';
import { Platform } from 'react-native';
import RNKeychain, { STORAGE_TYPE } from 'react-native-keychain';
import { MMKV } from 'react-native-mmkv';

import { appEncryptor } from '../services';
import i18n from '@/utils/i18n';
import * as apisLock from './lock';
import { MMKV_FILE_NAMES } from '../utils/appFS';

const storage = new MMKV({
  id: MMKV_FILE_NAMES.KEYCHAIN,
});

const KEYCHAIN_AUTH_TYPES_KEY = 'KEYCHAIN_AUTH_TYPES';
export enum KEYCHAIN_AUTH_TYPES {
  APPLICATION_PASSWORD = 0,
  BIOMETRICS = 1,
  PASSCODE = 2,
  REMEMBER_ME = 3,
}
function getAuthenticationType() {
  return (
    storage.getNumber(KEYCHAIN_AUTH_TYPES_KEY) ||
    KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD
  );
}
const authTypeRef = { current: getAuthenticationType() };
function setAuthenticationType(type?: KEYCHAIN_AUTH_TYPES) {
  authTypeRef.current = type || KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD;
  storage.set(KEYCHAIN_AUTH_TYPES_KEY, authTypeRef.current);
}
export function isAuthenticatedByBiometrics() {
  return authTypeRef.current === KEYCHAIN_AUTH_TYPES.BIOMETRICS;
}

const privates = new WeakMap();

type SKClsOptions = { encryptor: EncryptorAdapter; salt: string };

class SKCls {
  static instance: SKCls;

  isAuthenticating = false;

  private encryptor: EncryptorAdapter;

  constructor(options: { encryptor: EncryptorAdapter; salt: string }) {
    const { encryptor, salt } = options;
    if (!SKCls.instance) {
      privates.set(this, { salt });
      SKCls.instance = this;
    }

    this.encryptor = encryptor;

    return SKCls.instance;
  }

  async encryptPassword(password: string) {
    return this.encryptor.encrypt(privates.get(this).salt, { password });
  }

  async decryptPassword(encryptedPassword: string) {
    return this.encryptor.decrypt(
      privates.get(this).salt,
      encryptedPassword,
    ) as Promise<RNKeychain.UserCredentials>;
  }
}

const isAndroid = Platform.OS === 'android';
export function makeSecureKeyChainInstance(
  options: Omit<SKClsOptions, 'encryptor'>,
) {
  if (!SKCls.instance) {
    SKCls.instance = new SKCls({ ...options, encryptor: appEncryptor });
    Object.freeze(SKCls.instance);
  }

  // if (isAndroid && RNKeychain.SECURITY_LEVEL?.SECURE_HARDWARE)
  //   MetaMetrics.getInstance().trackEvent(
  //     MetaMetricsEvents.ANDROID_HARDWARE_KEYSTORE,
  //   );

  return SKCls.instance;
}

async function sleep(ms: number = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const gen = (function* genSecureKeychainInstance() {
  while (1) yield SKCls.instance;
})();

async function waitInstance() {
  while (!gen.next().value) {
    await sleep(200);
  }

  if (!SKCls.instance) {
    throw new Error('SKCls.instance is not initialized');
  }
  return SKCls.instance;
}

/* ===================== Biometrics:start ===================== */
const CANCELSTR = i18n.t('native.authentication.auth_prompt_cancel');
const DEFAULT_OPTIONS: RNKeychain.Options = {
  service: 'com.debank',
  authenticationPrompt: {
    title: i18n.t('native.authentication.auth_prompt_title'),
    // subtitle: '',
    description: i18n.t('native.authentication.auth_prompt_desc'),
    cancel: i18n.t('native.authentication.auth_prompt_cancel'),
  },
  authenticationType: RNKeychain.AUTHENTICATION_TYPE.BIOMETRICS,
  // accessControl: RNKeychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
  ...(isAndroid && {
    storage: STORAGE_TYPE.RSA,
    rules: RNKeychain.SECURITY_RULES.AUTOMATIC_UPGRADE,
  }),
};

const MsgCanceledByUsers = ['code: 10', 'code: 13', `msg: ${CANCELSTR}`];
export function parseKeychainError(error: any | Error) {
  const message = error instanceof Error ? error.message : error;
  // let codeInMessage ='';
  // try {
  //   const result = message.match(/code:\s?(\d+)/) || [];
  //   codeInMessage = result?.[1];
  // } catch (error) {}

  const isCancelledByUser =
    !!message && MsgCanceledByUsers.some(slug => message.includes(slug));

  return {
    isCancelledByUser,
    sysMessage: message.split(`msg:`)?.[1]?.trim() || '',
  };
}

const GENERIC_USER = 'rabbymobile-user';
export async function resetGenericPassword() {
  const result = await RNKeychain.resetGenericPassword({
    service: DEFAULT_OPTIONS.service,
  });

  if (result) {
    setAuthenticationType(KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD);
  }
  return result;
}

type KeyChainError = Error & {
  code: 'NIL_KEYCHAIN_OBJECT';
};
export function makeKeyChainError(code: 'NIL_KEYCHAIN_OBJECT', msg: string) {
  const error = new Error(msg);
  (error as KeyChainError).code = code;
  return error;
}

type PlainUserCredentials = RNKeychain.UserCredentials & {
  rawPassword?: string;
};
export enum RequestGenericPurpose {
  VERIFY = 1,
  // UNLOCK_WALLET = 2,
  DECRYPT_PWD = 11,
}
function onRequestReturn(instance: SKCls) {
  instance.isAuthenticating = false;
  return null;
}
type DefaultRet =
  | false
  | (Omit<PlainUserCredentials, 'password'> & {
      password?: PlainUserCredentials['password'];
      actionSuccess?: boolean;
    });
/**
 * @description request generic password from keychain,
 *
 * @warning Use corresponding purpose for your scenario instead.
 *
 */
export async function requestGenericPassword<
  T extends RequestGenericPurpose,
>(options: {
  purpose?: T;
  /**
   * @description will be called and AWAITED on purpose `DECRYPT_PWD`
   */
  onPlainPassword?: (password: string) => void | Promise<void>;
}): Promise<null | DefaultRet> {
  const instance = await waitInstance();
  const { purpose = RequestGenericPurpose.VERIFY as T, onPlainPassword } =
    options;

  try {
    instance.isAuthenticating = true;
    const keychainObject: DefaultRet = await RNKeychain.getGenericPassword({
      ...DEFAULT_OPTIONS,
    });

    if (!keychainObject) {
      throw makeKeyChainError(
        'NIL_KEYCHAIN_OBJECT',
        'Failed to retrieve keychain object',
      );
      // return onRequestReturn(instance);
    } else if (keychainObject.password) {
      const encryptedPassword = keychainObject.password;
      delete keychainObject.password;

      const decrypted = await instance.decryptPassword(encryptedPassword);

      switch (purpose) {
        case RequestGenericPurpose.VERIFY: {
          const verifyResult =
            await apisLock.safeVerifyPasswordAndUpdateUnlockTime(
              decrypted.password,
            );

          onRequestReturn(instance);
          return { ...keychainObject, actionSuccess: verifyResult.success };
        }
        case RequestGenericPurpose.DECRYPT_PWD: {
          await onPlainPassword?.(decrypted.password);
          apisLock.updateUnlockTime();
          onRequestReturn(instance);
          return { ...keychainObject, actionSuccess: true };
        }
        default: {
          if (__DEV__) {
            console.warn('requestGenericPassword: Invalid purpose', purpose);
          }
        }
      }

      return keychainObject;
    }

    return keychainObject;
  } catch (error: any) {
    instance.isAuthenticating = false;
    throw error instanceof Error ? error : new Error(error);
  }
}

export function getSupportedBiometryType() {
  // @see https://github.com/oblador/react-native-keychain?tab=readme-ov-file#getsupportedbiometrytype
  return RNKeychain.getSupportedBiometryType();
}

export async function setGenericPassword(
  password: string,
  type: KEYCHAIN_AUTH_TYPES = KEYCHAIN_AUTH_TYPES.BIOMETRICS,
) {
  const authOptions: Partial<RNKeychain.Options> = {
    accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  if (type === KEYCHAIN_AUTH_TYPES.BIOMETRICS) {
    authOptions.accessControl = RNKeychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET;
  } else if (type === KEYCHAIN_AUTH_TYPES.PASSCODE) {
    authOptions.accessControl = RNKeychain.ACCESS_CONTROL.DEVICE_PASSCODE;
  } else if (type === KEYCHAIN_AUTH_TYPES.REMEMBER_ME) {
    // Don't need to add any parameter
  } else {
    if (__DEV__) {
      console.warn('setGenericPassword: Invalid type', type);
    }
    // Setting a password without a type does not save it
    return resetGenericPassword();
  }

  const instance = await waitInstance();
  const encryptedPassword = await instance.encryptPassword(password);
  await RNKeychain.setGenericPassword(GENERIC_USER, encryptedPassword, {
    ...DEFAULT_OPTIONS,
    ...authOptions,
  });

  setAuthenticationType(type);
}

/* ===================== Biometrics:end ===================== */

export async function clearApplicationPassword(password: string) {
  return Promise.allSettled([
    apisLock.clearCustomPassword(password),
    resetGenericPassword(),
  ]).then(([appPwdResult, genericPwdResult]) => {
    return {
      clearCustomPasswordError:
        appPwdResult.status === 'rejected'
          ? new Error('Failed to clear custom password')
          : appPwdResult.value.error,
      clearGenericPasswordSuccess: genericPwdResult.status === 'fulfilled',
    };
  });
}
