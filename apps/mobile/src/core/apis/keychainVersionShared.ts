export const CURRENT_KEYCHAIN_VERSION_VALUES = [
  '8.2.0-fork',
  '9.0.0',
  '10.0.0',
] as const;

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
