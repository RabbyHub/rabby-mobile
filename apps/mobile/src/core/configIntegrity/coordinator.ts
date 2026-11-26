import type { StorageAdapater } from '@rabby-wallet/persist-store';
import {
  ALGORITHM,
  CONFIG_INTEGRITY_KEY,
  FORMAT_VERSION,
  fieldInput,
  hasOwn,
  isHexDigest,
  isObject,
  parseKeyRecord,
  type Diagnostic,
  type DiagnosticLocation,
  type DiagnosticReason,
  type JsonObject,
  type KeyRecord,
  type ProtectedStore,
  type Registry,
} from './schema';

export type ConfigIntegrityRuntime = {
  keychain: {
    read: () => Promise<string | null>;
    create: (value: string) => Promise<void>;
    update: (value: string) => Promise<void>;
  };
  generateKey: () => string;
  sign: (key: string, input: string) => string;
  matches: (first: string, second: string) => boolean;
  report: (diagnostic: Diagnostic) => void;
};

type Disk = {
  has: (key: string) => boolean;
  read: (key: string) => string | undefined;
  writeMetadata: (value: Metadata) => void;
};

type Metadata = JsonObject & {
  version: typeof FORMAT_VERSION;
  algorithm: typeof ALGORITHM;
  stores: JsonObject;
};

type DiskObject =
  | { kind: 'missing' | 'invalid' }
  | { kind: 'present'; raw: string; value: JsonObject };

function readObject(disk: Disk, key: string): DiskObject {
  try {
    const raw = disk.read(key);
    if (raw === undefined) {
      return { kind: disk.has(key) ? 'invalid' : 'missing' };
    }
    const value: unknown = JSON.parse(raw);
    if (isObject(value)) {
      return { kind: 'present', raw, value };
    }
  } catch {
    // A failed read cannot be treated as a missing record.
  }
  return { kind: 'invalid' };
}

function isMetadata(value: JsonObject): value is Metadata {
  return (
    value.version === FORMAT_VERSION &&
    value.algorithm === ALGORITHM &&
    isObject(value.stores)
  );
}

function getStoreMetadata(metadata: Metadata, store: ProtectedStore) {
  return hasOwn(metadata.stores, store) ? metadata.stores[store] : undefined;
}

export function createConfigIntegrity(
  registry: Registry,
  disk: Disk,
  businessStorage: StorageAdapater,
) {
  const stores = Object.entries(registry.stores) as [
    ProtectedStore,
    Record<string, number>,
  ][];
  const reported = new Set<string>();
  let freshLocalState: boolean | undefined;
  let runtime: ConfigIntegrityRuntime | undefined;
  let keyRecord: KeyRecord | undefined;
  let scan: Promise<void> | undefined;
  let scanComplete = false;

  function report(reason: DiagnosticReason, location: DiagnosticLocation = {}) {
    const fingerprint = JSON.stringify([
      reason,
      location.store,
      location.field,
    ]);
    if (reported.has(fingerprint)) {
      return;
    }
    reported.add(fingerprint);
    try {
      runtime?.report({ reason, ...location });
    } catch {
      // Telemetry is independent of observation and business storage.
    }
  }

  function rememberLocalState() {
    if (freshLocalState !== undefined) {
      return;
    }
    try {
      freshLocalState =
        !disk.has(CONFIG_INTEGRITY_KEY) &&
        stores.every(([store]) => !disk.has(store));
    } catch {
      freshLocalState = false;
    }
  }

  async function loadKey(active: ConfigIntegrityRuntime) {
    try {
      const value = await active.keychain.read();
      if (value !== null) {
        return parseKeyRecord(value);
      }
      if (disk.has(CONFIG_INTEGRITY_KEY)) {
        report('key_missing');
        return;
      }
    } catch {
      report('key_read_failed');
      return;
    }

    try {
      const key = active.generateKey();
      const record = parseKeyRecord(
        JSON.stringify({ key, baselineRegistryVersion: 0 }),
      );
      await active.keychain.create(JSON.stringify(record));
      return record;
    } catch {
      report('key_init_failed');
    }
  }

  function writeMetadata(metadata: Metadata, locations: DiagnosticLocation[]) {
    try {
      disk.writeMetadata(metadata);
      return true;
    } catch {
      const [first] = locations;
      const location: DiagnosticLocation | undefined =
        locations.length === 1
          ? first
          : first && locations.every(item => item.store === first.store)
          ? { store: first.store }
          : undefined;
      report('metadata_write_failed', location);
      return false;
    }
  }

  // A scan's read/merge/write and each post-save signature update run
  // synchronously on the same JS runtime. The Keychain awaits sit outside them.
  function scanDisk(active: ConfigIntegrityRuntime, key: KeyRecord) {
    const saved = readObject(disk, CONFIG_INTEGRITY_KEY);
    const reset = saved.kind === 'missing' && freshLocalState === true;
    let metadata: Metadata | undefined;
    if (saved.kind === 'missing') {
      metadata = { version: FORMAT_VERSION, algorithm: ALGORITHM, stores: {} };
    } else if (saved.kind === 'present' && isMetadata(saved.value)) {
      metadata = saved.value;
    } else {
      report('metadata_invalid');
    }

    let baselineComplete = metadata !== undefined;
    const changes: DiagnosticLocation[] = [];
    for (const [store, fields] of stores) {
      const config = readObject(disk, store);
      if (config.kind !== 'present') {
        if (config.kind === 'invalid') {
          report('config_unreadable', { store });
          if (
            Object.values(fields).some(
              version => version > key.baselineRegistryVersion,
            )
          ) {
            baselineComplete = false;
          }
        }
        continue;
      }
      if (!metadata) {
        continue;
      }

      const savedFields = getStoreMetadata(metadata, store);
      if (savedFields !== undefined && !isObject(savedFields)) {
        report('metadata_invalid', { store });
        if (
          Object.values(fields).some(
            version => version > key.baselineRegistryVersion,
          )
        ) {
          baselineComplete = false;
        }
        continue;
      }

      if (
        savedFields === undefined &&
        !reset &&
        Object.values(fields).some(
          version => version <= key.baselineRegistryVersion,
        )
      ) {
        report(
          'metadata_missing',
          saved.kind === 'missing' ? undefined : { store },
        );
      }

      for (const [field, introducedIn] of Object.entries(fields)) {
        const location: DiagnosticLocation = { store, field };
        const added = introducedIn > key.baselineRegistryVersion;
        const hasDigest =
          savedFields !== undefined && hasOwn(savedFields, field);
        const digest = savedFields?.[field];
        if (
          (hasDigest && !isHexDigest(digest)) ||
          (!hasDigest && savedFields && !added)
        ) {
          report('metadata_invalid', location);
          baselineComplete &&= !added;
          continue;
        }
        try {
          const expected = sign(
            active,
            key,
            fieldInput(store, field, config.value),
          );
          if (isHexDigest(digest)) {
            if (active.matches(digest, expected)) {
              continue;
            }
            report('hmac_mismatch', location);
          }

          const updated = getStoreMetadata(metadata, store);
          const target = isObject(updated) ? updated : {};
          target[field] = expected;
          metadata.stores[store] = target;
          changes.push(location);
        } catch {
          report('hmac_compute_failed', location);
          baselineComplete &&= !added;
        }
      }
    }

    if (metadata && (changes.length || saved.kind === 'missing')) {
      if (!writeMetadata(metadata, changes)) {
        return false;
      }
    }
    return baselineComplete;
  }

  function sign(active: ConfigIntegrityRuntime, key: KeyRecord, input: string) {
    const digest = active.sign(key.key, input);
    if (!isHexDigest(digest)) {
      throw new Error('Invalid configuration integrity digest');
    }
    return digest;
  }

  async function observe(active: ConfigIntegrityRuntime) {
    try {
      const loaded = await loadKey(active);
      if (!loaded || loaded.baselineRegistryVersion > registry.version) {
        return;
      }
      keyRecord = loaded;
      // Let already queued business writes settle. They can use the key while
      // existing missing or mismatched signatures remain for the scan.
      await Promise.resolve();
      const baselineComplete = scanDisk(active, loaded);
      scanComplete = true;
      if (
        baselineComplete &&
        loaded.baselineRegistryVersion < registry.version
      ) {
        const updated = {
          ...loaded,
          baselineRegistryVersion: registry.version,
        };
        try {
          await active.keychain.update(JSON.stringify(updated));
          keyRecord = updated;
        } catch {
          report('key_init_failed');
        }
      }
    } finally {
      scanComplete = true;
    }
  }

  function start(active: ConfigIntegrityRuntime) {
    if (!scan) {
      rememberLocalState();
      runtime = active;
      scan = observe(active);
    }
    return scan;
  }

  function signSavedFields(
    active: ConfigIntegrityRuntime,
    key: KeyRecord,
    store: ProtectedStore,
    previous: DiskObject,
  ) {
    const next = readObject(disk, store);
    if (next.kind !== 'present') {
      report('config_unreadable', { store });
      return;
    }
    if (previous.kind === 'present' && previous.raw === next.raw) {
      return;
    }
    if (previous.kind === 'invalid') {
      report('config_unreadable', { store });
      return;
    }

    const changes: { field: string; input: string; before?: string }[] = [];
    for (const field of Object.keys(registry.stores[store] ?? {})) {
      try {
        const input = fieldInput(store, field, next.value);
        const before =
          previous.kind === 'present'
            ? fieldInput(store, field, previous.value)
            : undefined;
        if (before !== input) {
          changes.push({ field, input, before });
        }
      } catch {
        report('hmac_compute_failed', { store, field });
      }
    }
    if (!changes.length) {
      return;
    }

    const saved = readObject(disk, CONFIG_INTEGRITY_KEY);
    if (saved.kind === 'missing') {
      return;
    }
    if (saved.kind !== 'present' || !isMetadata(saved.value)) {
      report('metadata_invalid');
      return;
    }

    const metadata = saved.value;
    const savedFields = getStoreMetadata(metadata, store);
    if (savedFields === undefined && previous.kind !== 'missing') {
      return;
    }
    if (savedFields !== undefined && !isObject(savedFields)) {
      report('metadata_invalid', { store });
      return;
    }

    const target = savedFields ?? {};
    const signed: DiagnosticLocation[] = [];
    for (const { field, input, before } of changes) {
      const location: DiagnosticLocation = { store, field };
      const hasDigest = hasOwn(target, field);
      const digest = target[field];
      if (hasDigest && !isHexDigest(digest)) {
        report('metadata_invalid', location);
        continue;
      }
      if (!hasDigest && previous.kind !== 'missing') {
        continue;
      }
      try {
        if (
          !scanComplete &&
          before !== undefined &&
          isHexDigest(digest) &&
          !active.matches(digest, sign(active, key, before))
        ) {
          continue;
        }
        target[field] = sign(active, key, input);
        signed.push(location);
      } catch {
        report('hmac_compute_failed', location);
      }
    }
    if (signed.length) {
      metadata.stores[store] = target;
      writeMetadata(metadata, signed);
    }
  }

  const storage: StorageAdapater = {
    ...businessStorage,
    setItem<T>(name: string, value: T) {
      if (!hasOwn(registry.stores, name)) {
        businessStorage.setItem(name, value);
        return;
      }
      const store = name as ProtectedStore;
      rememberLocalState();
      const active = runtime;
      const key = keyRecord;
      const previous = active && key ? readObject(disk, store) : undefined;
      businessStorage.setItem(name, value);
      if (active && key && previous) {
        signSavedFields(active, key, store, previous);
      }
    },
  };

  return { start, storage, getScan: () => scan };
}
