import { Platform } from 'react-native';
import {
  ANDROID_DATABASE_PATH,
  IOS_LIBRARY_PATH,
  isSQLCipher,
  open,
  type QueryResult,
  type Scalar,
} from '@op-engineering/op-sqlite';

import {
  getRabbyKeyringDbDir,
  getRabbyKeyringDbName,
} from '@/databases/constant';

import {
  getSqliteErrorMessage,
  type KeyringSqliteReadResult,
  type KeyringSqliteStore,
} from './keyringStateSqlite';
import {
  isPersistedKeyringState,
  type PersistedKeyringState,
} from './keyringStateMigration';

const KEYRING_SQLITE_SCHEMA_VERSION = '1';
const KEYRING_SQLITE_META_KEY = 'store-version';
const KEYRING_SQLITE_STATE_KEY = 'keyring-state';
const KEYRING_SQLITE_ENCRYPTION_KEY = 'keyring';

type SqliteRows = {
  length?: number;
  item?(index: number): Record<string, unknown>;
};

type KeyringSqliteDatabase = {
  executeSync(sql: string, params?: Scalar[]): QueryResult;
};

const keyringSqliteStoreRef = {
  current: null as KeyringSqliteStore | null,
};

function ensureTrailingSlash(path: string) {
  return path.endsWith('/') ? path : `${path}/`;
}

function getKeyringSqliteLocation() {
  return ensureTrailingSlash(
    getRabbyKeyringDbDir() ||
      (Platform.OS === 'ios' ? IOS_LIBRARY_PATH : ANDROID_DATABASE_PATH),
  );
}

function getRows(result: QueryResult): Record<string, unknown>[] {
  const rows = result.rows as unknown;
  if (Array.isArray(rows)) {
    return rows as Record<string, unknown>[];
  }

  const typedRows = rows as SqliteRows | undefined;
  const length = typedRows?.length || 0;
  if (!typedRows?.item) {
    return [];
  }

  return Array.from({ length }, (_, index) => typedRows.item!(index));
}

function execute(
  database: KeyringSqliteDatabase,
  sql: string,
  params: Scalar[] = [],
) {
  return database.executeSync(sql, params);
}

function createUnavailableStore(error: unknown): KeyringSqliteStore {
  const message = getSqliteErrorMessage(error);
  return {
    read: () => ({ status: 'unavailable', error: message }),
    bootstrap: () => {
      throw new Error(message);
    },
    write: () => {
      throw new Error(message);
    },
  };
}

function createKeyringSqliteStore(
  database: KeyringSqliteDatabase,
): KeyringSqliteStore {
  function ensureSchema() {
    execute(
      database,
      `CREATE TABLE IF NOT EXISTS keyring_store_meta (
        meta_key TEXT PRIMARY KEY NOT NULL,
        meta_value TEXT NOT NULL
      )`,
    );
    execute(
      database,
      `CREATE TABLE IF NOT EXISTS keyring_state (
        state_key TEXT PRIMARY KEY NOT NULL,
        state_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
  }

  function read(): KeyringSqliteReadResult {
    try {
      ensureSchema();
      const metaRows = getRows(
        execute(
          database,
          'SELECT meta_value FROM keyring_store_meta WHERE meta_key = ?',
          [KEYRING_SQLITE_META_KEY],
        ),
      );
      const stateRows = getRows(
        execute(
          database,
          'SELECT state_value FROM keyring_state WHERE state_key = ?',
          [KEYRING_SQLITE_STATE_KEY],
        ),
      );

      if (metaRows.length === 0 && stateRows.length === 0) {
        return { status: 'uninitialized' };
      }

      if (
        metaRows.length !== 1 ||
        metaRows[0]?.meta_value !== KEYRING_SQLITE_SCHEMA_VERSION
      ) {
        return {
          status: 'semantic-error',
          error: 'SQLite keyring store metadata is invalid.',
        };
      }

      if (stateRows.length === 0) {
        return { status: 'empty' };
      }

      if (
        stateRows.length !== 1 ||
        typeof stateRows[0]?.state_value !== 'string'
      ) {
        return {
          status: 'semantic-error',
          error: 'SQLite keyring state row is invalid.',
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stateRows[0].state_value);
      } catch {
        return {
          status: 'semantic-error',
          error: 'SQLite keyring state JSON cannot be parsed.',
        };
      }

      if (!isPersistedKeyringState(parsed)) {
        return {
          status: 'semantic-error',
          error: 'SQLite keyring state has an invalid shape.',
        };
      }

      return { status: 'valid', value: parsed };
    } catch (error) {
      return { status: 'semantic-error', error: getSqliteErrorMessage(error) };
    }
  }

  function writeState(value: PersistedKeyringState) {
    execute(
      database,
      `INSERT INTO keyring_state (state_key, state_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(state_key) DO UPDATE SET
         state_value = excluded.state_value,
         updated_at = excluded.updated_at`,
      [KEYRING_SQLITE_STATE_KEY, JSON.stringify(value), Date.now()],
    );
  }

  return {
    read,
    bootstrap(value) {
      const before = read();
      if (before.status !== 'uninitialized') {
        if (before.status === 'semantic-error') {
          throw new Error(before.error);
        }
        return;
      }

      try {
        execute(database, 'BEGIN IMMEDIATE');
        execute(
          database,
          'INSERT INTO keyring_store_meta (meta_key, meta_value) VALUES (?, ?)',
          [KEYRING_SQLITE_META_KEY, KEYRING_SQLITE_SCHEMA_VERSION],
        );
        if (value) {
          writeState(value);
        }
        execute(database, 'COMMIT');
      } catch (error) {
        try {
          execute(database, 'ROLLBACK');
        } catch {
          // The failed statement may already have closed the transaction.
        }
        throw error;
      }
    },
    write(value) {
      const current = read();
      if (current.status === 'semantic-error') {
        throw new Error(current.error);
      }
      if (current.status === 'uninitialized') {
        throw new Error('SQLite keyring store has not been initialized.');
      }

      try {
        execute(database, 'BEGIN IMMEDIATE');
        writeState(value);
        execute(database, 'COMMIT');
      } catch (error) {
        try {
          execute(database, 'ROLLBACK');
        } catch {
          // The failed statement may already have closed the transaction.
        }
        throw error;
      }
    },
  };
}

/**
 * This storage deliberately refuses to create a database unless the current
 * native binary has SQLCipher. `encryptionKey` is ignored by vanilla
 * op-sqlite, so allowing it here would silently downgrade keyring secrecy.
 */
export function getKeyringSqliteStore() {
  if (keyringSqliteStoreRef.current) {
    return keyringSqliteStoreRef.current;
  }

  try {
    if (!isSQLCipher()) {
      throw new Error('SQLCipher is unavailable in the current native build.');
    }

    const database = open({
      location: getKeyringSqliteLocation(),
      name: getRabbyKeyringDbName(),
      encryptionKey: KEYRING_SQLITE_ENCRYPTION_KEY,
    }) as unknown as KeyringSqliteDatabase;

    // A keyring write is a one-row durability boundary, not a cache refresh.
    // Keep a rollback journal and require the SQLite engine to flush it before
    // a successful transaction is accepted.
    execute(database, 'PRAGMA journal_mode=DELETE');
    execute(database, 'PRAGMA synchronous=FULL');

    keyringSqliteStoreRef.current = createKeyringSqliteStore(database);
  } catch (error) {
    keyringSqliteStoreRef.current = createUnavailableStore(error);
  }

  return keyringSqliteStoreRef.current;
}
