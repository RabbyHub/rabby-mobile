import OfficialKeychain, { type BaseOptions } from 'react-native-keychain';
import { NativeModules, Platform } from 'react-native';

import i18n from '@/utils/i18n';
import {
  ANDROID_AUTH_PROMPT_POLICIES,
  DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
  KEYCHAIN_STORAGE_TYPES,
  getAuthenticationType,
  getAuthenticationTypeLabel,
  getAndroidAuthPromptPolicyOptions,
  isAuthenticatedByBiometrics,
  KEYCHAIN_DEFAULT_SERVICE,
  type KeychainStorageType,
  type AndroidAuthPromptPolicy,
  type AndroidKeychainDebugState,
  type IOSKeychainDebugState,
  type KeychainCompatibleUserCredentials,
  type KeychainDebugState,
  type NativeAndroidKeychainDebugState,
  type NativeIOSKeychainDebugState,
} from './keychainCommon';

export {
  ANDROID_AUTH_PROMPT_POLICIES,
  DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
  KEYCHAIN_DEFAULT_SERVICE,
  KEYCHAIN_STORAGE_TYPES,
  type AndroidAuthPromptPolicy,
  type KeychainStorageType,
  type KeychainDebugState,
} from './keychainCommon';

const isAndroid = Platform.OS === 'android';
const GENERIC_USER = 'rabbymobile-user';
export const KEYCHAIN_PROBE_SERVICE = `${KEYCHAIN_DEFAULT_SERVICE}.rn-keychain-v10`;
export const KEYCHAIN_PROBE_PASSWORD = 'rn-keychain-v10-probe-password';
export const KEYCHAIN_SOURCE_LABEL = 'react-native-keychain@10.0.0 raw';

type RawOfficialOptions = BaseOptions & {
  accessible?: unknown;
  accessControl?: unknown;
  authenticationType?: unknown;
  authenticationPrompt?: {
    title?: string;
    subtitle?: string;
    description?: string;
    cancel?: string;
  };
  rules?: unknown;
  securityLevel?: unknown;
  storage?: KeychainStorageType;
  androidAllowAuthenticatedSessionReuse?: boolean;
};

type NativeKeychainDebugState =
  | NativeAndroidKeychainDebugState
  | NativeIOSKeychainDebugState;

type KeychainDebugModule = {
  debugGetGenericPasswordStateForOptions?: (
    options: RawOfficialOptions,
  ) => Promise<NativeKeychainDebugState>;
  debugRemoveCipherStorageMarkerForOptions?: (
    options: RawOfficialOptions,
  ) => Promise<boolean>;
};

const DEFAULT_BASE_OPTIONS: RawOfficialOptions = {
  service: KEYCHAIN_DEFAULT_SERVICE,
};

const DEFAULT_GET_OPTIONS: RawOfficialOptions = {
  ...DEFAULT_BASE_OPTIONS,
  authenticationPrompt: {
    title: i18n.t('native.authentication.auth_prompt_title'),
    description: i18n.t('native.authentication.auth_prompt_desc'),
    cancel: i18n.t('native.authentication.auth_prompt_cancel'),
  },
  authenticationType: OfficialKeychain.AUTHENTICATION_TYPE.BIOMETRICS,
  ...(isAndroid && {
    rules: OfficialKeychain.SECURITY_RULES.AUTOMATIC_UPGRADE,
  }),
};

const DEFAULT_BIOMETRIC_SET_OPTIONS: RawOfficialOptions = {
  service: KEYCHAIN_DEFAULT_SERVICE,
  accessible: OfficialKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  accessControl: OfficialKeychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
};

const RNKeychainDebugManager: KeychainDebugModule | undefined =
  NativeModules.RNKeychainManager;

function sortKeychainStorageTypes(
  storages: KeychainStorageType[],
): KeychainStorageType[] {
  const order = [
    KEYCHAIN_STORAGE_TYPES.RSA,
    KEYCHAIN_STORAGE_TYPES.AES,
    KEYCHAIN_STORAGE_TYPES.AES_GCM,
    KEYCHAIN_STORAGE_TYPES.KC,
  ];

  return [...storages].sort(
    (left, right) => order.indexOf(left) - order.indexOf(right),
  );
}

function toOfficialStorageType(
  storage?: KeychainStorageType,
): RawOfficialOptions['storage'] | undefined {
  return storage as RawOfficialOptions['storage'] | undefined;
}

function makeBaseStateCommon(service: string) {
  return {
    service,
    hasEntry: false,
    hasUsername: false,
    hasPassword: false,
    debugSupported: true,
    debugErrorMessage: null,
    supportedBiometryType: null,
    authenticationType: getAuthenticationType(),
    authenticationTypeLabel: getAuthenticationTypeLabel(),
    isAuthenticatedByBiometrics: isAuthenticatedByBiometrics(),
    sourceLabel: KEYCHAIN_SOURCE_LABEL,
  };
}

function makeAndroidBaseState(service: string): AndroidKeychainDebugState {
  return {
    ...makeBaseStateCommon(service),
    platform: 'android',
    hasCipherStorageMarker: false,
    isCipherStorageMarkerMissing: false,
    storedUsernameBase64: null,
    storedPasswordBase64: null,
    storedCipherStorageMarkerValue: null,
    storedCipherStorageName: null,
    resolvedCipherStorageName: null,
    candidateCipherStorageNames: [],
    cipherStorageResolutionStrategy: null,
    usernameByteSize: null,
    passwordByteSize: null,
    keystoreAlias: service,
    hasKeystoreAlias: false,
    keystoreKeyAlgorithm: null,
    keystoreSecurityLevel: null,
    keystoreInsideSecureHardware: null,
    keystoreUserAuthenticationRequired: null,
    keystoreUserAuthenticationValidityDurationSeconds: null,
    keystoreUserAuthenticationType: null,
    keystoreBlockModes: null,
    keystorePurposes: null,
    keystoreIsCompatibleWithCurrentCipher: null,
    keystorePublicKeySha256: null,
    keystoreDebugErrorMessage: null,
  };
}

function makeIOSBaseState(service: string): IOSKeychainDebugState {
  return {
    ...makeBaseStateCommon(service),
    platform: 'ios',
    storageName: KEYCHAIN_STORAGE_TYPES.KC,
    account: null,
    accessGroup: null,
    accessible: null,
    synchronizable: null,
    hasAccessControl: false,
    accessControlDescription: null,
    accessControlConstraints: null,
    itemClass: null,
    authenticationUIBlocked: false,
    nativeDebugErrorMessage: null,
  };
}

async function callDebugMethod<R>(
  method: keyof KeychainDebugModule,
  options: RawOfficialOptions,
): Promise<R> {
  const debugMethod = RNKeychainDebugManager?.[method] as
    | ((nextOptions: RawOfficialOptions) => Promise<R>)
    | undefined;

  if (typeof debugMethod !== 'function') {
    throw new Error(
      `RNKeychainManager.${String(method)} is unavailable on ${Platform.OS}`,
    );
  }

  return debugMethod(options);
}

export async function getKeychainDebugState(
  service: string = KEYCHAIN_DEFAULT_SERVICE,
): Promise<KeychainDebugState> {
  const supportedBiometryType =
    await OfficialKeychain.getSupportedBiometryType().catch(() => null);
  if (!isAndroid) {
    const baseState = makeIOSBaseState(service);

    try {
      const nativeState = await callDebugMethod<NativeIOSKeychainDebugState>(
        'debugGetGenericPasswordStateForOptions',
        {
          ...DEFAULT_GET_OPTIONS,
          service,
        },
      );

      return {
        ...baseState,
        supportedBiometryType,
        ...nativeState,
      };
    } catch (error) {
      return {
        ...baseState,
        debugSupported: false,
        supportedBiometryType,
        debugErrorMessage:
          error instanceof Error ? error.message : String(error),
      };
    }
  }

  const baseState = makeAndroidBaseState(service);

  try {
    const nativeState = await callDebugMethod<NativeAndroidKeychainDebugState>(
      'debugGetGenericPasswordStateForOptions',
      {
        ...DEFAULT_GET_OPTIONS,
        service,
      },
    );

    return {
      ...baseState,
      supportedBiometryType,
      ...nativeState,
    };
  } catch (error) {
    return {
      ...baseState,
      debugSupported: false,
      supportedBiometryType,
      debugErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function readGenericPassword(
  service: string = KEYCHAIN_DEFAULT_SERVICE,
  options?: {
    androidAuthPromptPolicy?: AndroidAuthPromptPolicy;
  },
): Promise<false | KeychainCompatibleUserCredentials> {
  return OfficialKeychain.getGenericPassword({
    ...DEFAULT_GET_OPTIONS,
    service,
    ...getAndroidAuthPromptPolicyOptions(options?.androidAuthPromptPolicy),
  } as Parameters<typeof OfficialKeychain.getGenericPassword>[0]);
}

export async function writeBiometricsEntry(
  password: string = KEYCHAIN_PROBE_PASSWORD,
  service: string = KEYCHAIN_PROBE_SERVICE,
  options?: {
    storage?: KeychainStorageType;
  },
) {
  return OfficialKeychain.setGenericPassword(GENERIC_USER, password, {
    ...DEFAULT_BIOMETRIC_SET_OPTIONS,
    service,
    ...(options?.storage
      ? { storage: toOfficialStorageType(options.storage) }
      : null),
  } as Parameters<typeof OfficialKeychain.setGenericPassword>[2]);
}

export async function getSupportedStorageTypes(): Promise<
  KeychainStorageType[]
> {
  if (!isAndroid) {
    return [KEYCHAIN_STORAGE_TYPES.KC];
  }

  return sortKeychainStorageTypes([
    KEYCHAIN_STORAGE_TYPES.RSA,
    KEYCHAIN_STORAGE_TYPES.AES,
    KEYCHAIN_STORAGE_TYPES.AES_GCM,
  ]);
}

export async function clearGenericPassword(
  service: string = KEYCHAIN_PROBE_SERVICE,
) {
  return OfficialKeychain.resetGenericPassword({
    service,
  });
}

export async function removeCipherMarker(
  service: string = KEYCHAIN_PROBE_SERVICE,
) {
  return callDebugMethod<boolean>('debugRemoveCipherStorageMarkerForOptions', {
    service,
  });
}
