import {
  normalizeKeyringStateFromSqlite,
  persistKeyringStateToSqlite,
  type KeyringSqliteReadResult,
  type KeyringSqliteStore,
} from './keyringStateSqlite';
import type { LegacyKeyringStateResolution } from './keyringStateMigration';

const VALID_STATE = {
  booted: 'encrypted-boot-marker',
  vault: 'encrypted-vault',
  unencryptedKeyringData: [],
  publicAccountSnapshot: { version: 4, accounts: [] },
  hasEncryptedKeyringData: true,
};

class MemoryKeyringSqliteStore implements KeyringSqliteStore {
  constructor(private result: KeyringSqliteReadResult) {}

  bootstrapCalls: Array<typeof VALID_STATE | null> = [];
  writeCalls: Array<typeof VALID_STATE> = [];

  read() {
    return this.result;
  }

  bootstrap(value: typeof VALID_STATE | null) {
    this.bootstrapCalls.push(value);
    this.result = value
      ? { status: 'valid', value }
      : { status: 'empty' as const };
  }

  write(value: typeof VALID_STATE) {
    this.writeCalls.push(value);
    this.result = { status: 'valid', value };
  }
}

function legacy(
  input: Partial<LegacyKeyringStateResolution> = {},
): LegacyKeyringStateResolution {
  return {
    legacyData: VALID_STATE,
    keyringData: VALID_STATE,
    recoverySource: 'keyring-primary',
    ...input,
  };
}

describe('keyring SQLite migration policy', () => {
  it('copies a valid MMKV state exactly once during the initial SQLite bootstrap', () => {
    const store = new MemoryKeyringSqliteStore({ status: 'uninitialized' });
    const resolveLegacyState = jest.fn(() => legacy());

    const first = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState,
    });
    const second = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState,
    });

    expect(first).toMatchObject({
      keyringData: VALID_STATE,
      source: 'mmkv-bootstrap',
    });
    expect(store.bootstrapCalls).toEqual([VALID_STATE]);
    expect(second).toEqual({ keyringData: VALID_STATE, source: 'sqlite' });
    expect(resolveLegacyState).toHaveBeenCalledTimes(1);
  });

  it('does not read MMKV after SQLite has committed an intentional empty state', () => {
    const store = new MemoryKeyringSqliteStore({ status: 'empty' });
    const resolveLegacyState = jest.fn(() => legacy());

    const result = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState,
    });

    expect(result).toEqual({ keyringData: null, source: 'sqlite-empty' });
    expect(resolveLegacyState).not.toHaveBeenCalled();
  });

  it('uses MMKV only when SQLite has a semantic failure and then blocks writes', () => {
    const store = new MemoryKeyringSqliteStore({
      status: 'semantic-error',
      error: 'SQLite keyring state JSON cannot be parsed.',
    });
    const resolveLegacyState = jest.fn(() => legacy());

    const result = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState,
    });

    expect(result).toEqual({
      keyringData: VALID_STATE,
      source: 'mmkv-fallback',
      persistenceBlocked: true,
      sqliteError: 'SQLite keyring state JSON cannot be parsed.',
    });
    expect(resolveLegacyState).toHaveBeenCalledTimes(1);
  });

  it('keeps the established MMKV writer for an old native binary without SQLCipher', () => {
    const store = new MemoryKeyringSqliteStore({
      status: 'unavailable',
      error: 'SQLCipher is unavailable in the current native build.',
    });
    const resolveLegacyState = jest.fn(() => legacy());

    const result = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState,
    });

    expect(result).toEqual({
      keyringData: VALID_STATE,
      source: 'mmkv-unavailable',
      sqliteError: 'SQLCipher is unavailable in the current native build.',
    });
  });

  it('leaves an invalid legacy store retryable instead of committing a blank SQLite marker', () => {
    const store = new MemoryKeyringSqliteStore({ status: 'uninitialized' });

    const result = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState: () =>
        legacy({
          legacyData: null,
          keyringData: null,
          recoverySource: null,
          persistenceBlocked: true,
        }),
    });

    expect(result).toEqual({
      keyringData: null,
      source: 'sqlite-legacy-invalid',
      persistenceBlocked: true,
    });
    expect(store.bootstrapCalls).toEqual([]);
  });

  it('blocks writes when a bootstrap transaction cannot be read back', () => {
    const store: KeyringSqliteStore = {
      read: jest
        .fn<KeyringSqliteReadResult, []>()
        .mockReturnValueOnce({ status: 'uninitialized' })
        .mockReturnValueOnce({ status: 'uninitialized' }),
      bootstrap: jest.fn(),
      write: jest.fn(),
    };

    const result = normalizeKeyringStateFromSqlite({
      sqliteStore: store,
      resolveLegacyState: () => legacy(),
    });

    expect(result).toEqual({
      keyringData: VALID_STATE,
      source: 'sqlite-bootstrap-error',
      persistenceBlocked: true,
      sqliteError: 'Keyring SQLite bootstrap verification failed.',
    });
  });

  it('verifies the value read back from SQLite after every write', () => {
    const store = new MemoryKeyringSqliteStore({ status: 'empty' });

    persistKeyringStateToSqlite({ sqliteStore: store, value: VALID_STATE });

    expect(store.writeCalls).toEqual([VALID_STATE]);
    expect(store.read()).toEqual({ status: 'valid', value: VALID_STATE });
  });
});
