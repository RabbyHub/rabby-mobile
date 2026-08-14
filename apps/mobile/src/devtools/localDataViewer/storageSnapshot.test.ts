import {
  createLocalDataSnapshot,
  dumpMMKVStorage,
  readMMKVEntry,
  type ReadableMMKV,
} from './storageSnapshot';

function makeStorage(
  values: Record<string, string | number | boolean | Uint8Array>,
): ReadableMMKV {
  return {
    getAllKeys: () => Object.keys(values),
    getString: key =>
      typeof values[key] === 'string' ? (values[key] as string) : undefined,
    getNumber: key =>
      typeof values[key] === 'number' ? (values[key] as number) : undefined,
    getBoolean: key =>
      typeof values[key] === 'boolean' ? (values[key] as boolean) : undefined,
    getBuffer: key =>
      values[key] instanceof Uint8Array
        ? (values[key] as Uint8Array)
        : undefined,
  };
}

describe('local data storage snapshot', () => {
  it('reads every MMKV value type and decodes nested JSON strings', () => {
    const storage = makeStorage({
      json: JSON.stringify({ enabled: true }),
      nestedJson: JSON.stringify(JSON.stringify({ account: '0x1' })),
      plain: 'hello',
      empty: '',
      count: 3,
      enabled: false,
      bytes: new Uint8Array([1, 2, 255]),
    });

    expect(readMMKVEntry(storage, 'json')).toEqual({
      type: 'json',
      value: { enabled: true },
      jsonDepth: 1,
    });
    expect(readMMKVEntry(storage, 'nestedJson')).toEqual({
      type: 'json',
      value: { account: '0x1' },
      jsonDepth: 2,
    });
    expect(readMMKVEntry(storage, 'plain')).toEqual({
      type: 'string',
      value: 'hello',
    });
    expect(readMMKVEntry(storage, 'empty')).toEqual({
      type: 'string',
      value: '',
    });
    expect(readMMKVEntry(storage, 'count')).toEqual({
      type: 'number',
      value: 3,
    });
    expect(readMMKVEntry(storage, 'enabled')).toEqual({
      type: 'boolean',
      value: false,
    });
    expect(readMMKVEntry(storage, 'bytes')).toEqual({
      type: 'buffer',
      value: [1, 2, 255],
    });
  });

  it('sorts keys and keeps unreadable values in the export', () => {
    const storage = makeStorage({ z: 'last', a: 'first' });
    storage.getString = key => {
      if (key === 'z') {
        throw new Error('corrupt string');
      }
      return 'first';
    };

    expect(dumpMMKVStorage(storage)).toEqual({
      keyCount: 2,
      entries: {
        a: { type: 'string', value: 'first' },
        z: {
          type: 'unreadable',
          value: null,
          errors: ['string: corrupt string'],
        },
      },
    });
  });

  it('includes metadata and totals across all storages', () => {
    const snapshot = createLocalDataSnapshot(
      {
        generatedAt: '2026-08-14T00:00:00.000Z',
        app: {
          applicationId: 'com.debank.rabbymobile.regression',
          buildChannel: 'selfhost-reg',
          runtimeEnv: 'regression',
          version: '1.0.0',
          buildNumber: '1',
        },
      },
      {
        app: makeStorage({ preference: '{}' }),
        keyring: makeStorage({ keyringState: '{"vault":"encrypted"}' }),
      },
    );

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.totalKeyCount).toBe(2);
    expect(Object.keys(snapshot.storages)).toEqual(['app', 'keyring']);
    expect(snapshot.storages.keyring.entries.keyringState).toEqual({
      type: 'json',
      value: { vault: 'encrypted' },
      jsonDepth: 1,
    });
  });
});
