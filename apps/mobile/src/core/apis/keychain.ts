import {
  getCurrentKeychainVersion,
  type CurrentKeychainVersion,
} from '@/hooks/appSettings';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

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
  type DebugGenericPasswordDecryptResult,
  type KeychainBusinessApi,
  type KeychainBusinessRequestResult,
  type KeychainDebugState,
  type KeychainSupportedBiometryType,
  type SecureKeyChainInstance,
} from './keychainCommon';
import { keychainMMKV } from '../storage/mmkvInstances';
import { KEYCHAIN_MMKV_KEYS } from '../storage/mmkvConstants';

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
  type DebugGenericPasswordDecryptResult,
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

const isAndroid = Platform.OS === 'android';

type SafeKeychainDebugState = Omit<
  Partial<KeychainDebugState>,
  'storedUsernameBase64' | 'storedPasswordBase64'
> & {
  hasStoredUsernameBase64?: boolean;
  hasStoredPasswordBase64?: boolean;
};

type KeychainBiometricsFailureDiagnostic = {
  recordedAt: number;
  stage: 'requestGenericPassword' | 'repairBiometricsAfterPasswordUnlock';
  currentVersion: CurrentKeychainVersion;
  currentSourceLabel: string;
  authenticationType: ReturnType<typeof getAuthenticationType>;
  authenticationTypeLabel: string;
  error: {
    code?: unknown;
    name?: string;
    message: string;
  };
  request?: {
    purpose?: unknown;
    androidAuthPromptPolicy?: unknown;
    androidAllowKeyStoreRecovery?: unknown;
    shouldAttachTrustedVaultKeyString?: unknown;
  };
  debugStates: {
    current: SafeKeychainDebugState | null;
    v8: SafeKeychainDebugState | null;
    v9: SafeKeychainDebugState | null;
  };
};

type RequestGenericPasswordOptions = Parameters<
  typeof apisKeychainV8_2_0.requestGenericPassword
>[0];

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

function getErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return error.code;
  }

  return undefined;
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : undefined;
}

function getLegacyBiometricsFallbackSkipReason(
  version: CurrentKeychainVersion,
  error: unknown,
) {
  if (!isAndroid) {
    return 'not-android';
  }

  if (version === '8.2.0-fork') {
    return 'already-legacy-version';
  }

  const authenticationType = getAuthenticationType();
  if (authenticationType !== KEYCHAIN_AUTH_TYPES.BIOMETRICS) {
    return `auth-type-${getAuthenticationTypeLabel(authenticationType)}`;
  }

  const parsed = parseKeychainError(error);
  if (parsed?.isCancelledByUser) {
    return 'cancelled-by-user';
  }

  return null;
}

function summarizeKeychainDebugState(
  state: KeychainDebugState,
): SafeKeychainDebugState {
  const { storedUsernameBase64, storedPasswordBase64, ...safeState } =
    state as KeychainDebugState & {
      storedUsernameBase64?: string | null;
      storedPasswordBase64?: string | null;
    };

  return {
    ...safeState,
    hasStoredUsernameBase64: !!storedUsernameBase64,
    hasStoredPasswordBase64: !!storedPasswordBase64,
  };
}

async function getSafeKeychainDebugState(
  getDebugState: () => Promise<KeychainDebugState>,
) {
  try {
    return summarizeKeychainDebugState(await getDebugState());
  } catch (error) {
    return {
      debugSupported: false,
      debugErrorMessage: getErrorMessage(error),
    };
  }
}

async function recordAndroidBiometricsFailureDiagnostic(options: {
  stage: KeychainBiometricsFailureDiagnostic['stage'];
  error: unknown;
  request?: KeychainBiometricsFailureDiagnostic['request'];
}) {
  if (
    !isAndroid ||
    getAuthenticationType() !== KEYCHAIN_AUTH_TYPES.BIOMETRICS
  ) {
    return null;
  }

  const currentVersion = getCurrentKeychainVersion();
  const currentApi = getKeychainApiByVersion(currentVersion);
  const diagnostic: KeychainBiometricsFailureDiagnostic = {
    recordedAt: Date.now(),
    stage: options.stage,
    currentVersion,
    currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
    authenticationType: getAuthenticationType(),
    authenticationTypeLabel: getAuthenticationTypeLabel(),
    error: {
      code: getErrorCode(options.error),
      name: getErrorName(options.error),
      message: getErrorMessage(options.error),
    },
    request: options.request,
    debugStates: {
      current: await getSafeKeychainDebugState(() =>
        currentApi.getKeychainDebugState(),
      ),
      v8: await getSafeKeychainDebugState(() =>
        apisKeychainV8_2_0.getKeychainDebugState(),
      ),
      v9: await getSafeKeychainDebugState(() =>
        apisKeychainV9_0_0.getKeychainDebugState(),
      ),
    },
  };

  keychainMMKV.set(
    KEYCHAIN_MMKV_KEYS.BIOMETRIC_FAILURE_DIAGNOSTIC,
    JSON.stringify(diagnostic),
  );
  logger.warn('[keychain] Android biometrics failure diagnostic recorded', {
    ...diagnostic,
  });

  return diagnostic;
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

export async function requestGenericPassword(
  ...args: Parameters<typeof apisKeychainV8_2_0.requestGenericPassword>
) {
  const currentVersion = getCurrentKeychainVersion();
  const currentApi = getKeychainApiByVersion(currentVersion);
  const requestOptions = args[0] || ({} as RequestGenericPasswordOptions);

  try {
    logger.info('[keychain] facade requestGenericPassword start', {
      currentVersion,
      currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
      authenticationTypeLabel: getAuthenticationTypeLabel(),
      request: {
        purpose: requestOptions.purpose,
        androidAuthPromptPolicy: requestOptions.androidAuthPromptPolicy,
        androidAllowKeyStoreRecovery:
          requestOptions.androidAllowKeyStoreRecovery,
        shouldAttachTrustedVaultKeyString:
          requestOptions.shouldAttachTrustedVaultKeyString,
      },
    });
    return await currentApi.requestGenericPassword(...args);
  } catch (error) {
    await recordAndroidBiometricsFailureDiagnostic({
      stage: 'requestGenericPassword',
      error,
      request: {
        purpose: requestOptions.purpose,
        androidAuthPromptPolicy: requestOptions.androidAuthPromptPolicy,
        androidAllowKeyStoreRecovery:
          requestOptions.androidAllowKeyStoreRecovery,
        shouldAttachTrustedVaultKeyString:
          requestOptions.shouldAttachTrustedVaultKeyString,
      },
    });

    const fallbackSkipReason = getLegacyBiometricsFallbackSkipReason(
      currentVersion,
      error,
    );
    logger.warn('[keychain] facade current requestGenericPassword failed', {
      currentVersion,
      currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
      authenticationTypeLabel: getAuthenticationTypeLabel(),
      fallbackSkipReason,
      error: {
        code: getErrorCode(error),
        name: getErrorName(error),
        message: getErrorMessage(error),
      },
    });

    if (fallbackSkipReason) {
      throw error;
    }

    let fallbackPlainPassword = '';
    let fallbackVaultKeyString: string | undefined;
    const fallbackOptions = {
      ...requestOptions,
      onPlainPassword: async (
        password: string,
        credentials: Parameters<
          NonNullable<RequestGenericPasswordOptions['onPlainPassword']>
        >[1],
      ) => {
        fallbackPlainPassword = password;
        fallbackVaultKeyString =
          typeof credentials?.vaultKeyString === 'string'
            ? credentials.vaultKeyString
            : undefined;
        logger.info('[keychain] legacy fallback plain password callback', {
          currentVersion,
          fallbackSourceLabel: apisKeychainV8_2_0.KEYCHAIN_SOURCE_LABEL,
          hasPlainPassword: !!password,
          hasVaultKeyString: !!fallbackVaultKeyString,
        });
        await requestOptions.onPlainPassword?.(password, credentials);
      },
    };

    try {
      logger.info('[keychain] trying legacy v8 biometrics fallback', {
        currentVersion,
        currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
        fallbackSourceLabel: apisKeychainV8_2_0.KEYCHAIN_SOURCE_LABEL,
      });
      const fallbackResult = await apisKeychainV8_2_0.requestGenericPassword(
        fallbackOptions,
      );

      let currentRewriteSucceeded = false;
      const shouldRewriteCurrentVersion =
        !requestOptions.skipCurrentVersionRewriteAfterLegacyFallback;
      if (fallbackPlainPassword && shouldRewriteCurrentVersion) {
        try {
          await currentApi.setGenericPassword(
            fallbackPlainPassword,
            KEYCHAIN_AUTH_TYPES.BIOMETRICS,
            fallbackVaultKeyString
              ? { vaultKeyString: fallbackVaultKeyString }
              : undefined,
          );
          currentRewriteSucceeded = true;
        } catch (repairError) {
          logger.warn(
            '[keychain] legacy fallback read succeeded but current rewrite failed',
            {
              currentVersion,
              currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
              fallbackSourceLabel: apisKeychainV8_2_0.KEYCHAIN_SOURCE_LABEL,
              repairError: {
                code: getErrorCode(repairError),
                message: getErrorMessage(repairError),
              },
            },
          );
        }
      }

      logger.warn(
        '[keychain] recovered Android biometrics through legacy v8 fallback',
        {
          currentVersion,
          currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
          fallbackSourceLabel: apisKeychainV8_2_0.KEYCHAIN_SOURCE_LABEL,
          originalError: {
            code: getErrorCode(error),
            message: getErrorMessage(error),
          },
          hasFallbackPlainPassword: !!fallbackPlainPassword,
          currentRewriteSkipped: !shouldRewriteCurrentVersion,
          currentRewriteSucceeded,
        },
      );

      return fallbackResult;
    } catch (fallbackError) {
      logger.warn('[keychain] Android legacy biometrics fallback failed', {
        currentVersion,
        currentSourceLabel: currentApi.KEYCHAIN_SOURCE_LABEL,
        originalError: {
          code: getErrorCode(error),
          message: getErrorMessage(error),
        },
        fallbackError: {
          code: getErrorCode(fallbackError),
          message: getErrorMessage(fallbackError),
        },
      });
    }

    throw error;
  }
}

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

export const debugDecryptGenericPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.debugDecryptGenericPassword>
) => getCurrentKeychainApi().debugDecryptGenericPassword(...args);

export const setGenericPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.setGenericPassword>
) => getCurrentKeychainApi().setGenericPassword(...args);

export const cacheTrustedVaultKeyString = (
  ...args: Parameters<typeof apisKeychainV8_2_0.cacheTrustedVaultKeyString>
) => getCurrentKeychainApi().cacheTrustedVaultKeyString(...args);

export async function repairBiometricsAfterPasswordUnlock(
  password: string,
  options: { reason?: string } = {},
) {
  const currentVersion = getCurrentKeychainVersion();
  const authType = getAuthenticationType();

  if (!isAndroid || authType !== KEYCHAIN_AUTH_TYPES.BIOMETRICS) {
    return {
      repaired: false,
      skipped: true,
      reason: !isAndroid ? 'not-android' : 'not-biometrics-auth',
    } as const;
  }

  try {
    await getKeychainApiByVersion(currentVersion).setGenericPassword(
      password,
      KEYCHAIN_AUTH_TYPES.BIOMETRICS,
    );
    logger.info(
      '[keychain] repaired Android biometrics after password unlock',
      {
        currentVersion,
        sourceLabel:
          getKeychainApiByVersion(currentVersion).KEYCHAIN_SOURCE_LABEL,
        reason: options.reason,
      },
    );

    return {
      repaired: true,
      skipped: false,
      currentVersion,
    } as const;
  } catch (error) {
    logger.warn(
      '[keychain] failed to repair Android biometrics after password unlock',
      {
        currentVersion,
        sourceLabel:
          getKeychainApiByVersion(currentVersion).KEYCHAIN_SOURCE_LABEL,
        reason: options.reason,
        error: getErrorMessage(error),
      },
    );
    await recordAndroidBiometricsFailureDiagnostic({
      stage: 'repairBiometricsAfterPasswordUnlock',
      error,
    });

    return {
      repaired: false,
      skipped: false,
      currentVersion,
      error: getErrorMessage(error),
    } as const;
  }
}

export const resetGenericPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.resetGenericPassword>
) => getCurrentKeychainApi().resetGenericPassword(...args);

export const clearApplicationPassword = (
  ...args: Parameters<typeof apisKeychainV8_2_0.clearApplicationPassword>
) => getCurrentKeychainApi().clearApplicationPassword(...args);
