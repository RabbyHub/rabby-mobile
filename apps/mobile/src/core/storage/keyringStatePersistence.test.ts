import { ObservableStore } from '@metamask/obs-store';
import {
  KEYRING_MMKV_GUARD_KEY,
  KEYRING_MMKV_GUARD_VALUE,
  normalizePersistedKeyringState,
} from './keyringStateMigration';
import type { KeyringStateStorage } from './keyringStateMigration';
import { createKeyringStatePersistence } from './keyringStatePersistence';

// Unit contracts for the persistence coordinator, with the real serialization,
// readback verification and ObservableStore. The MMKV boundary is in memory;
// these tests do not prove native disk durability.
const KEY = 'keyringState';
const previousState = {
  booted: 'previous-booted-ciphertext',
  vault: 'previous-vault-ciphertext',
  hasEncryptedKeyringData: true,
};
const originalState = {
  booted: 'original-booted-ciphertext',
  vault: 'original-vault-ciphertext',
  hasEncryptedKeyringData: true,
};
const upgradedState = {
  booted: 'upgraded-booted-ciphertext',
  vault: 'upgraded-vault-ciphertext',
  hasEncryptedKeyringData: true,
};

class MemoryMMKV implements KeyringStateStorage {
  private values = new Map<string, string>();
  failNextStateWrite: 'throw' | 'corrupt' | 'ignore' | null = null;
  stateWriteCount = 0;
  sync = jest.fn();
  reload = jest.fn();

  constructor(state?: typeof originalState) {
    this.values.set(KEYRING_MMKV_GUARD_KEY, KEYRING_MMKV_GUARD_VALUE);
    if (state) {
      this.values.set(KEY, JSON.stringify(state));
    }
  }

  contains(key: string) {
    return this.values.has(key);
  }

  delete(key: string) {
    this.values.delete(key);
  }

  getString(key: string) {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string) {
    if (key === KEY) {
      this.stateWriteCount += 1;
      const failure = this.failNextStateWrite;
      this.failNextStateWrite = null;
      if (failure === 'throw') {
        throw new Error('expected MMKV write failure');
      }
      if (failure === 'ignore') {
        return;
      }
      if (failure === 'corrupt') {
        this.values.set(key, '{truncated');
        return;
      }
    }
    this.values.set(key, value);
  }
}

function makePersistence(initialBlocked = false) {
  const keyringStorage = new MemoryMMKV(originalState);
  const checkpointStorage = new MemoryMMKV(previousState);
  const onDiagnostic = jest.fn();
  const persistence = createKeyringStatePersistence({
    key: KEY,
    keyringStorage,
    checkpointStorage,
    initialBlocked,
    onDiagnostic,
  });

  return {
    ...persistence,
    keyringStorage,
    checkpointStorage,
    onDiagnostic,
  };
}

describe('keyring state persistence coordinator', () => {
  it('verifies the upgrade before publishing and keeps the original checkpoint', () => {
    const persistence = makePersistence();
    const store = new ObservableStore(originalState);
    const listener = persistence.onStoreUpdate;
    store.subscribe(listener);

    try {
      expect(persistence.persistVaultUpgrade(upgradedState)).toBe(true);
      expect(store.getState()).toBe(originalState);
      expect(persistence.keyringStorage.getString(KEY)).toBe(
        JSON.stringify(upgradedState),
      );
      expect(persistence.checkpointStorage.getString(KEY)).toBe(
        JSON.stringify(originalState),
      );
      expect(persistence.keyringStorage.sync).toHaveBeenCalledTimes(1);
      expect(persistence.keyringStorage.reload).toHaveBeenCalledTimes(1);

      store.putState(upgradedState);

      expect(store.getState()).toBe(upgradedState);
      expect(persistence.keyringStorage.stateWriteCount).toBe(1);
      expect(persistence.checkpointStorage.stateWriteCount).toBe(1);
      expect(persistence.checkpointStorage.getString(KEY)).toBe(
        JSON.stringify(originalState),
      );
      expect(
        persistence.onDiagnostic.mock.calls.map(([event]) => event),
      ).toEqual(['persist.request', 'persist.complete']);
    } finally {
      store.unsubscribe(listener);
    }
  });

  it('keeps ordinary subscriber writes and checkpoint advancement unchanged', () => {
    const persistence = makePersistence();
    const store = new ObservableStore(originalState);
    store.subscribe(persistence.onStoreUpdate);

    try {
      store.updateState({ vault: 'ordinary-vault-update' });
      expect(persistence.keyringStorage.getString(KEY)).toBe(
        JSON.stringify(store.getState()),
      );
      expect(persistence.checkpointStorage.getString(KEY)).toBe(
        JSON.stringify(originalState),
      );
      const previous = store.getState();

      store.updateState({ booted: 'ordinary-booted-update' });
      expect(persistence.keyringStorage.getString(KEY)).toBe(
        JSON.stringify(store.getState()),
      );
      expect(persistence.checkpointStorage.getString(KEY)).toBe(
        JSON.stringify(previous),
      );
      expect(persistence.keyringStorage.stateWriteCount).toBe(2);
      expect(persistence.onDiagnostic.mock.calls[2][1].sequence).toBe(2);
    } finally {
      store.unsubscribe(persistence.onStoreUpdate);
    }
  });

  it('suppresses only one publication of the exact pre-persisted object', () => {
    const persistence = makePersistence();
    persistence.persistVaultUpgrade(upgradedState);
    persistence.onStoreUpdate(upgradedState);
    expect(persistence.keyringStorage.stateWriteCount).toBe(1);

    persistence.onStoreUpdate(upgradedState);
    expect(persistence.keyringStorage.stateWriteCount).toBe(2);

    persistence.persistVaultUpgrade(upgradedState);
    persistence.onStoreUpdate({ ...upgradedState });
    expect(persistence.keyringStorage.stateWriteCount).toBe(4);
    persistence.onStoreUpdate(upgradedState);
    expect(persistence.keyringStorage.stateWriteCount).toBe(5);
  });

  it('rejects upgrades when recovery already blocked persistence', () => {
    const persistence = makePersistence(true);
    expect(() => persistence.onStoreUpdate(upgradedState)).not.toThrow();
    expect(() => persistence.persistVaultUpgrade(upgradedState)).toThrow(
      'Keyring persistence requires recovery or verification.',
    );
    expect(persistence.keyringStorage.stateWriteCount).toBe(0);
    expect(persistence.checkpointStorage.stateWriteCount).toBe(0);
  });

  it.each(['throw', 'corrupt', 'ignore'] as const)(
    'keeps a recoverable original state and blocks further writes after primary %s',
    failure => {
      const persistence = makePersistence();
      const store = new ObservableStore(originalState);
      store.subscribe(persistence.onStoreUpdate);
      persistence.keyringStorage.failNextStateWrite = failure;

      try {
        expect(() => {
          persistence.persistVaultUpgrade(upgradedState);
          store.putState(upgradedState);
        }).toThrow(
          failure === 'throw'
            ? 'expected MMKV write failure'
            : 'Keyring state persistence verification failed.',
        );
        expect(store.getState()).toBe(originalState);
        expect(persistence.checkpointStorage.getString(KEY)).toBe(
          JSON.stringify(originalState),
        );
        expect(
          normalizePersistedKeyringState({
            key: KEY,
            keyringStorage: persistence.keyringStorage,
            checkpointStorage: persistence.checkpointStorage,
            legacyStorage: new MemoryMMKV(),
          }).keyringData,
        ).toEqual(originalState);

        persistence.onStoreUpdate(upgradedState);
        expect(() => persistence.persistVaultUpgrade(upgradedState)).toThrow(
          'Keyring persistence requires recovery or verification.',
        );
        expect(persistence.keyringStorage.stateWriteCount).toBe(1);
        expect(persistence.checkpointStorage.stateWriteCount).toBe(1);
        expect(persistence.onDiagnostic.mock.calls[1][0]).toBe('persist.error');
      } finally {
        store.unsubscribe(persistence.onStoreUpdate);
      }
    },
  );

  it('leaves the primary untouched when the checkpoint write fails', () => {
    const persistence = makePersistence();
    persistence.checkpointStorage.failNextStateWrite = 'throw';

    expect(() => persistence.persistVaultUpgrade(upgradedState)).toThrow(
      'expected MMKV write failure',
    );
    expect(persistence.keyringStorage.getString(KEY)).toBe(
      JSON.stringify(originalState),
    );
    persistence.onStoreUpdate(upgradedState);
    expect(persistence.keyringStorage.stateWriteCount).toBe(0);
    expect(persistence.checkpointStorage.stateWriteCount).toBe(1);
  });

  it('reports state shape and counts without ciphertext or account values', () => {
    const persistence = makePersistence();
    const value = {
      ...upgradedState,
      unencryptedKeyringData: [{ secret: 'private-keyring-data' }],
      publicAccountSnapshot: { accounts: ['private-account-address'] },
      passwordState: { version: 1, origin: 'user' },
    };
    persistence.persistVaultUpgrade(value);

    expect(persistence.onDiagnostic.mock.calls[0][1].state).toEqual({
      valueType: 'record',
      hasBooted: true,
      hasVault: true,
      hasEncryptedKeyringData: true,
      hasPasswordState: true,
      unencryptedKeyringCount: 1,
      publicAccountCount: 1,
    });
    const diagnostics = JSON.stringify(persistence.onDiagnostic.mock.calls);
    for (const secret of [
      value.booted,
      value.vault,
      'private-keyring-data',
      'private-account-address',
    ]) {
      expect(diagnostics).not.toContain(secret);
    }
  });
});
