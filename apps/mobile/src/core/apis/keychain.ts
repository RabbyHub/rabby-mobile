import {
  getCurrentKeychainVersion,
  type CurrentKeychainVersion,
} from '@/hooks/appSettings';

import * as apisKeychainV8_2_0 from './keychainV8_2_0';
import * as apisKeychainV9_0_0 from './keychainV9_0_0';
import * as apisKeychainV10_0_0 from './keychainV10_0_0';
import {
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
} from './keychainCommon';

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
  type CurrentKeychainVersion,
  type DebugDecryptedKeychainPayload,
  type KeychainBusinessApi,
  type KeychainBusinessRequestResult,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
  type SecureKeyChainInstance,
};

function getKeychainApiByVersion(version: CurrentKeychainVersion) {
  switch (version) {
    case '10.0.0':
      return apisKeychainV10_0_0;
    case '9.0.0':
      return apisKeychainV9_0_0;
    case '8.2.0-fork':
    default:
      return apisKeychainV8_2_0;
  }
}

export function getCurrentKeychainApi(): KeychainBusinessApi {
  return getKeychainApiByVersion(getCurrentKeychainVersion());
}

export function getCurrentKeychainSourceLabel() {
  return getCurrentKeychainApi().KEYCHAIN_SOURCE_LABEL;
}

export const makeSecureKeyChainInstance = (
  ...args: Parameters<typeof apisKeychainV8_2_0.makeSecureKeyChainInstance>
) => getCurrentKeychainApi().makeSecureKeyChainInstance(...args);

export const requestGenericPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.requestGenericPassword>
) => getCurrentKeychainApi().requestGenericPassword(...args);

export const getSupportedBiometryType =
  (): Promise<KeychainSupportedBiometryType> =>
    getCurrentKeychainApi().getSupportedBiometryType();

export const getKeychainDebugState = (
  ...args: Parameters<typeof apisKeychainV8_2_0.getKeychainDebugState>
) => getCurrentKeychainApi().getKeychainDebugState(...args);

export const debugRemoveCurrentCipherStorageMarker = (
  ...args: Parameters<
    typeof apisKeychainV8_2_0.debugRemoveCurrentCipherStorageMarker
  >
) => getCurrentKeychainApi().debugRemoveCurrentCipherStorageMarker(...args);

export const debugWriteMockLegacyBiometricsEntry = (
  ...args: Parameters<
    typeof apisKeychainV8_2_0.debugWriteMockLegacyBiometricsEntry
  >
) => getCurrentKeychainApi().debugWriteMockLegacyBiometricsEntry(...args);

export const getSupportedStorageTypes = (
  ...args: Parameters<typeof apisKeychainV8_2_0.getSupportedStorageTypes>
) => getCurrentKeychainApi().getSupportedStorageTypes(...args);

export const debugDecryptStoredPasswordPayload = (
  ...args: Parameters<
    typeof apisKeychainV8_2_0.debugDecryptStoredPasswordPayload
  >
) => getCurrentKeychainApi().debugDecryptStoredPasswordPayload(...args);

export const setGenericPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.setGenericPassword>
) => getCurrentKeychainApi().setGenericPassword(...args);

export const cacheTrustedVaultKeyString = (
  ...args: Parameters<typeof apisKeychainV8_2_0.cacheTrustedVaultKeyString>
) => getCurrentKeychainApi().cacheTrustedVaultKeyString(...args);

export const resetGenericPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.resetGenericPassword>
) => getCurrentKeychainApi().resetGenericPassword(...args);

export const clearApplicationPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.clearApplicationPassword>
) => getCurrentKeychainApi().clearApplicationPassword(...args);
