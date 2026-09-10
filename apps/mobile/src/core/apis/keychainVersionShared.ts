export const CURRENT_KEYCHAIN_VERSION_VALUES = ['9.0.0', '10.0.0'] as const;

export type CurrentKeychainVersion =
  (typeof CURRENT_KEYCHAIN_VERSION_VALUES)[number];

export const DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD =
  'debugCurrentKeychainVersion20260602' as const;

export const DEFAULT_CURRENT_KEYCHAIN_VERSION: CurrentKeychainVersion = '9.0.0';

export function coerceCurrentKeychainVersion(
  version: unknown,
): CurrentKeychainVersion {
  return CURRENT_KEYCHAIN_VERSION_VALUES.includes(
    version as CurrentKeychainVersion,
  )
    ? (version as CurrentKeychainVersion)
    : DEFAULT_CURRENT_KEYCHAIN_VERSION;
}

export function parseKeychainVersionDeepLinkValue(
  value: string | null,
): CurrentKeychainVersion | null {
  switch (value?.trim().toLowerCase()) {
    case '9':
    case 'v9':
    case '9.0.0':
      return '9.0.0';
    case '10':
    case 'v10':
    case '10.0.0':
      return '10.0.0';
    default:
      return null;
  }
}
