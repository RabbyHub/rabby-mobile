import { APP_STORE_NAMES } from '../storage/storeConstant';

export const CONFIG_INTEGRITY_KEY = '__configIntegrity';
export const FORMAT_VERSION = 1;
export const ALGORITHM = 'HMAC-SHA256';

export const registry = {
  version: 1,
  stores: {
    [APP_STORE_NAMES.rpc]: { customRPC: 1 },
    [APP_STORE_NAMES.contactBook]: { contacts: 1, aliases: 1 },
    [APP_STORE_NAMES.whitelist]: { enabled: 1, whitelists: 1 },
    [APP_STORE_NAMES.securityEngine]: { userData: 1, rules: 1 },
  },
} as const;

export type ProtectedStore = keyof typeof registry.stores;
export type Registry = {
  version: number;
  stores: Partial<Record<ProtectedStore, Record<string, number>>>;
};

export const diagnosticReasons = [
  'key_read_failed',
  'key_missing',
  'key_init_failed',
  'config_unreadable',
  'metadata_missing',
  'metadata_invalid',
  'hmac_mismatch',
  'hmac_compute_failed',
  'metadata_write_failed',
] as const;

export type DiagnosticReason = (typeof diagnosticReasons)[number];
export type DiagnosticLocation = { store?: ProtectedStore; field?: string };
export type Diagnostic = DiagnosticLocation & { reason: DiagnosticReason };

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function isHexDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

// Values come from JSON.parse. Build the string directly so integer-like
// property names also follow the same deterministic key order.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Non-finite configuration number');
  }
  return JSON.stringify(value);
}

export function fieldInput(
  store: ProtectedStore,
  field: string,
  record: JsonObject,
): string {
  const present = hasOwn(record, field);
  const prefix = JSON.stringify([FORMAT_VERSION, store, field, present]);
  return present
    ? `${prefix.slice(0, -1)},${canonicalJson(record[field])}]`
    : prefix;
}

export type KeyRecord = { key: string; baselineRegistryVersion: number };

export function parseKeyRecord(raw: string): KeyRecord {
  const record: unknown = JSON.parse(raw);
  if (
    !isObject(record) ||
    !isHexDigest(record.key) ||
    typeof record.baselineRegistryVersion !== 'number' ||
    !Number.isSafeInteger(record.baselineRegistryVersion) ||
    record.baselineRegistryVersion < 0
  ) {
    throw new Error('Invalid configuration integrity key record');
  }
  return {
    key: record.key,
    baselineRegistryVersion: record.baselineRegistryVersion,
  };
}
