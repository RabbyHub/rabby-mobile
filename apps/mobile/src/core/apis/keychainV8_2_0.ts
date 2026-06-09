import RNKeychain from '@rabby-wallet/react-native-keychain';

import {
  ANDROID_AUTH_PROMPT_POLICIES,
  KEYCHAIN_STORAGE_TYPES,
  DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
  DEFAULT_KEYCHAIN_STORAGE_TYPE,
  createBusinessKeychainApi,
  KEYCHAIN_AUTH_TYPES,
  KEYCHAIN_DEFAULT_SERVICE,
  KEYCHAIN_ERROR_CODES,
  RequestGenericPurpose,
  type AndroidAuthPromptPolicy,
  type KeychainStorageType,
  coerceKeychainStorageType,
  getDefaultBiometricsAuthenticationType,
  getAuthenticationType,
  getAuthenticationTypeLabel,
  isAuthenticatedByBiometrics,
  isBrokenBiometricsEntryError,
  makeKeyChainError,
  parseKeychainError,
  type DebugDecryptedKeychainPayload,
  type DebugGenericPasswordDecryptResult,
  type KeychainBusinessApi,
  type KeychainBusinessRequestResult,
  type KeychainCompatibleModule,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
  type SecureKeyChainInstance,
} from './keychainCommon';

const keychainApi = createBusinessKeychainApi({
  keychainModule: RNKeychain as unknown as KeychainCompatibleModule,
  debugNativeModuleName: 'RNRabbyKeychainManager',
  sourceLabel: '@rabby-wallet/react-native-keychain@8.2.0-fork',
});

export {
  ANDROID_AUTH_PROMPT_POLICIES,
  KEYCHAIN_STORAGE_TYPES,
  DEFAULT_ANDROID_AUTH_PROMPT_POLICY,
  DEFAULT_KEYCHAIN_STORAGE_TYPE,
  KEYCHAIN_AUTH_TYPES,
  KEYCHAIN_DEFAULT_SERVICE,
  KEYCHAIN_ERROR_CODES,
  RequestGenericPurpose,
  type AndroidAuthPromptPolicy,
  type KeychainStorageType,
  coerceKeychainStorageType,
  getDefaultBiometricsAuthenticationType,
  getAuthenticationType,
  getAuthenticationTypeLabel,
  isAuthenticatedByBiometrics,
  isBrokenBiometricsEntryError,
  makeKeyChainError,
  parseKeychainError,
  type DebugDecryptedKeychainPayload,
  type DebugGenericPasswordDecryptResult,
  type KeychainBusinessApi,
  type KeychainBusinessRequestResult,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
  type SecureKeyChainInstance,
};

export const KEYCHAIN_SOURCE_LABEL = keychainApi.KEYCHAIN_SOURCE_LABEL;
export const makeSecureKeyChainInstance =
  keychainApi.makeSecureKeyChainInstance;
export const requestGenericPassword = keychainApi.requestGenericPassword;
export const getSupportedBiometryType = keychainApi.getSupportedBiometryType;
export const isPasscodeAuthAvailable = keychainApi.isPasscodeAuthAvailable;
export const getKeychainDebugState = keychainApi.getKeychainDebugState;
export const debugRemoveCurrentCipherStorageMarker =
  keychainApi.debugRemoveCurrentCipherStorageMarker;
export const getSupportedStorageTypes = keychainApi.getSupportedStorageTypes;
export const debugWriteMockLegacyBiometricsEntry =
  keychainApi.debugWriteMockLegacyBiometricsEntry;
export const debugDecryptStoredPasswordPayload =
  keychainApi.debugDecryptStoredPasswordPayload;
export const debugDecryptGenericPassword =
  keychainApi.debugDecryptGenericPassword;
export const setGenericPassword = keychainApi.setGenericPassword;
export const migrateAndroidBiometricsToPasscode =
  keychainApi.migrateAndroidBiometricsToPasscode;
export const cacheTrustedVaultKeyString =
  keychainApi.cacheTrustedVaultKeyString;
export const resetGenericPassword = keychainApi.resetGenericPassword;
export const clearApplicationPassword = keychainApi.clearApplicationPassword;
