import type { StorageAdapater } from '@rabby-wallet/persist-store';
import { APP_STORE_NAMES } from '../storeConstant';
import {
  asRecord,
  getRPCServerCache,
  isValidPreference,
  projectLegacyPreference,
  projectPreference,
  securePreferenceNames,
  type PreferenceRecord,
  type SecurePreferenceName,
} from './schema';

const FORMAT_VERSION = 1;
const RPC_SERVER_CACHE_KEY = 'rpc:server-cache';
const recordKey = (name: SecurePreferenceName) => `secure-preference:${name}`;
const hmacPattern = /^[0-9a-f]{64}$/;

type Disk = {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
};

type Key = {
  open(create: boolean): Promise<'ready' | 'missing' | 'created'>;
  mac(message: string): string;
};

type KeyStatus = 'ready' | 'missing';
type IssueKind = 'damaged' | 'unavailable';
export type SecurePreferenceIssue = {
  name: SecurePreferenceName;
  kind: IssueKind;
};

type AdapterState = {
  snapshot?: PreferenceRecord;
  committedPayload?: string;
  pendingPayload?: string;
  issue?: IssueKind;
};

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

export function createSecurePreferenceStorage(disk: Disk, key: Key) {
  const states = new Map<SecurePreferenceName, AdapterState>();
  const adapters = new Map<SecurePreferenceName, Promise<StorageAdapater>>();
  const listeners = new Set<() => void>();
  let keyPromise: Promise<KeyStatus> | undefined;

  function setIssue(state: AdapterState, issue?: IssueKind) {
    if (state.issue !== issue) {
      state.issue = issue;
      listeners.forEach(listener => listener());
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
      typeof envelope.payload !== 'string' ||
      typeof envelope.hmac !== 'string' ||
      !hmacPattern.test(envelope.hmac) ||
      !matchesMac(mac(name, envelope.payload), envelope.hmac)
    ) {
      return undefined;
    }
    const snapshot = parseRecord(envelope.payload);
    if (snapshot && isValidPreference(name, snapshot)) {
      return { snapshot, payload: envelope.payload };
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
      keyPromise = (async (): Promise<KeyStatus> => {
        if ((await key.open(false)) === 'ready') {
          return 'ready';
        }
        if (
          securePreferenceNames.some(
            name => disk.read(recordKey(name)) !== null,
          )
        ) {
          return 'missing';
        }

        // Once the key is created, unsigned legacy values are never imported
        // again, even if the app stops before all signed records are committed.
        const legacy = securePreferenceNames.map(name => {
          const raw = disk.read(name);
          const value = raw === null ? {} : parseRecord(raw);
          return {
            name,
            value: value && isValidPreference(name, value) ? value : undefined,
          };
        });
        const enrollment = await key.open(true);
        if (enrollment === 'missing') {
          throw new Error('Secure preference key could not be created');
        }
        if (enrollment === 'created') {
          for (const { name, value } of legacy) {
            if (value) {
              writeProtected(
                name,
                JSON.stringify(projectLegacyPreference(name, value)),
              );
            }
          }
        }
        return 'ready';
      })().catch(error => {
        keyPromise = undefined;
        throw error;
      });
    }
    return keyPromise;
  }

  async function prepare(name: SecurePreferenceName) {
    const state: AdapterState = {};
    states.set(name, state);
    try {
      const result = await loadKey();
      const verified =
        result === 'ready'
          ? readProtected(name, disk.read(recordKey(name)))
          : undefined;
      if (verified) {
        state.snapshot = verified.snapshot;
        state.committedPayload = verified.payload;
        cleanLegacy(name);
      } else {
        setIssue(state, 'damaged');
      }
    } catch {
      setIssue(state, 'unavailable');
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
      setIssue(state, undefined);
    } catch {
      setIssue(state, 'unavailable');
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
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async reset(names: readonly SecurePreferenceName[]) {
      const damaged = names.filter(
        name => states.get(name)?.issue === 'damaged',
      );
      if (damaged.length === 0) {
        return;
      }
      try {
        if ((await key.open(true)) === 'missing') {
          throw new Error('Secure preference key unavailable');
        }
        keyPromise = Promise.resolve('ready');
        for (const name of damaged) {
          const state = states.get(name);
          if (state?.issue !== 'damaged') {
            continue;
          }
          // Pending values were produced by a service initialized with defaults.
          commit(name, state, state.pendingPayload ?? '{}');
          if (!state.issue) {
            cleanLegacy(name);
          }
        }
      } catch {
        for (const name of damaged) {
          const state = states.get(name);
          if (state?.issue === 'damaged') {
            setIssue(state, 'unavailable');
          }
        }
      }
    },
  };
}
