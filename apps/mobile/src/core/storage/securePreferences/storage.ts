import type { StorageAdapater } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storeConstant';
import {
  asRecord,
  getRPCServerCache,
  isValidPreference,
  projectLegacyPreference,
  projectPreference,
  type PreferenceRecord,
} from './schema';
import { securePreferenceNames } from './types';
import type {
  SecurePreferenceIssue,
  SecurePreferenceName,
  SecurePreferenceReport,
  SecurePreferenceStage,
} from './types';

const FORMAT_VERSION = 1;
const DEFAULT_PAYLOAD = '{}';
const INSTALLATION_STATE_KEY = 'secure-preference:installation';
const RPC_SERVER_CACHE_KEY = 'rpc:server-cache';
const recordKey = (name: SecurePreferenceName) => `secure-preference:${name}`;
const hmacPattern = /^[0-9a-f]{64}$/;

type Disk = {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
};

type Key = {
  open(stage: boolean): Promise<'ready' | 'missing' | 'staged'>;
  commit(): Promise<void>;
  mac(message: string): string;
};

type Options = {
  canInitializeEmptyInstallation?: () => boolean;
  onIssue?: (issue: SecurePreferenceReport) => void;
};

type AdapterState = {
  snapshot?: PreferenceRecord;
  committedPayload?: string;
  pendingPayload?: string;
  issue?: SecurePreferenceIssue['kind'];
};

class SecurePreferenceLoadError extends Error {
  constructor(readonly stage: SecurePreferenceStage) {
    super('Secure preference initialization failed');
  }
}

function parseRecord(raw: string) {
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function matchesMac(expected: string, actual: string) {
  if (expected.length !== actual.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    // eslint-disable-next-line no-bitwise
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

export function createSecurePreferenceStorage(
  disk: Disk,
  key: Key,
  { canInitializeEmptyInstallation, onIssue }: Options = {},
) {
  const states = new Map<SecurePreferenceName, AdapterState>();
  const adapters = new Map<SecurePreferenceName, Promise<StorageAdapater>>();
  let keyPromise: Promise<void> | undefined;
  let installationRecorded = false;

  function setIssue(
    name: SecurePreferenceName,
    state: AdapterState,
    kind: SecurePreferenceIssue['kind'],
    stage: SecurePreferenceStage,
  ) {
    if (state.issue !== kind) {
      state.issue = kind;
      onIssue?.({ name, kind, stage });
    }
  }

  function mac(name: SecurePreferenceName, payload: string) {
    const result = key.mac(
      JSON.stringify([
        'rabby.secure-preference',
        FORMAT_VERSION,
        name,
        payload,
      ]),
    );
    if (!hmacPattern.test(result)) {
      throw new Error('Secure preference HMAC unavailable');
    }
    return result;
  }

  function readProtected(name: SecurePreferenceName, raw: string | null) {
    const envelope = raw === null ? undefined : parseRecord(raw);
    if (
      envelope?.version !== FORMAT_VERSION ||
      typeof envelope.payload !== 'string'
    ) {
      return undefined;
    }
    const authenticated =
      typeof envelope.hmac === 'string' &&
      hmacPattern.test(envelope.hmac) &&
      matchesMac(mac(name, envelope.payload), envelope.hmac);
    const snapshot = parseRecord(envelope.payload);
    if (snapshot && isValidPreference(name, snapshot)) {
      return { snapshot, payload: envelope.payload, authenticated };
    }
    return undefined;
  }

  function writeProtected(name: SecurePreferenceName, payload: string) {
    disk.write(
      recordKey(name),
      JSON.stringify({
        version: FORMAT_VERSION,
        payload,
        hmac: mac(name, payload),
      }),
    );
  }

  function recordInstallation() {
    if (canInitializeEmptyInstallation && !installationRecorded) {
      disk.write(INSTALLATION_STATE_KEY, 'initialized');
      installationRecorded = true;
    }
  }

  function initializeEmptyInstallation() {
    if (!canInitializeEmptyInstallation) {
      return;
    }
    const installation = disk.read(INSTALLATION_STATE_KEY);
    installationRecorded = installation === 'initialized';
    if (
      (installation !== null && installation !== 'initializing') ||
      !canInitializeEmptyInstallation()
    ) {
      return;
    }

    const missing: SecurePreferenceName[] = [];
    for (const name of securePreferenceNames) {
      if (disk.read(name) !== null) {
        return;
      }
      const raw = disk.read(recordKey(name));
      if (raw === null) {
        missing.push(name);
        continue;
      }
      if (installation !== 'initializing') {
        return;
      }
      const record = readProtected(name, raw);
      if (!record?.authenticated || record.payload !== DEFAULT_PAYLOAD) {
        return;
      }
    }

    // Keychain can survive an iOS reinstall. An interrupted initialization
    // may already have written some authenticated defaults.
    if (installation === null) {
      disk.write(INSTALLATION_STATE_KEY, 'initializing');
    }
    for (const name of missing) {
      writeProtected(name, DEFAULT_PAYLOAD);
    }
    recordInstallation();
  }

  function cleanLegacy(name: SecurePreferenceName) {
    try {
      const raw = disk.read(name);
      if (raw === null) {
        return;
      }
      if (
        name === APP_STORE_NAMES.rpc &&
        disk.read(RPC_SERVER_CACHE_KEY) === null
      ) {
        const cache = getRPCServerCache(parseRecord(raw));
        disk.write(RPC_SERVER_CACHE_KEY, JSON.stringify(cache));
      }
      disk.remove(name);
    } catch {
      // A verified record already exists. Retry legacy cleanup next launch.
    }
  }

  function loadKey() {
    if (!keyPromise) {
      let stage: SecurePreferenceStage = 'key-open';
      keyPromise = (async () => {
        if ((await key.open(false)) === 'ready') {
          stage = 'initialize-records';
          initializeEmptyInstallation();
          return;
        }
        const enrollment = await key.open(true);
        if (enrollment === 'ready') {
          stage = 'initialize-records';
          initializeEmptyInstallation();
          return;
        }
        if (enrollment !== 'staged') {
          throw new Error('Secure preference key could not be staged');
        }

        // The durable key commits the migration. Until then, overwrite any
        // records from an interrupted attempt and keep the legacy values.
        stage = 'initialize-records';
        for (const name of securePreferenceNames) {
          const raw = disk.read(name);
          const value = raw === null ? {} : parseRecord(raw);
          if (value && isValidPreference(name, value)) {
            writeProtected(
              name,
              JSON.stringify(projectLegacyPreference(name, value)),
            );
          } else {
            disk.remove(recordKey(name));
          }
        }
        recordInstallation();
        stage = 'key-commit';
        await key.commit();
      })().catch(() => {
        keyPromise = undefined;
        throw new SecurePreferenceLoadError(stage);
      });
    }
    return keyPromise;
  }

  async function prepare(name: SecurePreferenceName) {
    const state: AdapterState = {};
    states.set(name, state);
    let stage: SecurePreferenceStage = 'key-open';
    try {
      await loadKey();
      stage = 'record-read';
      const raw = disk.read(recordKey(name));
      stage = raw === null ? 'record-missing' : 'record-verify';
      const record = readProtected(name, raw);
      if (record) {
        state.snapshot = record.snapshot;
        state.committedPayload = record.payload;
      }
      if (record?.authenticated) {
        try {
          recordInstallation();
        } catch {
          // Existing authenticated records still protect this installation.
        }
        cleanLegacy(name);
      } else if (record) {
        // Signature failures are reported without blocking usable settings.
        onIssue?.({ name, kind: 'damaged', stage });
      } else {
        setIssue(name, state, 'damaged', stage);
      }
    } catch (error) {
      setIssue(
        name,
        state,
        'unavailable',
        error instanceof SecurePreferenceLoadError ? error.stage : stage,
      );
    }

    // The default RPC cache is refreshed independently of user RPC settings.
    let rpcCache = name === APP_STORE_NAMES.rpc ? readCachedRPC() : {};
    let cachedRPCPayload = JSON.stringify(rpcCache);
    const adapter: StorageAdapater = {
      getItem: () => {
        state.snapshot ??= state.committedPayload
          ? parseRecord(state.committedPayload)
          : undefined;
        return { ...rpcCache, ...state.snapshot };
      },
      setItem: (_key, value) => {
        const record = asRecord(value);
        if (!record) {
          return;
        }

        if (name === APP_STORE_NAMES.rpc) {
          const nextCache = getRPCServerCache(record);
          const cache = JSON.stringify(nextCache);
          if (cache !== cachedRPCPayload) {
            try {
              disk.write(RPC_SERVER_CACHE_KEY, cache);
              cachedRPCPayload = cache;
              rpcCache = nextCache;
            } catch {
              // The remote cache can be fetched again. Keep signing user edits.
            }
          }
        }
        const payload = JSON.stringify(projectPreference[name](record));
        if (payload === state.committedPayload) {
          state.pendingPayload = undefined;
          return;
        }
        state.pendingPayload = payload;
        if (!state.issue) {
          commit(name, state, payload);
        }
      },
      removeItem() {},
      clearAll() {},
    };
    return adapter;
  }

  function readCachedRPC() {
    try {
      const raw =
        disk.read(RPC_SERVER_CACHE_KEY) ?? disk.read(APP_STORE_NAMES.rpc);
      return getRPCServerCache(raw === null ? undefined : parseRecord(raw));
    } catch {
      return {};
    }
  }

  function commit(
    name: SecurePreferenceName,
    state: AdapterState,
    payload: string,
  ) {
    try {
      writeProtected(name, payload);
      state.committedPayload = payload;
      state.snapshot = undefined;
      state.pendingPayload = undefined;
      state.issue = undefined;
    } catch {
      setIssue(name, state, 'unavailable', 'record-write');
    }
  }

  return {
    getAdapter(name: SecurePreferenceName) {
      const existing = adapters.get(name);
      if (existing) {
        return existing;
      }
      const adapter = prepare(name).catch(error => {
        adapters.delete(name);
        throw error;
      });
      adapters.set(name, adapter);
      return adapter;
    },
    getIssues(): SecurePreferenceIssue[] {
      return Array.from(states).flatMap(([name, state]) =>
        state.issue ? [{ name, kind: state.issue }] : [],
      );
    },
    async reset(names: readonly SecurePreferenceName[]) {
      for (const name of names) {
        const state = states.get(name);
        if (state?.issue !== 'damaged') {
          continue;
        }
        // Pending values were produced by a service initialized with defaults.
        commit(name, state, state.pendingPayload ?? DEFAULT_PAYLOAD);
        if (!state.issue) {
          cleanLegacy(name);
        }
      }
    },
  };
}
