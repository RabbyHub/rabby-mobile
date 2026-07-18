import { isNonPublicProductionEnv } from '@/constant';
import { appMMKV } from '@/core/storage/mmkvInstances';

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

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parsePossiblyNestedJson(value: string): unknown {
  const parsed = safeParseJson(value);

  if (typeof parsed === 'string') {
    return safeParseJson(parsed);
  }

  return parsed;
}

function readExperimentalSettingsSnapshot(): ExperimentalSettingsSnapshot | null {
  const raw = appMMKV.getString(EXPERIMENTAL_SETTINGS_STORE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = parsePossiblyNestedJson(raw);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const persisted = parsed as {
    state?: unknown;
  };

  if (persisted.state && typeof persisted.state === 'object') {
    return persisted.state as ExperimentalSettingsSnapshot;
  }

  return parsed as ExperimentalSettingsSnapshot;
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
