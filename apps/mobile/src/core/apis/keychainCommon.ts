import { EncryptorAdapter } from '@rabby-wallet/service-keyring';
import { NativeModules, Platform } from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';

import i18n from '@/utils/i18n';
import { DEFAULT_RABBY_MOBILE_CODE } from '@/constant/env';
import { logger } from '@/utils/logger';
import { toast } from '@/components2024/Toast';

import { keychainMMKV } from '../storage/mmkvInstances';
import { KEYCHAIN_MMKV_KEYS } from '../storage/mmkvConstants';
import { appEncryptor, preferenceService } from '../services';
import * as apisLock from './lock';
import {
  getAndroidBiometricSecurityLevelOptions,
  type AndroidBiometricSecurityLevel,
} from './androidBiometricsRegression';

export const KEYCHAIN_DEFAULT_SERVICE = 'com.debank';
export const KEYCHAIN_GENERIC_USER = 'rabbymobile-user';
const KEYCHAIN_TRUSTED_VAULT_KEY_SERVICE = `${KEYCHAIN_DEFAULT_SERVICE}.trusted-vault-key`;
const KEYCHAIN_TRUSTED_VAULT_KEY_USER = 'rabbymobile-vault-key';
const LEGACY_RSA_STORAGE_TYPE = 'KeystoreRSAECB';
const AES_STORAGE_TYPE = 'KeystoreAESCBC';
const AES_GCM_STORAGE_TYPE = 'KeystoreAESGCM';
const AES_GCM_NO_AUTH_STORAGE_TYPE = 'KeystoreAESGCM_NoAuth';
const IOS_KEYCHAIN_STORAGE_TYPE = 'keychain';
const BROKEN_BIOMETRICS_ENTRY_MESSAGE =
  'Biometrics data could not be decrypted with the current keychain state. Inspect the keychain debug screen before resetting biometrics.';
const CANCELSTR = i18n.t('native.authentication.auth_prompt_cancel');
const isAndroid = Platform.OS === 'android';

let _rnBiometricsInstance: ReactNativeBiometrics | null = null;
function getRNBiometrics(): ReactNativeBiometrics {
  if (!_rnBiometricsInstance) {
    _rnBiometricsInstance = new ReactNativeBiometrics({
      allowDeviceCredentials: true,
    });
  }
  return _rnBiometricsInstance;
}

function traceAndroidKeychainPerf(
  event: string,
  data: Record<string, unknown> = {},
) {
  if (!isAndroid) {
    return;
  }

  logger.info(`[RabbyUnlockPerf:keychain] ${event}`, data);
  console.info('[RabbyUnlockPerf:keychain]', event, data);
}

export enum KEYCHAIN_AUTH_TYPES {
  APPLICATION_PASSWORD = 0,
  BIOMETRICS = 1,
  PASSCODE = 2,
  REMEMBER_ME = 3,
  BIOMETRICS_OR_PASSCODE = 4,
}

export enum RequestGenericPurpose {
  VERIFY = 1,
  DECRYPT_PWD = 11,
}

export const ANDROID_AUTH_PROMPT_POLICIES = {
  INTERACTIVE_FIRST: 'interactive-first',
  ALLOW_AUTHENTICATED_SESSION_REUSE: 'allow-authenticated-session-reuse',
} as const;

export const ANDROID_KEYCHAIN_AUTH_PROFILES = {
  BIOMETRIC_STRONG: 'biometric-strong-v1',
  DEVICE_CREDENTIAL: 'device-credential-v1',
  BIOMETRIC_OR_DEVICE_CREDENTIAL: 'biometric-or-device-credential-v1',
} as const;

export const KEYCHAIN_STORAGE_TYPES = {
  RSA: LEGACY_RSA_STORAGE_TYPE,
  AES: AES_STORAGE_TYPE,
  AES_GCM: AES_GCM_STORAGE_TYPE,
  AES_GCM_NO_AUTH: AES_GCM_NO_AUTH_STORAGE_TYPE,
  KC: IOS_KEYCHAIN_STORAGE_TYPE,
} as const;

export type AndroidAuthPromptPolicy =
  (typeof ANDROID_AUTH_PROMPT_POLICIES)[keyof typeof ANDROID_AUTH_PROMPT_POLICIES];
export type AndroidKeychainAuthProfile =
  (typeof ANDROID_KEYCHAIN_AUTH_PROFILES)[keyof typeof ANDROID_KEYCHAIN_AUTH_PROFILES];

export type KeychainStorageType =
  (typeof KEYCHAIN_STORAGE_TYPES)[keyof typeof KEYCHAIN_STORAGE_TYPES];

export const DEFAULT_ANDROID_AUTH_PROMPT_POLICY =
  ANDROID_AUTH_PROMPT_POLICIES.INTERACTIVE_FIRST;

export const DEFAULT_ANDROID_KEYCHAIN_STORAGE_TYPE =
  KEYCHAIN_STORAGE_TYPES.AES_GCM_NO_AUTH;
export const DEFAULT_IOS_KEYCHAIN_STORAGE_TYPE = KEYCHAIN_STORAGE_TYPES.KC;
export const DEFAULT_KEYCHAIN_STORAGE_TYPE = isAndroid
  ? DEFAULT_ANDROID_KEYCHAIN_STORAGE_TYPE
  : DEFAULT_IOS_KEYCHAIN_STORAGE_TYPE;

export type KeychainCompatibleOptions = {
  service?: string;
  accessible?: unknown;
  accessControl?: unknown;
  authenticationType?: unknown;
  authenticationPrompt?: {
    title?: string;
    description?: string;
    cancel?: string;
  };
  rules?: unknown;
  storage?: string;
  androidAllowAuthenticatedSessionReuse?: boolean;
  androidBiometricSecurityLevel?: AndroidBiometricSecurityLevel;
  androidKeychainAuthProfile?: AndroidKeychainAuthProfile;
  androidAllowKeyStoreRecovery?: boolean;
};

export type KeychainCompatibleUserCredentials = {
  service?: string;
  username: string;
  password: string;
  vaultKeyString?: string;
  storage?: string;
  androidKeychainAuthProfile?: AndroidKeychainAuthProfile;
  [key: string]: unknown;
};

export function coerceKeychainStorageType(
  storage: unknown,
): KeychainStorageType {
  switch (storage) {
    case KEYCHAIN_STORAGE_TYPES.RSA:
    case KEYCHAIN_STORAGE_TYPES.AES:
    case KEYCHAIN_STORAGE_TYPES.AES_GCM:
    case KEYCHAIN_STORAGE_TYPES.AES_GCM_NO_AUTH:
    case KEYCHAIN_STORAGE_TYPES.KC:
      return storage;
    default:
      return DEFAULT_KEYCHAIN_STORAGE_TYPE;
  }
}

function sortKeychainStorageTypes(
  storages: KeychainStorageType[],
): KeychainStorageType[] {
  const order: KeychainStorageType[] = [
    KEYCHAIN_STORAGE_TYPES.RSA,
    KEYCHAIN_STORAGE_TYPES.AES,
    KEYCHAIN_STORAGE_TYPES.AES_GCM,
    KEYCHAIN_STORAGE_TYPES.AES_GCM_NO_AUTH,
    KEYCHAIN_STORAGE_TYPES.KC,
  ];

  return [...storages].sort(
    (left, right) => order.indexOf(left) - order.indexOf(right),
  );
}

export type KeychainSupportedBiometryType = string | null;

export type KeychainCompatibleModule = {
  getGenericPassword: (
    options: KeychainCompatibleOptions,
  ) => Promise<false | KeychainCompatibleUserCredentials>;
  setGenericPassword: (
    username: string,
    password: string,
    options: KeychainCompatibleOptions,
  ) => Promise<unknown>;
  resetGenericPassword: (
    options: KeychainCompatibleOptions,
  ) => Promise<boolean>;
  getSupportedBiometryType: (
    options?: KeychainCompatibleOptions,
  ) => Promise<KeychainSupportedBiometryType>;
  isPasscodeAuthAvailable?: () => Promise<boolean>;
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: unknown;
  };
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: unknown;
    DEVICE_PASSCODE: unknown;
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: unknown;
  };
  AUTHENTICATION_TYPE: {
    BIOMETRICS: unknown;
    DEVICE_PASSCODE_OR_BIOMETRICS: unknown;
  };
  SECURITY_RULES: {
    AUTOMATIC_UPGRADE: unknown;
  };
};

export type NativeAndroidKeychainDebugState = {
  hasCipherStorageMarker: boolean;
  isCipherStorageMarkerMissing: boolean;
  storedUsernameBase64: string | null;
  storedPasswordBase64: string | null;
  storedCipherStorageMarkerValue: string | null;
  storedCipherStorageName: string | null;
  resolvedCipherStorageName: string | null;
  candidateCipherStorageNames: string[];
  cipherStorageResolutionStrategy: string | null;
  usernameByteSize: number | null;
  passwordByteSize: number | null;
  keystoreAlias: string | null;
  hasKeystoreAlias: boolean;
  keystoreKeyAlgorithm: string | null;
  keystoreSecurityLevel: string | null;
  keystoreInsideSecureHardware: boolean | null;
  keystoreUserAuthenticationRequired: boolean | null;
  keystoreUserAuthenticationValidityDurationSeconds: number | null;
  keystoreUserAuthenticationType: number | null;
  keystoreBlockModes: string | null;
  keystorePurposes: number | null;
  keystoreIsCompatibleWithCurrentCipher: boolean | null;
  keystorePublicKeySha256: string | null;
  keystoreDebugErrorMessage: string | null;
};

export type NativeIOSKeychainDebugState = {
  storageName: string | null;
  account: string | null;
  accessGroup: string | null;
  accessible: string | null;
  synchronizable: boolean | null;
  hasAccessControl: boolean;
  accessControlDescription: string | null;
  accessControlConstraints: string | null;
  itemClass: string | null;
  authenticationUIBlocked: boolean;
  nativeDebugErrorMessage: string | null;
};

type NativeKeychainDebugState =
  | NativeAndroidKeychainDebugState
  | NativeIOSKeychainDebugState;

type RNKeychainDebugModule = {
  debugGetGenericPasswordStateForOptions?: (
    options: KeychainCompatibleOptions,
  ) => Promise<NativeKeychainDebugState>;
  debugDecryptGenericPasswordForOptions?: (
    options: KeychainCompatibleOptions,
  ) => Promise<false | KeychainCompatibleUserCredentials>;
  debugRemoveCipherStorageMarkerForOptions?: (
    options: KeychainCompatibleOptions,
  ) => Promise<boolean>;
};

type PlainUserCredentials = KeychainCompatibleUserCredentials & {
  rawPassword?: string;
};

type DefaultRet =
  | false
  | (Omit<PlainUserCredentials, 'password'> & {
      password?: PlainUserCredentials['password'];
      actionSuccess?: boolean;
    });

type KeyChainErrorCode = keyof typeof KEYCHAIN_ERROR_CODES;
type KeyChainError = Error & {
  code: KeyChainErrorCode;
};

type CreateBusinessKeychainApiOptions = {
  keychainModule: KeychainCompatibleModule;
  debugNativeModuleName: string;
  sourceLabel: string;
  supportedAndroidStorageTypes?: KeychainStorageType[];
};

type SKClsOptions = { encryptor: EncryptorAdapter; salt: string };

const privates = new WeakMap<SecureKeyChainInstance, { salt: string }>();
const secureKeyChainInstanceRef = {
  current: null as SecureKeyChainInstance | null,
};

export type DebugDecryptedKeychainPayload = {
  password: string;
  vaultKeyString?: string;
};

export type DebugGenericPasswordDecryptResult = {
  credentials: KeychainCompatibleUserCredentials;
  decryptedPayload: DebugDecryptedKeychainPayload;
  usedFallbackRabbitCode: boolean;
};

type KeychainDebugStateBase = {
  service: string;
  hasEntry: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  debugSupported: boolean;
  debugErrorMessage: string | null;
  supportedBiometryType: KeychainSupportedBiometryType;
  authenticationType: KEYCHAIN_AUTH_TYPES;
  authenticationTypeLabel: string;
  isAuthenticatedByBiometrics: boolean;
  sourceLabel: string;
};

export type AndroidKeychainDebugState = KeychainDebugStateBase &
  NativeAndroidKeychainDebugState & {
    platform: 'android';
  };

export type IOSKeychainDebugState = KeychainDebugStateBase &
  NativeIOSKeychainDebugState & {
    platform: 'ios';
  };

export type KeychainDebugState =
  | AndroidKeychainDebugState
  | IOSKeychainDebugState;

function makeKeychainDebugStateBase(
  service: string,
  supportedBiometryType: KeychainSupportedBiometryType,
  sourceLabel: string,
): KeychainDebugStateBase {
  return {
    service,
    hasEntry: false,
    hasUsername: false,
    hasPassword: false,
    debugSupported: true,
    debugErrorMessage: null,
    supportedBiometryType,
    authenticationType: getAuthenticationType(),
    authenticationTypeLabel: getAuthenticationTypeLabel(),
    isAuthenticatedByBiometrics: isAuthenticatedByBiometrics(),
    sourceLabel,
  };
}

function makeAndroidKeychainDebugState(
  service: string,
  supportedBiometryType: KeychainSupportedBiometryType,
  sourceLabel: string,
): AndroidKeychainDebugState {
  return {
    ...makeKeychainDebugStateBase(service, supportedBiometryType, sourceLabel),
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

function makeIOSKeychainDebugState(
  service: string,
  supportedBiometryType: KeychainSupportedBiometryType,
  sourceLabel: string,
): IOSKeychainDebugState {
  return {
    ...makeKeychainDebugStateBase(service, supportedBiometryType, sourceLabel),
    platform: 'ios',
    storageName: IOS_KEYCHAIN_STORAGE_TYPE,
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

export function getAndroidAuthPromptPolicyOptions(
  policy: AndroidAuthPromptPolicy = DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
) {
  if (
    !isAndroid ||
    policy !== ANDROID_AUTH_PROMPT_POLICIES.ALLOW_AUTHENTICATED_SESSION_REUSE
  ) {
    return {};
  }

  return {
    androidAllowAuthenticatedSessionReuse: true,
  } as const;
}

export const KEYCHAIN_ERROR_CODES = {
  NIL_KEYCHAIN_OBJECT: 'NIL_KEYCHAIN_OBJECT',
  BROKEN_BIOMETRICS_ENTRY: 'BROKEN_BIOMETRICS_ENTRY',
} as const;

export class SecureKeyChainInstance {
  isAuthenticating = false;

  private encryptor: EncryptorAdapter;

  constructor(options: SKClsOptions) {
    const { encryptor, salt } = options;

    if (!secureKeyChainInstanceRef.current) {
      privates.set(this, { salt });
      secureKeyChainInstanceRef.current = this;
    }

    this.encryptor = encryptor;

    return secureKeyChainInstanceRef.current;
  }

  async encryptPassword(
    password: string,
    credentialsPatch: Partial<KeychainCompatibleUserCredentials> = {},
  ) {
    return this.encryptor.encrypt(privates.get(this)?.salt || '', {
      ...credentialsPatch,
      password,
    });
  }

  async decryptPassword(encryptedPassword: string) {
    return this.encryptor.decrypt(
      privates.get(this)?.salt || '',
      encryptedPassword,
    ) as Promise<KeychainCompatibleUserCredentials>;
  }

  getRabbitCode() {
    return privates.get(this)?.salt || '';
  }
}

export function getAuthenticationType() {
  const storedType = keychainMMKV.getNumber(
    KEYCHAIN_MMKV_KEYS.AUTHENTICATION_TYPE,
  );

  return typeof storedType === 'number'
    ? storedType
    : KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD;
}

export function getAuthenticationTypeLabel(type?: KEYCHAIN_AUTH_TYPES) {
  const currentType = type ?? getAuthenticationType();

  switch (currentType) {
    case KEYCHAIN_AUTH_TYPES.BIOMETRICS:
      return 'BIOMETRICS';
    case KEYCHAIN_AUTH_TYPES.PASSCODE:
      return 'PASSCODE';
    case KEYCHAIN_AUTH_TYPES.REMEMBER_ME:
      return 'REMEMBER_ME';
    case KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE:
      return 'BIOMETRICS_OR_PASSCODE';
    case KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD:
    default:
      return 'APPLICATION_PASSWORD';
  }
}

function setAuthenticationType(type?: KEYCHAIN_AUTH_TYPES) {
  keychainMMKV.set(
    KEYCHAIN_MMKV_KEYS.AUTHENTICATION_TYPE,
    type || KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD,
  );
}

export function isAuthenticatedByBiometrics() {
  const type = getAuthenticationType();
  return (
    type === KEYCHAIN_AUTH_TYPES.BIOMETRICS ||
    type === KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE
  );
}

export function getDefaultBiometricsAuthenticationType() {
  return isAndroid
    ? KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE
    : KEYCHAIN_AUTH_TYPES.BIOMETRICS;
}

function getPasscodeCapableAndroidAuthType(type: KEYCHAIN_AUTH_TYPES) {
  if (
    isAndroid &&
    (type === KEYCHAIN_AUTH_TYPES.BIOMETRICS ||
      type === KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE)
  ) {
    return KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE;
  }

  return type;
}

function sleep(ms: number = 1000) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function makeSecureKeyChainInstance(
  options: Omit<SKClsOptions, 'encryptor'>,
) {
  if (!secureKeyChainInstanceRef.current) {
    secureKeyChainInstanceRef.current = new SecureKeyChainInstance({
      ...options,
      encryptor: appEncryptor,
    });
    Object.freeze(secureKeyChainInstanceRef.current);
  }

  return secureKeyChainInstanceRef.current;
}

async function waitInstance() {
  while (!secureKeyChainInstanceRef.current) {
    await sleep(200);
  }

  if (!secureKeyChainInstanceRef.current) {
    throw new Error('SecureKeyChainInstance is not initialized');
  }

  return secureKeyChainInstanceRef.current;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
}

const canceledByUserMessages = ['code: 10', 'code: 13', `msg: ${CANCELSTR}`];

export function parseKeychainError(error: any | Error) {
  const message = getErrorMessage(error);
  const isCancelledByUser =
    !!message && canceledByUserMessages.some(slug => message.includes(slug));

  return {
    isCancelledByUser,
    sysMessage: message.split('msg:')?.[1]?.trim() || '',
  };
}

export function makeKeyChainError(
  code: KeyChainErrorCode,
  msg: string,
  extras?: Record<string, unknown>,
) {
  const error = new Error(msg) as KeyChainError & Record<string, unknown>;
  error.code = code;

  if (extras) {
    Object.assign(error, extras);
  }

  return error;
}

export function isBrokenBiometricsEntryError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === KEYCHAIN_ERROR_CODES.BROKEN_BIOMETRICS_ENTRY
  );
}

function isLegacyRsaBlobSize(size: number | null) {
  return size !== null && size > 0 && size % 256 === 0;
}

function matchesBrokenAndroidBiometricsEntry(
  state: KeychainDebugState,
): boolean {
  if (state.platform !== 'android') {
    return false;
  }

  return (
    state.hasEntry &&
    state.hasUsername &&
    state.hasPassword &&
    state.resolvedCipherStorageName === LEGACY_RSA_STORAGE_TYPE &&
    isLegacyRsaBlobSize(state.usernameByteSize) &&
    isLegacyRsaBlobSize(state.passwordByteSize) &&
    state.hasKeystoreAlias &&
    state.keystoreKeyAlgorithm === 'RSA' &&
    state.keystoreUserAuthenticationRequired === true &&
    state.keystoreIsCompatibleWithCurrentCipher === true
  );
}

export function createBusinessKeychainApi({
  keychainModule,
  debugNativeModuleName,
  sourceLabel,
  supportedAndroidStorageTypes,
}: CreateBusinessKeychainApiOptions) {
  const DEFAULT_BASE_OPTIONS: KeychainCompatibleOptions = {
    service: KEYCHAIN_DEFAULT_SERVICE,
  };
  const DEFAULT_SET_OPTIONS: KeychainCompatibleOptions = {
    ...DEFAULT_BASE_OPTIONS,
    storage: DEFAULT_KEYCHAIN_STORAGE_TYPE,
  };
  const DEFAULT_GET_OPTIONS: KeychainCompatibleOptions = {
    ...DEFAULT_BASE_OPTIONS,
    authenticationPrompt: {
      title: i18n.t('native.authentication.auth_prompt_title'),
      description: i18n.t('native.authentication.auth_prompt_desc'),
      cancel: i18n.t('native.authentication.auth_prompt_cancel'),
    },
    authenticationType:
      keychainModule.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
    ...(isAndroid && {
      rules: keychainModule.SECURITY_RULES.AUTOMATIC_UPGRADE,
    }),
  };
  const debugModule = (NativeModules as Record<string, unknown>)[
    debugNativeModuleName
  ] as RNKeychainDebugModule | undefined;

  async function callKeychainDebugMethod<R>(
    method: keyof RNKeychainDebugModule,
    options: KeychainCompatibleOptions = DEFAULT_BASE_OPTIONS,
  ): Promise<R> {
    const debugMethod = debugModule?.[method] as
      | ((nextOptions: KeychainCompatibleOptions) => Promise<R>)
      | undefined;

    if (typeof debugMethod !== 'function') {
      throw new Error(
        `${debugNativeModuleName}.${String(method)} is unavailable on ${
          Platform.OS
        }`,
      );
    }

    return debugMethod(options);
  }

  async function getSupportedStorageTypes(): Promise<KeychainStorageType[]> {
    if (!isAndroid) {
      return [KEYCHAIN_STORAGE_TYPES.KC];
    }

    return sortKeychainStorageTypes([
      ...(supportedAndroidStorageTypes || [
        KEYCHAIN_STORAGE_TYPES.RSA,
        KEYCHAIN_STORAGE_TYPES.AES,
      ]),
    ]);
  }

  async function getKeychainDebugState(
    service: string = KEYCHAIN_DEFAULT_SERVICE,
  ): Promise<KeychainDebugState> {
    const supportedBiometryType = await keychainModule
      .getSupportedBiometryType()
      .catch(() => null);
    if (!isAndroid) {
      const baseState = makeIOSKeychainDebugState(
        service,
        supportedBiometryType,
        sourceLabel,
      );

      try {
        const nativeState =
          await callKeychainDebugMethod<NativeIOSKeychainDebugState>(
            'debugGetGenericPasswordStateForOptions',
            {
              ...DEFAULT_GET_OPTIONS,
              ...getAndroidBiometricSecurityLevelOptions(),
              service,
            },
          );

        return {
          ...baseState,
          ...nativeState,
        };
      } catch (error) {
        return {
          ...baseState,
          debugSupported: false,
          debugErrorMessage:
            error instanceof Error ? error.message : String(error),
        };
      }
    }

    const baseState = makeAndroidKeychainDebugState(
      service,
      supportedBiometryType,
      sourceLabel,
    );

    try {
      const nativeState =
        await callKeychainDebugMethod<NativeAndroidKeychainDebugState>(
          'debugGetGenericPasswordStateForOptions',
          {
            ...DEFAULT_GET_OPTIONS,
            ...getAndroidBiometricSecurityLevelOptions(),
            service,
          },
        );

      return {
        ...baseState,
        ...nativeState,
      };
    } catch (error) {
      return {
        ...baseState,
        debugSupported: false,
        debugErrorMessage:
          error instanceof Error ? error.message : String(error),
      };
    }
  }

  async function normalizeRequestGenericPasswordError(error: unknown) {
    const normalizedError =
      error instanceof Error ? error : new Error(getErrorMessage(error));
    const message = getErrorMessage(error);
    const shouldCheckBrokenBiometricsEntry =
      isAndroid &&
      isAuthenticatedByBiometrics() &&
      message.includes('RSA decrypt failed on both current and legacy paths');

    if (!shouldCheckBrokenBiometricsEntry) {
      return normalizedError;
    }

    const debugState = await getKeychainDebugState().catch(() => null);
    if (!debugState || !matchesBrokenAndroidBiometricsEntry(debugState)) {
      return normalizedError;
    }

    return makeKeyChainError(
      KEYCHAIN_ERROR_CODES.BROKEN_BIOMETRICS_ENTRY,
      BROKEN_BIOMETRICS_ENTRY_MESSAGE,
      {
        debugState,
        nativeMessage: message,
      },
    );
  }

  function onRequestReturn(instance: SecureKeyChainInstance) {
    instance.isAuthenticating = false;
    return null;
  }

  function getAuthOptionsForType(type: KEYCHAIN_AUTH_TYPES) {
    const authOptions: Partial<KeychainCompatibleOptions> = {
      accessible: keychainModule.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    };

    if (type === KEYCHAIN_AUTH_TYPES.BIOMETRICS) {
      authOptions.accessControl =
        keychainModule.ACCESS_CONTROL.BIOMETRY_CURRENT_SET;
      authOptions.androidKeychainAuthProfile =
        ANDROID_KEYCHAIN_AUTH_PROFILES.BIOMETRIC_STRONG;
    } else if (type === KEYCHAIN_AUTH_TYPES.PASSCODE) {
      authOptions.accessControl = keychainModule.ACCESS_CONTROL.DEVICE_PASSCODE;
      authOptions.androidKeychainAuthProfile =
        ANDROID_KEYCHAIN_AUTH_PROFILES.DEVICE_CREDENTIAL;
    } else if (type === KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE) {
      authOptions.accessControl =
        keychainModule.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
      authOptions.androidKeychainAuthProfile =
        ANDROID_KEYCHAIN_AUTH_PROFILES.BIOMETRIC_OR_DEVICE_CREDENTIAL;
    } else if (type !== KEYCHAIN_AUTH_TYPES.REMEMBER_ME) {
      return null;
    }

    return authOptions;
  }

  function getAndroidRequestAccessControl(
    authenticationType?: KEYCHAIN_AUTH_TYPES,
  ) {
    if (!isAndroid) {
      return undefined;
    }

    const explicitAccessControl = authenticationType
      ? getAuthOptionsForType(authenticationType)?.accessControl
      : undefined;
    if (explicitAccessControl) {
      return explicitAccessControl;
    }

    if (preferenceService.store.passwordIsAutoGenerated) {
      return keychainModule.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
    }

    return getAuthOptionsForType(getAuthenticationType())?.accessControl;
  }

  async function getGenericPasswordWithBiometricPrompt(
    options: KeychainCompatibleOptions,
  ) {
    const result = await keychainModule.getGenericPassword(options);
    const credentials = result as DefaultRet;

    if (
      isAndroid &&
      credentials &&
      credentials.password &&
      credentials.storage === KEYCHAIN_STORAGE_TYPES.AES_GCM_NO_AUTH &&
      isAuthenticatedByBiometrics()
    ) {
      const [supportedBiometry, passcodeAvailable] = await Promise.all([
        keychainModule.getSupportedBiometryType(),
        typeof keychainModule.isPasscodeAuthAvailable === 'function'
          ? keychainModule.isPasscodeAuthAvailable().catch(() => false)
          : Promise.resolve(false),
      ]);

      if (!supportedBiometry && !passcodeAvailable) {
        throw new Error(
          'msg: No authentication method (biometrics or device PIN) is available on this device',
        );
      }

      const promptResult = await getRNBiometrics().simplePrompt({
        promptMessage: i18n.t('native.authentication.auth_prompt_desc'),
      });
      if (!promptResult.success) {
        throw new Error(
          promptResult.error
            ? `msg: ${promptResult.error}`
            : `msg: ${CANCELSTR}`,
        );
      }
    }

    return result;
  }

  async function resetTrustedVaultKeyString() {
    try {
      await keychainModule.resetGenericPassword({
        service: KEYCHAIN_TRUSTED_VAULT_KEY_SERVICE,
      });
    } catch (error) {
      logger.warn('[keychain] failed to reset trusted vault key string', {
        sourceLabel,
        error: getErrorMessage(error),
      });
    }
  }

  async function setTrustedVaultKeyString(
    vaultKeyString: string,
    type: KEYCHAIN_AUTH_TYPES,
  ) {
    const authOptions = getAuthOptionsForType(type);

    if (!authOptions) {
      await resetTrustedVaultKeyString();
      return;
    }

    await keychainModule.setGenericPassword(
      KEYCHAIN_TRUSTED_VAULT_KEY_USER,
      vaultKeyString,
      {
        ...DEFAULT_SET_OPTIONS,
        ...getAndroidBiometricSecurityLevelOptions(),
        ...authOptions,
        service: KEYCHAIN_TRUSTED_VAULT_KEY_SERVICE,
      },
    );
  }

  async function getTrustedVaultKeyString() {
    if (getAuthenticationType() === KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD) {
      return undefined;
    }

    const startedAt = Date.now();
    traceAndroidKeychainPerf('trusted_vault_key_lookup_start');

    try {
      const trustedVaultKeyObject = (await keychainModule.getGenericPassword({
        ...DEFAULT_GET_OPTIONS,
        ...getAndroidBiometricSecurityLevelOptions(),
        service: KEYCHAIN_TRUSTED_VAULT_KEY_SERVICE,
        ...getAndroidAuthPromptPolicyOptions(
          ANDROID_AUTH_PROMPT_POLICIES.ALLOW_AUTHENTICATED_SESSION_REUSE,
        ),
      })) as DefaultRet;

      if (
        trustedVaultKeyObject &&
        typeof trustedVaultKeyObject.password === 'string'
      ) {
        traceAndroidKeychainPerf('trusted_vault_key_lookup_end', {
          elapsedMs: Date.now() - startedAt,
          hit: true,
        });
        return trustedVaultKeyObject.password;
      }
    } catch (error) {
      traceAndroidKeychainPerf('trusted_vault_key_lookup_error', {
        elapsedMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      });
      logger.info('[keychain] trusted vault key string is unavailable', {
        sourceLabel,
        error: getErrorMessage(error),
      });
    }

    traceAndroidKeychainPerf('trusted_vault_key_lookup_end', {
      elapsedMs: Date.now() - startedAt,
      hit: false,
    });
    return undefined;
  }

  async function attachTrustedVaultKeyString(
    credentials: KeychainCompatibleUserCredentials,
  ): Promise<KeychainCompatibleUserCredentials> {
    if (credentials.vaultKeyString) {
      return credentials;
    }

    const vaultKeyString = await getTrustedVaultKeyString();

    if (!vaultKeyString) {
      return credentials;
    }

    return {
      ...credentials,
      vaultKeyString,
    };
  }

  function shouldUpgradeLegacyAndroidBiometricsStorage(storage?: string) {
    return (
      isAndroid &&
      isAuthenticatedByBiometrics() &&
      (storage === LEGACY_RSA_STORAGE_TYPE ||
        getAuthenticationType() === KEYCHAIN_AUTH_TYPES.BIOMETRICS)
    );
  }

  async function upgradeLegacyAndroidBiometricsStorage(
    plainPassword: string,
    storage?: string,
    credentialsPatch: Partial<KeychainCompatibleUserCredentials> = {},
  ) {
    if (!shouldUpgradeLegacyAndroidBiometricsStorage(storage)) {
      return;
    }

    try {
      await setGenericPassword(
        plainPassword,
        KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
        {
          vaultKeyString: credentialsPatch.vaultKeyString,
        },
      );
    } catch (error) {
      if (__DEV__) {
        console.warn(
          'upgradeLegacyAndroidBiometricsStorage failed',
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  async function normalizeEmbeddedTrustedVaultKeyString(
    plainPassword: string,
    decrypted: KeychainCompatibleUserCredentials,
  ) {
    if (!decrypted.vaultKeyString) {
      return;
    }

    const authType = getAuthenticationType();

    if (authType === KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD) {
      return;
    }

    try {
      await setGenericPassword(plainPassword, authType, {
        vaultKeyString: decrypted.vaultKeyString,
      });
      logger.info(
        '[keychain] normalized embedded trusted vault key out of primary credentials',
        {
          sourceLabel,
          authType,
        },
      );
    } catch (error) {
      logger.warn('[keychain] failed to normalize embedded trusted vault key', {
        sourceLabel,
        authType,
        error: getErrorMessage(error),
      });
    }
  }

  async function decryptStoredPasswordWithRabbitCodeCandidates(
    instance: SecureKeyChainInstance,
    encryptedPassword: string,
  ) {
    const currentRabbitCode = instance.getRabbitCode();
    const rabbitCodeCandidates = [
      currentRabbitCode,
      DEFAULT_RABBY_MOBILE_CODE,
    ].filter(
      (candidate, index, candidates): candidate is string =>
        !!candidate && candidates.indexOf(candidate) === index,
    );
    let lastError: unknown = null;

    for (const rabbitCodeCandidate of rabbitCodeCandidates) {
      try {
        const decrypted = (await appEncryptor.decrypt(
          rabbitCodeCandidate,
          encryptedPassword,
        )) as KeychainCompatibleUserCredentials;

        return {
          decrypted,
          usedFallbackRabbitCode: rabbitCodeCandidate !== currentRabbitCode,
        };
      } catch (error) {
        lastError = error;

        if (
          rabbitCodeCandidate === currentRabbitCode &&
          rabbitCodeCandidates.length > 1
        ) {
          logger.info(
            '[keychain] current rabbitCode failed to decrypt stored credentials, trying fallback candidate',
            {
              sourceLabel,
              candidateCount: rabbitCodeCandidates.length,
            },
          );
        }
      }
    }

    throw lastError;
  }

  async function silentlyUpgradeStoredPasswordPayload(
    plainPassword: string,
    credentialsPatch: Partial<KeychainCompatibleUserCredentials> = {},
  ) {
    const authType = getAuthenticationType();
    const nextAuthType = getPasscodeCapableAndroidAuthType(authType);

    if (authType === KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD) {
      return;
    }

    try {
      await setGenericPassword(plainPassword, nextAuthType, {
        vaultKeyString: credentialsPatch.vaultKeyString,
      });
      logger.info(
        '[keychain] rewrote stored credentials with the current rabbitCode after fallback decrypt',
        {
          sourceLabel,
          authType,
          nextAuthType,
        },
      );
    } catch (error) {
      logger.warn(
        '[keychain] failed to rewrite stored credentials with the current rabbitCode',
        {
          sourceLabel,
          authType,
          nextAuthType,
          error: getErrorMessage(error),
        },
      );
    }
  }

  async function requestGenericPassword<T extends RequestGenericPurpose>({
    purpose = RequestGenericPurpose.VERIFY as T,
    onPlainPassword,
    androidAuthPromptPolicy = DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
    androidAllowKeyStoreRecovery = false,
    shouldAttachTrustedVaultKeyString = true,
    authenticationType,
    skipLegacyAndroidBiometricsStorageUpgrade = false,
    skipPostDecryptKeychainRewrite = false,
  }: {
    purpose?: T;
    onPlainPassword?: (
      password: string,
      credentials: KeychainCompatibleUserCredentials,
    ) => void | Promise<void>;
    androidAuthPromptPolicy?: AndroidAuthPromptPolicy;
    androidAllowKeyStoreRecovery?: boolean;
    shouldAttachTrustedVaultKeyString?: boolean;
    authenticationType?: KEYCHAIN_AUTH_TYPES;
    skipLegacyAndroidBiometricsStorageUpgrade?: boolean;
    skipPostDecryptKeychainRewrite?: boolean;
  }): Promise<null | DefaultRet> {
    const instance = await waitInstance();
    const startedAt = Date.now();

    try {
      instance.isAuthenticating = true;
      traceAndroidKeychainPerf('request_generic_password_start', {
        purpose,
        androidAuthPromptPolicy,
        androidAllowKeyStoreRecovery,
        shouldAttachTrustedVaultKeyString,
        skipPostDecryptKeychainRewrite,
      });
      const androidAccessControl =
        getAndroidRequestAccessControl(authenticationType);

      const keychainObject = (await getGenericPasswordWithBiometricPrompt({
        ...DEFAULT_GET_OPTIONS,
        ...getAndroidBiometricSecurityLevelOptions(),
        ...getAndroidAuthPromptPolicyOptions(androidAuthPromptPolicy),
        // Access control is only used by Android when requesting device authentication
        // For iOS, the access control is derived from the access control when the password was stored
        accessControl: isAndroid ? androidAccessControl : undefined,
        ...(isAndroid ? { androidAllowKeyStoreRecovery } : {}),
      })) as DefaultRet;
      traceAndroidKeychainPerf('request_generic_password_native_end', {
        elapsedMs: Date.now() - startedAt,
        hasPassword: !!keychainObject && !!keychainObject.password,
        storage:
          keychainObject && typeof keychainObject.storage === 'string'
            ? keychainObject.storage
            : undefined,
      });

      if (!keychainObject) {
        throw makeKeyChainError(
          'NIL_KEYCHAIN_OBJECT',
          'Failed to retrieve keychain object',
        );
      }

      if (keychainObject.password) {
        const encryptedPassword = keychainObject.password;
        delete keychainObject.password;

        traceAndroidKeychainPerf('decrypt_password_payload_start', {
          elapsedMs: Date.now() - startedAt,
        });
        const { decrypted, usedFallbackRabbitCode } =
          await decryptStoredPasswordWithRabbitCodeCandidates(
            instance,
            encryptedPassword,
          );
        traceAndroidKeychainPerf('decrypt_password_payload_end', {
          elapsedMs: Date.now() - startedAt,
          usedFallbackRabbitCode,
          hasEmbeddedVaultKeyString: !!decrypted.vaultKeyString,
        });

        const maybeRewriteStoredCredentialsAfterDecrypt = async () => {
          if (skipPostDecryptKeychainRewrite) {
            traceAndroidKeychainPerf('post_decrypt_keychain_rewrite_skipped', {
              elapsedMs: Date.now() - startedAt,
              usedFallbackRabbitCode,
              hasEmbeddedVaultKeyString: !!decrypted.vaultKeyString,
            });
            return;
          }

          if (usedFallbackRabbitCode) {
            await silentlyUpgradeStoredPasswordPayload(
              decrypted.password,
              decrypted,
            );
          } else if (decrypted.vaultKeyString) {
            await normalizeEmbeddedTrustedVaultKeyString(
              decrypted.password,
              decrypted,
            );
          } else if (!skipLegacyAndroidBiometricsStorageUpgrade) {
            await upgradeLegacyAndroidBiometricsStorage(
              decrypted.password,
              typeof keychainObject.storage === 'string'
                ? keychainObject.storage
                : undefined,
              decrypted,
            );
          }
        };

        switch (purpose) {
          case RequestGenericPurpose.VERIFY: {
            const verifyResult =
              await apisLock.safeVerifyPasswordAndUpdateUnlockTime(
                decrypted.password,
              );
            if (verifyResult.success) {
              await maybeRewriteStoredCredentialsAfterDecrypt();
            }

            onRequestReturn(instance);
            return { ...keychainObject, actionSuccess: verifyResult.success };
          }
          case RequestGenericPurpose.DECRYPT_PWD: {
            const credentialsWithVaultKey = shouldAttachTrustedVaultKeyString
              ? await attachTrustedVaultKeyString(decrypted)
              : decrypted;
            if (
              !shouldAttachTrustedVaultKeyString &&
              !credentialsWithVaultKey.vaultKeyString
            ) {
              traceAndroidKeychainPerf('trusted_vault_key_lookup_skipped', {
                elapsedMs: Date.now() - startedAt,
                reason: 'unlock_critical_path',
              });
            }
            traceAndroidKeychainPerf('plain_password_callback_start', {
              elapsedMs: Date.now() - startedAt,
              hasTrustedVaultKeyString:
                !!credentialsWithVaultKey.vaultKeyString,
            });
            await onPlainPassword?.(
              credentialsWithVaultKey.password,
              credentialsWithVaultKey,
            );
            traceAndroidKeychainPerf('plain_password_callback_end', {
              elapsedMs: Date.now() - startedAt,
              hasTrustedVaultKeyString:
                !!credentialsWithVaultKey.vaultKeyString,
            });
            apisLock.updateUnlockTime();
            await maybeRewriteStoredCredentialsAfterDecrypt();
            onRequestReturn(instance);
            traceAndroidKeychainPerf('request_generic_password_end', {
              elapsedMs: Date.now() - startedAt,
              actionSuccess: true,
            });
            return { ...keychainObject, actionSuccess: true };
          }
          default: {
            if (__DEV__) {
              console.warn('requestGenericPassword: Invalid purpose', purpose);
            }
          }
        }
      }

      return keychainObject;
    } catch (error) {
      traceAndroidKeychainPerf('request_generic_password_error', {
        elapsedMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      });
      instance.isAuthenticating = false;
      const normalizedError = await normalizeRequestGenericPasswordError(error);
      const parsedInfo = parseKeychainError(normalizedError);
      if (!parsedInfo.isCancelledByUser) {
        toast.show(getErrorMessage(normalizedError));
      }
      throw normalizedError;
    }
  }

  async function resetGenericPassword() {
    const result = await keychainModule.resetGenericPassword({
      service: DEFAULT_BASE_OPTIONS.service,
    });
    await resetTrustedVaultKeyString();

    if (result) {
      setAuthenticationType(KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD);
    }

    return result;
  }

  async function debugRemoveCurrentCipherStorageMarker(
    service: string = KEYCHAIN_DEFAULT_SERVICE,
  ) {
    if (!isAndroid) {
      throw new Error(
        'Removing the Android keychain cipher storage marker is only supported on Android',
      );
    }

    await callKeychainDebugMethod<boolean>(
      'debugRemoveCipherStorageMarkerForOptions',
      { ...DEFAULT_BASE_OPTIONS, service },
    );

    return getKeychainDebugState(service);
  }

  async function debugWriteMockLegacyBiometricsEntry(
    plainPassword: string,
    options?: {
      omitCipherStorageMarker?: boolean;
      service?: string;
    },
  ) {
    if (!isAndroid) {
      throw new Error(
        'Mock legacy Android keychain data is only supported on Android',
      );
    }

    const {
      omitCipherStorageMarker = true,
      service = KEYCHAIN_DEFAULT_SERVICE,
    } = options || {};
    const instance = await waitInstance();
    const encryptedPassword = await instance.encryptPassword(plainPassword);

    await keychainModule.setGenericPassword(
      KEYCHAIN_GENERIC_USER,
      encryptedPassword,
      {
        ...DEFAULT_SET_OPTIONS,
        ...getAndroidBiometricSecurityLevelOptions(),
        service,
        accessible: keychainModule.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        accessControl: keychainModule.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        storage: LEGACY_RSA_STORAGE_TYPE,
      },
    );

    setAuthenticationType(KEYCHAIN_AUTH_TYPES.BIOMETRICS);

    if (omitCipherStorageMarker) {
      await callKeychainDebugMethod<boolean>(
        'debugRemoveCipherStorageMarkerForOptions',
        { ...DEFAULT_BASE_OPTIONS, service },
      );
    }

    return getKeychainDebugState(service);
  }

  async function debugDecryptStoredPasswordPayload(encryptedPassword: string) {
    const instance = await waitInstance();

    return instance.decryptPassword(
      encryptedPassword,
    ) as Promise<DebugDecryptedKeychainPayload>;
  }

  async function debugDecryptGenericPassword(options?: {
    androidAuthPromptPolicy?: AndroidAuthPromptPolicy;
    androidAllowKeyStoreRecovery?: boolean;
  }): Promise<DebugGenericPasswordDecryptResult> {
    const instance = await waitInstance();
    const startedAt = Date.now();
    const keychainOptions = {
      ...DEFAULT_GET_OPTIONS,
      ...getAndroidAuthPromptPolicyOptions(options?.androidAuthPromptPolicy),
      ...(isAndroid &&
      typeof options?.androidAllowKeyStoreRecovery === 'boolean'
        ? { androidAllowKeyStoreRecovery: options.androidAllowKeyStoreRecovery }
        : {}),
    };

    logger.info('[keychain-debug] debug generic decrypt start', {
      sourceLabel,
      androidAuthPromptPolicy: options?.androidAuthPromptPolicy,
      androidAllowKeyStoreRecovery: options?.androidAllowKeyStoreRecovery,
      authenticationTypeLabel: getAuthenticationTypeLabel(),
      nativeDebugDecrypt: !!debugModule?.debugDecryptGenericPasswordForOptions,
    });

    try {
      const keychainObject = debugModule?.debugDecryptGenericPasswordForOptions
        ? await debugModule.debugDecryptGenericPasswordForOptions(
            keychainOptions,
          )
        : ((await keychainModule.getGenericPassword(keychainOptions)) as
            | false
            | KeychainCompatibleUserCredentials);

      if (!keychainObject) {
        throw makeKeyChainError(
          'NIL_KEYCHAIN_OBJECT',
          'Failed to retrieve keychain object',
        );
      }

      const encryptedPassword = keychainObject.password;
      const { decrypted, usedFallbackRabbitCode } =
        await decryptStoredPasswordWithRabbitCodeCandidates(
          instance,
          encryptedPassword,
        );

      logger.info('[keychain-debug] debug generic decrypt success', {
        sourceLabel,
        elapsedMs: Date.now() - startedAt,
        storage: keychainObject.storage,
        usedFallbackRabbitCode,
        hasVaultKeyString: !!decrypted.vaultKeyString,
      });

      return {
        credentials: keychainObject,
        decryptedPayload: decrypted,
        usedFallbackRabbitCode,
      };
    } catch (error) {
      logger.warn('[keychain-debug] debug generic decrypt failed', {
        sourceLabel,
        elapsedMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async function setGenericPassword(
    password: string,
    type: KEYCHAIN_AUTH_TYPES = getDefaultBiometricsAuthenticationType(),
    options?: {
      storage?: KeychainStorageType;
      vaultKeyString?: string;
      skipTrustedVaultKeyStringWrite?: boolean;
    },
  ) {
    const authOptions = getAuthOptionsForType(type);

    if (!authOptions) {
      if (__DEV__) {
        console.warn('setGenericPassword: Invalid type', type);
      }

      return resetGenericPassword();
    }

    const instance = await waitInstance();
    const encryptedPassword = await instance.encryptPassword(password, {
      ...(isAndroid && authOptions.androidKeychainAuthProfile
        ? { androidKeychainAuthProfile: authOptions.androidKeychainAuthProfile }
        : null),
    });
    await keychainModule.setGenericPassword(
      KEYCHAIN_GENERIC_USER,
      encryptedPassword,
      {
        ...DEFAULT_SET_OPTIONS,
        ...getAndroidBiometricSecurityLevelOptions(),
        ...authOptions,
        ...(options?.storage ? { storage: options.storage } : null),
      },
    );

    setAuthenticationType(type);

    if (options?.vaultKeyString && !options.skipTrustedVaultKeyStringWrite) {
      try {
        await setTrustedVaultKeyString(options.vaultKeyString, type);
      } catch (error) {
        logger.warn('[keychain] failed to write trusted vault key string', {
          sourceLabel,
          authType: type,
          error: getErrorMessage(error),
        });
      }
    }
  }

  async function migrateAndroidBiometricsToPasscode(password: string) {
    if (
      !isAndroid ||
      getAuthenticationType() !== KEYCHAIN_AUTH_TYPES.BIOMETRICS
    ) {
      return false;
    }

    try {
      await setGenericPassword(
        password,
        KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
      );
      logger.info(
        '[keychain] migrated Android biometrics to passcode-capable auth',
        {
          sourceLabel,
        },
      );
      return true;
    } catch (error) {
      logger.warn(
        '[keychain] failed to migrate Android biometrics to passcode-capable auth',
        {
          sourceLabel,
          error: getErrorMessage(error),
        },
      );
      return false;
    }
  }

  async function cacheTrustedVaultKeyString(
    password: string,
    vaultKeyString: string,
  ) {
    const authType = getAuthenticationType();
    const nextAuthType = getPasscodeCapableAndroidAuthType(authType);

    if (authType === KEYCHAIN_AUTH_TYPES.APPLICATION_PASSWORD) {
      return;
    }

    const startedAt = Date.now();
    traceAndroidKeychainPerf('trusted_vault_key_cache_start', {
      authType,
      nextAuthType,
    });

    try {
      await setTrustedVaultKeyString(vaultKeyString, nextAuthType);
      traceAndroidKeychainPerf('trusted_vault_key_cache_separate_done', {
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      traceAndroidKeychainPerf('trusted_vault_key_cache_separate_error', {
        elapsedMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      });
      logger.warn('[keychain] failed to cache trusted vault key string', {
        sourceLabel,
        authType,
        error: getErrorMessage(error),
      });
    }
  }

  function getSupportedBiometryType() {
    return keychainModule.getSupportedBiometryType(
      getAndroidBiometricSecurityLevelOptions(),
    );
  }

  async function isPasscodeAuthAvailable() {
    if (
      !isAndroid ||
      typeof keychainModule.isPasscodeAuthAvailable !== 'function'
    ) {
      return false;
    }

    return keychainModule.isPasscodeAuthAvailable().catch(error => {
      logger.warn('[keychain] failed to check passcode auth availability', {
        sourceLabel,
        error: getErrorMessage(error),
      });
      return false;
    });
  }

  async function clearApplicationPassword(password: string) {
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

  return {
    ANDROID_AUTH_PROMPT_POLICIES,
    DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
    KEYCHAIN_DEFAULT_SERVICE,
    KEYCHAIN_SOURCE_LABEL: sourceLabel,
    makeSecureKeyChainInstance,
    getAuthenticationType,
    getAuthenticationTypeLabel,
    isAuthenticatedByBiometrics,
    getDefaultBiometricsAuthenticationType,
    parseKeychainError,
    makeKeyChainError,
    isBrokenBiometricsEntryError,
    requestGenericPassword,
    getSupportedBiometryType,
    isPasscodeAuthAvailable,
    getKeychainDebugState,
    debugRemoveCurrentCipherStorageMarker,
    getSupportedStorageTypes,
    debugWriteMockLegacyBiometricsEntry,
    debugDecryptStoredPasswordPayload,
    setGenericPassword,
    migrateAndroidBiometricsToPasscode,
    cacheTrustedVaultKeyString,
    resetGenericPassword,
    clearApplicationPassword,
    debugDecryptGenericPassword,
  };
}

export type KeychainBusinessApi = ReturnType<typeof createBusinessKeychainApi>;
export type KeychainBusinessRequestResult = Awaited<
  ReturnType<KeychainBusinessApi['requestGenericPassword']>
>;
