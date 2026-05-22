import OfficialKeychain from '@rabby-wallet/react-native-keychain-9';

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
  getAuthenticationType,
  getAuthenticationTypeLabel,
  isAuthenticatedByBiometrics,
  isBrokenBiometricsEntryError,
  makeKeyChainError,
  parseKeychainError,
  type DebugDecryptedKeychainPayload,
  type KeychainBusinessApi,
  type KeychainBusinessRequestResult,
  type KeychainCompatibleModule,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
  type SecureKeyChainInstance,
} from './keychainCommon';

const keychainApi = createBusinessKeychainApi({
  keychainModule: OfficialKeychain as unknown as KeychainCompatibleModule,
  debugNativeModuleName: 'RNRabbyKeychainV9Manager',
  sourceLabel: '@rabby-wallet/react-native-keychain-9@9.0.0-rabby.0',
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
  getAuthenticationType,
  getAuthenticationTypeLabel,
  isAuthenticatedByBiometrics,
  isBrokenBiometricsEntryError,
  makeKeyChainError,
  parseKeychainError,
  type DebugDecryptedKeychainPayload,
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
export const getKeychainDebugState = keychainApi.getKeychainDebugState;
export const debugRemoveCurrentCipherStorageMarker =
  keychainApi.debugRemoveCurrentCipherStorageMarker;
export const getSupportedStorageTypes = keychainApi.getSupportedStorageTypes;
export const debugWriteMockLegacyBiometricsEntry =
  keychainApi.debugWriteMockLegacyBiometricsEntry;
export const debugDecryptStoredPasswordPayload =
  keychainApi.debugDecryptStoredPasswordPayload;
export const setGenericPassword = keychainApi.setGenericPassword;
export const resetGenericPassword = keychainApi.resetGenericPassword;
export const clearApplicationPassword = keychainApi.clearApplicationPassword;
