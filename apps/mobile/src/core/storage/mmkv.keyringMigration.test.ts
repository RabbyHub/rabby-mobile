import {
  inspectPersistedKeyringState,
  KEYRING_MMKV_GUARD_KEY,
  KEYRING_MMKV_GUARD_VALUE,
  normalizePersistedKeyringState,
  persistKeyringState,
  type KeyringStateStorage,
} from './keyringStateMigration';

const KEY = 'keyringState';

const VALID_DESTINATION_STATE = {
  booted: 'destination-booted',
  vault: 'destination-vault',
  hasEncryptedKeyringData: true,
};

const VALID_LEGACY_STATE = {
  booted: 'legacy-booted',
  vault: 'legacy-vault',
  hasEncryptedKeyringData: true,
};

const BIG_NUMBER_LIKE_VALUE = {
  c: [1, 2, 3],
  e: 2,
  s: 1,
};

class MemoryMMKV implements KeyringStateStorage {
  protected values = new Map<string, string | number>();

  trim = jest.fn();
  sync = jest.fn();
  reload = jest.fn();

  contains(key: string) {
    return this.values.has(key);
  }

  delete(key: string) {
    this.values.delete(key);
  }

  getNumber(key: string) {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : null;
  }

  getString(key: string) {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : null;
  }

  set(key: string, value: string | number) {
    this.values.set(key, value);
  }
}

class FailingMemoryMMKV extends MemoryMMKV {
  failNextSet = false;

  set(key: string, value: string | number) {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('expected test write failure');
    }
    super.set(key, value);
  }
}

class CorruptingMemoryMMKV extends MemoryMMKV {
  corruptNextSet = false;

  set(key: string, value: string | number) {
    super.set(key, value);
    if (this.corruptNextSet && key === KEY) {
      this.corruptNextSet = false;
      this.values.set(key, '{truncated');
    }
  }
}

function loadFixture() {
  const defaultMMKV = new MemoryMMKV();
  const keyringMMKV = new MemoryMMKV();
  const checkpointMMKV = new MemoryMMKV();
  const normalizeKeyringState = () =>
    normalizePersistedKeyringState({
      key: KEY,
      keyringStorage: keyringMMKV,
      checkpointStorage: checkpointMMKV,
      legacyStorage: defaultMMKV,
    });

  return {
    defaultMMKV,
    keyringMMKV,
    checkpointMMKV,
    normalizeKeyringState,
  };
}

describe('keyring state legacy migration', () => {
  it('migrates a valid legacy keyring state only when the encrypted store is absent', () => {
    const { defaultMMKV, keyringMMKV, checkpointMMKV, normalizeKeyringState } =
      loadFixture();
    defaultMMKV.set(KEY, JSON.stringify(VALID_LEGACY_STATE));

    expect(normalizeKeyringState()).toEqual({
      legacyData: VALID_LEGACY_STATE,
      keyringData: VALID_LEGACY_STATE,
      recoverySource: 'legacy-default-mmkv',
    });
    expect(keyringMMKV.getString(KEY)).toBe(JSON.stringify(VALID_LEGACY_STATE));
    expect(checkpointMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_LEGACY_STATE),
    );
    expect(defaultMMKV.contains(KEY)).toBe(false);
  });

  it('reports every legacy-to-keyring write phase through the migration observer', () => {
    const { defaultMMKV, keyringMMKV } = loadFixture();
    const events: string[] = [];
    defaultMMKV.set(KEY, JSON.stringify(VALID_LEGACY_STATE));

    normalizePersistedKeyringState({
      key: KEY,
      keyringStorage: keyringMMKV,
      checkpointStorage: new MemoryMMKV(),
      legacyStorage: defaultMMKV,
      onKeyringStateWrite: event => events.push(event.phase),
    });

    expect(events).toEqual(['request', 'complete']);
  });

  it('keeps a valid encrypted keyring state when legacy data is malformed', () => {
    const { defaultMMKV, keyringMMKV, normalizeKeyringState } = loadFixture();
    defaultMMKV.set(KEY, JSON.stringify({ accidental: 1 }));
    keyringMMKV.set(KEY, JSON.stringify(VALID_DESTINATION_STATE));

    expect(normalizeKeyringState()).toEqual({
      legacyData: null,
      keyringData: VALID_DESTINATION_STATE,
      recoverySource: 'keyring-primary',
    });
    expect(keyringMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_DESTINATION_STATE),
    );
    expect(defaultMMKV.getString(KEY)).toBe(JSON.stringify({ accidental: 1 }));
  });

  it('does not migrate a scalar legacy value into the encrypted keyring store', () => {
    const { defaultMMKV, keyringMMKV, normalizeKeyringState } = loadFixture();
    defaultMMKV.set(KEY, JSON.stringify(7));

    expect(normalizeKeyringState()).toEqual({
      legacyData: null,
      keyringData: null,
      recoverySource: null,
      persistenceBlocked: true,
    });
    expect(keyringMMKV.contains(KEY)).toBe(false);
    expect(defaultMMKV.getString(KEY)).toBe(JSON.stringify(7));
  });

  it('does not migrate a BigNumber-like legacy object into the encrypted keyring store', () => {
    const { defaultMMKV, keyringMMKV, normalizeKeyringState } = loadFixture();
    defaultMMKV.set(KEY, JSON.stringify(BIG_NUMBER_LIKE_VALUE));

    expect(normalizeKeyringState()).toEqual({
      legacyData: null,
      keyringData: null,
      recoverySource: null,
      persistenceBlocked: true,
    });
    expect(keyringMMKV.contains(KEY)).toBe(false);
    expect(defaultMMKV.getString(KEY)).toBe(
      JSON.stringify(BIG_NUMBER_LIKE_VALUE),
    );
  });

  it('keeps a valid encrypted keyring state authoritative over a valid legacy duplicate', () => {
    const { defaultMMKV, keyringMMKV, normalizeKeyringState } = loadFixture();
    defaultMMKV.set(KEY, JSON.stringify(VALID_LEGACY_STATE));
    keyringMMKV.set(KEY, JSON.stringify(VALID_DESTINATION_STATE));

    expect(normalizeKeyringState()).toEqual({
      legacyData: VALID_LEGACY_STATE,
      keyringData: VALID_DESTINATION_STATE,
      recoverySource: 'keyring-primary',
    });
    expect(keyringMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_DESTINATION_STATE),
    );
    expect(defaultMMKV.contains(KEY)).toBe(false);
  });

  it('does not treat a native numeric keyring value as a valid keyring state', () => {
    const { keyringMMKV, normalizeKeyringState } = loadFixture();
    keyringMMKV.set(KEY, 7);

    expect(normalizeKeyringState()).toEqual({
      legacyData: null,
      keyringData: null,
      recoverySource: null,
      persistenceBlocked: true,
    });
    expect(keyringMMKV.getNumber(KEY)).toBe(7);
  });

  it('reports a native numeric keyring value without logging the value itself', () => {
    const { keyringMMKV } = loadFixture();
    keyringMMKV.set(KEY, 7);

    expect(inspectPersistedKeyringState(keyringMMKV, KEY)).toMatchObject({
      status: 'invalid',
      contains: true,
      string: { status: 'missing' },
      nativeFallback: {
        number: { status: 'value' },
      },
    });
  });

  it("uses an invalid primary keyring state's encrypted checkpoint without rewriting it", () => {
    const { keyringMMKV, checkpointMMKV, normalizeKeyringState } =
      loadFixture();
    keyringMMKV.set(KEY, '{invalid-json');
    checkpointMMKV.set(KEY, JSON.stringify(VALID_DESTINATION_STATE));

    expect(normalizeKeyringState()).toEqual({
      legacyData: null,
      keyringData: VALID_DESTINATION_STATE,
      recoverySource: 'keyring-checkpoint',
      persistenceBlocked: true,
    });
    expect(keyringMMKV.getString(KEY)).toBe('{invalid-json');
  });

  it('writes a verified rollback copy before advancing the primary keyring state', () => {
    const keyringMMKV = new MemoryMMKV();
    const checkpointMMKV = new MemoryMMKV();
    keyringMMKV.set(KEY, JSON.stringify(VALID_DESTINATION_STATE));

    persistKeyringState({
      key: KEY,
      keyringStorage: keyringMMKV,
      checkpointStorage: checkpointMMKV,
      value: VALID_LEGACY_STATE,
    });

    expect(checkpointMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_DESTINATION_STATE),
    );
    expect(keyringMMKV.getString(KEY)).toBe(JSON.stringify(VALID_LEGACY_STATE));
    expect(checkpointMMKV.sync).toHaveBeenCalledTimes(2);
    expect(keyringMMKV.sync).toHaveBeenCalledTimes(2);
  });

  it('keeps a permanent non-sensitive guard key in both encrypted keyring files', () => {
    const keyringMMKV = new MemoryMMKV();
    const checkpointMMKV = new MemoryMMKV();

    persistKeyringState({
      key: KEY,
      keyringStorage: keyringMMKV,
      checkpointStorage: checkpointMMKV,
      value: VALID_DESTINATION_STATE,
    });

    expect(keyringMMKV.getString(KEYRING_MMKV_GUARD_KEY)).toBe(
      KEYRING_MMKV_GUARD_VALUE,
    );
    expect(checkpointMMKV.getString(KEYRING_MMKV_GUARD_KEY)).toBe(
      KEYRING_MMKV_GUARD_VALUE,
    );
  });

  it('does not mutate the primary keyring state when the rollback checkpoint cannot be written', () => {
    const keyringMMKV = new MemoryMMKV();
    const checkpointMMKV = new FailingMemoryMMKV();
    keyringMMKV.set(KEY, JSON.stringify(VALID_DESTINATION_STATE));
    checkpointMMKV.failNextSet = true;

    expect(() =>
      persistKeyringState({
        key: KEY,
        keyringStorage: keyringMMKV,
        checkpointStorage: checkpointMMKV,
        value: VALID_LEGACY_STATE,
      }),
    ).toThrow('expected test write failure');
    expect(keyringMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_DESTINATION_STATE),
    );
  });

  it('keeps the last verified primary state in the checkpoint when a primary write becomes unreadable', () => {
    const keyringMMKV = new CorruptingMemoryMMKV();
    const checkpointMMKV = new MemoryMMKV();
    keyringMMKV.set(KEY, JSON.stringify(VALID_DESTINATION_STATE));
    keyringMMKV.corruptNextSet = true;

    expect(() =>
      persistKeyringState({
        key: KEY,
        keyringStorage: keyringMMKV,
        checkpointStorage: checkpointMMKV,
        value: VALID_LEGACY_STATE,
      }),
    ).toThrow('Keyring state persistence verification failed.');
    expect(keyringMMKV.getString(KEY)).toBe('{truncated');
    expect(checkpointMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_DESTINATION_STATE),
    );

    expect(() =>
      persistKeyringState({
        key: KEY,
        keyringStorage: keyringMMKV,
        checkpointStorage: checkpointMMKV,
        value: VALID_DESTINATION_STATE,
      }),
    ).toThrow('Refusing to overwrite an invalid keyring primary file.');
    expect(checkpointMMKV.getString(KEY)).toBe(
      JSON.stringify(VALID_DESTINATION_STATE),
    );
  });
});
