import { EncryptorAdapter } from '@rabby-wallet/service-keyring';
import { Platform } from 'react-native';
import RNKeychain from 'react-native-keychain';
import { MMKV } from 'react-native-mmkv';

import { appEncryptor } from '../services';
import { strings } from '@/utils/i18n';
import { clearCustomPassword, safeVerifyPassword, unlockWallet } from './lock';

const storage = new MMKV({
  id: 'mmkv.keychain',
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
function setAuthenticationType(type?: KEYCHAIN_AUTH_TYPES) {
  storage.set(
    KEYCHAIN_AUTH_TYPES_KEY,
    type || KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD,
  );
}
export function isAuthenticatedByBiometrics() {
  return getAuthenticationType() === KEYCHAIN_AUTH_TYPES.BIOMETRICS;
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
    return this.encryptor.decrypt<RNKeychain.UserCredentials>(
      privates.get(this).salt,
      encryptedPassword,
    );
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
    await sleep(50);
  }

  if (!SKCls.instance) {
    throw new Error('SKCls.instance is not initialized');
  }
  return SKCls.instance;
}

/* ===================== Biometrics:start ===================== */
const DEFAULT_OPTIONS: Partial<RNKeychain.Options> = {
  service: 'com.debank',
  // authenticationPromptTitle: strings('native.authentication.auth_prompt_title'),
  authenticationPrompt: {
    title: strings('native.authentication.auth_prompt_desc'),
    // subtitle: '',
    description: strings('native.authentication.auth_prompt_desc'),
    cancel: strings('native.authentication.auth_prompt_cancel'),
  },
};

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

type PlainUserCredentials = RNKeychain.UserCredentials & {
  rawPassword?: string;
};
export enum RequestGenericPurpose {
  VERIFY_PWD = 1,
  // UNLOCK_WALLET = 2,
  DECRYPT_PWD = 11,
}
function onRequestReturn(instance: SKCls) {
  instance.isAuthenticating = false;
  return null;
}
type DefaultRet = false | (PlainUserCredentials & { actionSuccess?: boolean });
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
  onPlainPassword?: (password: string) => void | Promise<void>;
}): Promise<null | DefaultRet> {
  const instance = await waitInstance();
  const { purpose = RequestGenericPurpose.VERIFY_PWD as T, onPlainPassword } =
    options;

  try {
    instance.isAuthenticating = true;
    const keychainObject: DefaultRet = await RNKeychain.getGenericPassword({
      ...DEFAULT_OPTIONS,
    });

    if (!keychainObject) {
      return onRequestReturn(instance);
    } else if (keychainObject.password) {
      const encryptedPassword = keychainObject.password;
      const decrypted = await instance.decryptPassword(encryptedPassword);

      switch (purpose) {
        case RequestGenericPurpose.VERIFY_PWD: {
          const verifyResult = await safeVerifyPassword(decrypted.password);

          onRequestReturn(instance);
          return { ...keychainObject, actionSuccess: verifyResult.success };
        }
        case RequestGenericPurpose.DECRYPT_PWD: {
          await onPlainPassword?.(decrypted.password);
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
  return RNKeychain.getSupportedBiometryType({ ...DEFAULT_OPTIONS });
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
    return await resetGenericPassword();
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
    clearCustomPassword(password),
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
