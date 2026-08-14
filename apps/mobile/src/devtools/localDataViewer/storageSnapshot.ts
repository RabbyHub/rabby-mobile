export type ReadableMMKV = {
  getAllKeys(): string[];
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  getBuffer(key: string): Uint8Array | undefined;
};

export type LocalDataEntry =
  | {
      type: 'json';
      value: unknown;
      jsonDepth: number;
    }
  | {
      type: 'string';
      value: string;
    }
  | {
      type: 'number';
      value: number;
    }
  | {
      type: 'boolean';
      value: boolean;
    }
  | {
      type: 'buffer';
      value: number[];
    }
  | {
      type: 'unreadable';
      value: null;
      errors?: string[];
    };

export type LocalDataStorageDump = {
  keyCount: number;
  entries: Record<string, LocalDataEntry>;
  error?: string;
};

export type LocalDataSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  app: {
    applicationId: string;
    buildChannel: string;
    runtimeEnv: string;
    version: string;
    buildNumber: string;
  };
  totalKeyCount: number;
  storages: Record<string, LocalDataStorageDump>;
};

type SnapshotMetadata = Omit<
  LocalDataSnapshot,
  'schemaVersion' | 'storages' | 'totalKeyCount'
>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function decodeJsonString(rawValue: string): LocalDataEntry {
  let value: unknown = rawValue;
  let jsonDepth = 0;

  while (typeof value === 'string' && jsonDepth < 3) {
    try {
      value = JSON.parse(value);
      jsonDepth += 1;
    } catch {
      break;
    }
  }

  if (jsonDepth > 0) {
    return {
      type: 'json',
      value,
      jsonDepth,
    };
  }

  return {
    type: 'string',
    value: rawValue,
  };
}

export function readMMKVEntry(
  storage: ReadableMMKV,
  key: string,
): LocalDataEntry {
  const errors: string[] = [];

  try {
    const value = storage.getString(key);
    if (value !== undefined) {
      return decodeJsonString(value);
    }
  } catch (error) {
    errors.push(`string: ${getErrorMessage(error)}`);
  }

  try {
    const value = storage.getNumber(key);
    if (value !== undefined) {
      return { type: 'number', value };
    }
  } catch (error) {
    errors.push(`number: ${getErrorMessage(error)}`);
  }

  try {
    const value = storage.getBoolean(key);
    if (value !== undefined) {
      return { type: 'boolean', value };
    }
  } catch (error) {
    errors.push(`boolean: ${getErrorMessage(error)}`);
  }

  try {
    const value = storage.getBuffer(key);
    if (value !== undefined) {
      return { type: 'buffer', value: Array.from(value) };
    }
  } catch (error) {
    errors.push(`buffer: ${getErrorMessage(error)}`);
  }

  return {
    type: 'unreadable',
    value: null,
    ...(errors.length ? { errors } : {}),
  };
}

export function dumpMMKVStorage(storage: ReadableMMKV): LocalDataStorageDump {
  let keys: string[];

  try {
    keys = storage.getAllKeys().slice().sort();
  } catch (error) {
    return {
      keyCount: 0,
      entries: {},
      error: getErrorMessage(error),
    };
  }

  return {
    keyCount: keys.length,
    entries: Object.fromEntries(
      keys.map(key => [key, readMMKVEntry(storage, key)]),
    ),
  };
}

export function createLocalDataSnapshot(
  metadata: SnapshotMetadata,
  storages: Record<string, ReadableMMKV>,
): LocalDataSnapshot {
  const storageDumps = Object.fromEntries(
    Object.entries(storages).map(([storageId, storage]) => [
      storageId,
      dumpMMKVStorage(storage),
    ]),
  );

  return {
    schemaVersion: 1,
    ...metadata,
    totalKeyCount: Object.values(storageDumps).reduce(
      (total, storage) => total + storage.keyCount,
      0,
    ),
    storages: storageDumps,
  };
}
