import { isNonPublicProductionEnv } from '@/constant';
import { appMMKV } from '@/core/storage/mmkvInstances';
import { readZustandPersistedState } from '@/core/storage/mmkvJsonCompat';

import {
  DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD,
  DEFAULT_CURRENT_KEYCHAIN_VERSION,
  coerceCurrentKeychainVersion,
  type CurrentKeychainVersion,
} from './keychainVersionShared';

const EXPERIMENTAL_SETTINGS_STORE_KEY = '@ExperimentalSettings';

type ExperimentalSettingsSnapshot = Partial<
  Record<typeof DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD, unknown>
>;

function readExperimentalSettingsSnapshot(): ExperimentalSettingsSnapshot | null {
  return readZustandPersistedState(
    appMMKV.getString(EXPERIMENTAL_SETTINGS_STORE_KEY),
  ) as ExperimentalSettingsSnapshot | null;
}

export function getCurrentKeychainVersion(): CurrentKeychainVersion {
  if (!isNonPublicProductionEnv) {
    return DEFAULT_CURRENT_KEYCHAIN_VERSION;
  }

  return coerceCurrentKeychainVersion(
    readExperimentalSettingsSnapshot()?.[DEBUG_CURRENT_KEYCHAIN_VERSION_FIELD],
  );
}

export type { CurrentKeychainVersion };
