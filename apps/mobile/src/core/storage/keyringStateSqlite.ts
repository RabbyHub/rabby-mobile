import {
  isPersistedKeyringState,
  type LegacyKeyringStateResolution,
  type PersistedKeyringState,
} from './keyringStateMigration';

export type KeyringSqliteReadResult =
  | {
      status: 'valid';
      value: PersistedKeyringState;
    }
  | {
      /** A committed SQLite store with intentionally no keyring state. */
      status: 'empty';
    }
  | {
      /** No committed store marker exists yet, so this is an app upgrade. */
      status: 'uninitialized';
    }
  | {
      /** The installed native binary cannot provide encrypted SQLite yet. */
      status: 'unavailable';
      error: string;
    }
  | {
      /** Opening, querying, or decoding SQLite did not meet its contract. */
      status: 'semantic-error';
      error: string;
    };

/**
 * The native implementation owns SQLCipher and the transaction details. This
 * small interface keeps migration policy testable without a JSI database.
 */
export type KeyringSqliteStore = {
  read(): KeyringSqliteReadResult;
  bootstrap(value: PersistedKeyringState | null): void;
  write(value: PersistedKeyringState): void;
};

export type KeyringSqliteNormalizationResult = {
  keyringData: PersistedKeyringState | null;
  source:
    | 'sqlite'
    | 'sqlite-empty'
    | 'mmkv-bootstrap'
    | 'mmkv-unavailable'
    | 'mmkv-fallback'
    | 'sqlite-bootstrap-error'
    | 'sqlite-legacy-invalid';
  persistenceBlocked?: true;
  sqliteError?: string;
};

function getLegacyStateForSqlite(
  resolveLegacyState: () => LegacyKeyringStateResolution,
) {
  return resolveLegacyState();
}

function didVerifyBootstrap(
  result: KeyringSqliteReadResult,
  expectedValue: PersistedKeyringState | null,
) {
  if (!expectedValue) {
    return result.status === 'empty';
  }

  return (
    result.status === 'valid' &&
    JSON.stringify(result.value) === JSON.stringify(expectedValue)
  );
}

/**
 * SQLite becomes authoritative only after its bootstrap transaction writes an
 * initialization marker. A valid-but-empty SQLite store is therefore an
 * intentional empty wallet and must never resurrect a historical MMKV value.
 */
export function normalizeKeyringStateFromSqlite({
  sqliteStore,
  resolveLegacyState,
}: {
  sqliteStore: KeyringSqliteStore;
  resolveLegacyState: () => LegacyKeyringStateResolution;
}): KeyringSqliteNormalizationResult {
  const sqlite = sqliteStore.read();

  if (sqlite.status === 'valid') {
    return { keyringData: sqlite.value, source: 'sqlite' };
  }

  if (sqlite.status === 'empty') {
    return { keyringData: null, source: 'sqlite-empty' };
  }

  if (sqlite.status === 'uninitialized') {
    const legacy = getLegacyStateForSqlite(resolveLegacyState);

    // Do not commit an empty SQLite marker over a device whose only legacy
    // copy is already malformed. Keeping the upgrade retryable is safer than
    // making that corruption look like a deliberately empty wallet.
    if (legacy.persistenceBlocked) {
      return {
        keyringData: null,
        source: 'sqlite-legacy-invalid',
        persistenceBlocked: true,
      };
    }

    try {
      sqliteStore.bootstrap(legacy.keyringData);
      const verified = sqliteStore.read();
      if (!didVerifyBootstrap(verified, legacy.keyringData)) {
        throw new Error('Keyring SQLite bootstrap verification failed.');
      }
      return {
        keyringData: legacy.keyringData,
        source: legacy.keyringData ? 'mmkv-bootstrap' : 'sqlite-empty',
      };
    } catch (error) {
      return {
        keyringData: legacy.keyringData,
        source: 'sqlite-bootstrap-error',
        persistenceBlocked: true,
        sqliteError: getSqliteErrorMessage(error),
      };
    }
  }

  if (sqlite.status === 'unavailable') {
    const legacy = getLegacyStateForSqlite(resolveLegacyState);
    return {
      keyringData: legacy.keyringData,
      source: 'mmkv-unavailable',
      ...(legacy.persistenceBlocked
        ? { persistenceBlocked: true as const }
        : {}),
      sqliteError: sqlite.error,
    };
  }

  // SQLite was already selected, but opening/querying/decoding it failed.
  // This is the only steady-state path that reads retained MMKV data.
  const legacy = getLegacyStateForSqlite(resolveLegacyState);
  return {
    keyringData: legacy.keyringData,
    source: 'mmkv-fallback',
    persistenceBlocked: true,
    sqliteError: sqlite.error,
  };
}

export function persistKeyringStateToSqlite({
  sqliteStore,
  value,
}: {
  sqliteStore: KeyringSqliteStore;
  value: PersistedKeyringState;
}) {
  if (!isPersistedKeyringState(value)) {
    throw new Error('Refusing to persist an invalid keyring state shape.');
  }

  sqliteStore.write(value);

  const verified = sqliteStore.read();
  if (
    verified.status !== 'valid' ||
    JSON.stringify(verified.value) !== JSON.stringify(value)
  ) {
    throw new Error('Keyring SQLite persistence verification failed.');
  }
}

export function getSqliteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, ' ').slice(0, 160);
}
