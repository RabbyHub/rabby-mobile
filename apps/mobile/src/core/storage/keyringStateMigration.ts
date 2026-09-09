import { stringUtils } from '@rabby-wallet/base-utils';

type PersistedKeyringState = Record<string, unknown>;

export type KeyringStateMigrationWriteEvent = {
  phase: 'request' | 'complete' | 'error';
  source: 'keyring-primary' | 'keyring-checkpoint' | 'legacy-default-mmkv';
  value: PersistedKeyringState;
  error?: unknown;
};

export type KeyringStatePersistenceResult = {
  target: 'keyring-primary';
};

// MMKV 1.3.3 has an Android-only corruption path when an encrypted instance
// updates its single stored key. Keep a non-sensitive permanent companion key
// in both keyring files so legacy files take the multi-key append path too.
export const KEYRING_MMKV_GUARD_KEY = '__rabby_keyring_mmkv_guard_v1';
export const KEYRING_MMKV_GUARD_VALUE = '1';

type KeyringStateReadResult =
  | {
      status: 'missing' | 'invalid';
      value: null;
    }
  | {
      status: 'valid';
      value: PersistedKeyringState;
    };

export type KeyringStateStorage = {
  contains(key: string): boolean;
  delete(key: string): void;
  getString(key: string): string | null | undefined;
  set(key: string, value: string): void;
  sync(): void;
  reload(): void;
};

type KeyringStateDiagnosticStorage = Pick<
  KeyringStateStorage,
  'contains' | 'getString'
> & {
  getNumber?(key: string): number | null | undefined;
  getBoolean?(key: string): boolean | null | undefined;
  getBuffer?(key: string): ArrayBuffer | null | undefined;
};

type KeyringStateValueProbe = {
  status: 'value' | 'missing' | 'unavailable' | 'error';
  length?: number;
  error?: string;
};

export type PersistedKeyringStateDiagnostic = {
  status: KeyringStateReadResult['status'];
  contains: boolean | 'error';
  string: KeyringStateValueProbe;
  parsedValueType?: string;
  matchesPersistedStateShape?: boolean;
  nativeFallback?: {
    number: KeyringStateValueProbe;
    boolean: KeyringStateValueProbe;
    buffer: KeyringStateValueProbe;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, ' ').slice(0, 160);
}

function getValueType(value: unknown) {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

function probeNativeValue(
  read: (() => unknown) | undefined,
): KeyringStateValueProbe {
  if (!read) {
    return { status: 'unavailable' };
  }

  try {
    const value = read();
    if (value === null || value === undefined) {
      return { status: 'missing' };
    }

    return {
      status: 'value',
      ...(value instanceof ArrayBuffer ? { length: value.byteLength } : {}),
    };
  } catch (error) {
    return {
      status: 'error',
      error: getErrorMessage(error),
    };
  }
}

/**
 * This is intentionally a storage-boundary check, not a full keyring-service
 * validator. It only accepts the persisted state shapes that can safely reach
 * KeyringService.loadStore(), so an unrelated default-MMKV value cannot be
 * copied into the encrypted keyring store during the legacy migration.
 */
function isPersistedKeyringState(
  value: unknown,
): value is PersistedKeyringState {
  if (!isRecord(value)) {
    return false;
  }

  const hasStatePayload =
    'booted' in value ||
    'vault' in value ||
    'unencryptedKeyringData' in value ||
    'publicAccountSnapshot' in value;

  if (!hasStatePayload) {
    return false;
  }

  if (value.booted !== undefined && typeof value.booted !== 'string') {
    return false;
  }

  if (value.vault !== undefined && typeof value.vault !== 'string') {
    return false;
  }

  if (
    value.unencryptedKeyringData !== undefined &&
    !Array.isArray(value.unencryptedKeyringData)
  ) {
    return false;
  }

  if (
    value.publicAccountSnapshot !== undefined &&
    !isRecord(value.publicAccountSnapshot)
  ) {
    return false;
  }

  if (
    value.hasEncryptedKeyringData !== undefined &&
    typeof value.hasEncryptedKeyringData !== 'boolean'
  ) {
    return false;
  }

  return value.passwordState === undefined || isRecord(value.passwordState);
}

function readPersistedKeyringState(
  storage: Pick<KeyringStateStorage, 'contains' | 'getString'>,
  key: string,
): KeyringStateReadResult {
  let rawValue: string | null | undefined;

  try {
    rawValue = storage.getString(key);
  } catch {
    return { status: 'invalid', value: null };
  }

  if (!rawValue) {
    try {
      return {
        status: storage.contains(key) ? 'invalid' : 'missing',
        value: null,
      };
    } catch {
      return { status: 'invalid', value: null };
    }
  }

  const parsed = stringUtils.safeParseJSON(rawValue, {
    defaultValue: null,
  });
  if (!isPersistedKeyringState(parsed)) {
    return { status: 'invalid', value: null };
  }

  return { status: 'valid', value: parsed };
}

/**
 * Non-sensitive native-MMKV read diagnostics for an already-known key.
 * It deliberately records only getter availability, string length, parser
 * shape, and bounded native error text; no persisted keyring value is logged.
 */
export function inspectPersistedKeyringState(
  storage: KeyringStateDiagnosticStorage,
  key: string,
): PersistedKeyringStateDiagnostic {
  let contains: boolean | 'error' = 'error';
  try {
    contains = storage.contains(key);
  } catch {
    // Keep the diagnostic path best-effort. The individual getter error below
    // is usually more useful than an additional storage exception.
  }

  let rawValue: string | null | undefined;
  try {
    rawValue = storage.getString(key);
  } catch (error) {
    return {
      status: 'invalid',
      contains,
      string: {
        status: 'error',
        error: getErrorMessage(error),
      },
      nativeFallback: {
        number: probeNativeValue(
          storage.getNumber ? () => storage.getNumber!(key) : undefined,
        ),
        boolean: probeNativeValue(
          storage.getBoolean ? () => storage.getBoolean!(key) : undefined,
        ),
        buffer: probeNativeValue(
          storage.getBuffer ? () => storage.getBuffer!(key) : undefined,
        ),
      },
    };
  }

  if (!rawValue) {
    const status = contains === true ? 'invalid' : 'missing';

    return {
      status,
      contains,
      string: { status: 'missing' },
      ...(status === 'invalid'
        ? {
            nativeFallback: {
              number: probeNativeValue(
                storage.getNumber ? () => storage.getNumber!(key) : undefined,
              ),
              boolean: probeNativeValue(
                storage.getBoolean ? () => storage.getBoolean!(key) : undefined,
              ),
              buffer: probeNativeValue(
                storage.getBuffer ? () => storage.getBuffer!(key) : undefined,
              ),
            },
          }
        : {}),
    };
  }

  const parsed = stringUtils.safeParseJSON(rawValue, {
    defaultValue: null,
  });
  const matchesPersistedStateShape = isPersistedKeyringState(parsed);
  const status = matchesPersistedStateShape ? 'valid' : 'invalid';

  return {
    status,
    contains,
    string: {
      status: 'value',
      length: rawValue.length,
    },
    parsedValueType: getValueType(parsed),
    matchesPersistedStateShape,
    ...(status === 'invalid'
      ? {
          nativeFallback: {
            number: probeNativeValue(
              storage.getNumber ? () => storage.getNumber!(key) : undefined,
            ),
            boolean: probeNativeValue(
              storage.getBoolean ? () => storage.getBoolean!(key) : undefined,
            ),
            buffer: probeNativeValue(
              storage.getBuffer ? () => storage.getBuffer!(key) : undefined,
            ),
          },
        }
      : {}),
  };
}

export function hasValidPersistedKeyringState(
  storage: Pick<KeyringStateStorage, 'contains' | 'getString'>,
  key: string,
) {
  return readPersistedKeyringState(storage, key).status === 'valid';
}

type KeyringStateSource = KeyringStateMigrationWriteEvent['source'];

function serializePersistedKeyringState(value: PersistedKeyringState) {
  return JSON.stringify(value);
}

function ensureKeyringMMKVGuard(storage: KeyringStateStorage) {
  const currentValue = storage.getString(KEYRING_MMKV_GUARD_KEY);
  if (currentValue === KEYRING_MMKV_GUARD_VALUE) {
    return;
  }

  // A non-string or unknown guard is storage corruption/configuration drift,
  // not a value that can safely be replaced while protecting keyring state.
  if (currentValue !== null && currentValue !== undefined) {
    throw new Error('Refusing to overwrite an invalid keyring MMKV guard.');
  }

  if (storage.contains(KEYRING_MMKV_GUARD_KEY)) {
    throw new Error('Refusing to overwrite an invalid keyring MMKV guard.');
  }

  storage.set(KEYRING_MMKV_GUARD_KEY, KEYRING_MMKV_GUARD_VALUE);
  storage.sync();
  storage.reload();

  if (storage.getString(KEYRING_MMKV_GUARD_KEY) !== KEYRING_MMKV_GUARD_VALUE) {
    throw new Error('Keyring MMKV guard persistence verification failed.');
  }
}

/**
 * A write is accepted only after it has been flushed and reloaded through the
 * native decoder. In particular, an MMKV CRC match alone is insufficient: the
 * Huawei reproducer produced a CRC-valid payload that MiniPB could not parse.
 */
function writePersistedKeyringStateAndVerify({
  storage,
  key,
  value,
  ensureMMKVGuard = false,
}: {
  storage: KeyringStateStorage;
  key: string;
  value: PersistedKeyringState;
  ensureMMKVGuard?: boolean;
}) {
  if (ensureMMKVGuard) {
    ensureKeyringMMKVGuard(storage);
  }

  const serializedValue = serializePersistedKeyringState(value);
  storage.set(key, serializedValue);
  storage.sync();
  storage.reload();

  const verified = readPersistedKeyringState(storage, key);
  if (
    verified.status !== 'valid' ||
    serializePersistedKeyringState(verified.value) !== serializedValue
  ) {
    throw new Error('Keyring state persistence verification failed.');
  }
}

function getFirstValidKeyringState(
  candidates: Array<{
    source: KeyringStateSource;
    state: KeyringStateReadResult;
  }>,
) {
  return candidates.find(candidate => candidate.state.status === 'valid');
}

function hasInvalidKeyringState(states: KeyringStateReadResult[]) {
  return states.some(state => state.status === 'invalid');
}

/**
 * Persists a new value in the established primary keyring file with a
 * one-generation rollback copy.
 *
 * The checkpoint is intentionally written and verified before mutating the
 * primary file. It is a separate encrypted MMKV file, so a primary decode
 * failure cannot immediately turn into a blank keyring on the next launch.
 * It is a recovery boundary, not a claim that two MMKV files are independent
 * implementations of native persistence.
 */
export function persistKeyringState({
  key,
  keyringStorage,
  checkpointStorage,
  value,
}: {
  key: string;
  keyringStorage: KeyringStateStorage;
  checkpointStorage: KeyringStateStorage;
  value: PersistedKeyringState;
}): KeyringStatePersistenceResult {
  if (!isPersistedKeyringState(value)) {
    throw new Error('Refusing to persist an invalid keyring state shape.');
  }

  const primary = readPersistedKeyringState(keyringStorage, key);
  const checkpoint = readPersistedKeyringState(checkpointStorage, key);

  if (checkpoint.status === 'invalid') {
    throw new Error(
      'Refusing to overwrite an invalid keyring persistence file.',
    );
  }

  if (primary.status === 'invalid') {
    throw new Error('Refusing to overwrite an invalid keyring primary file.');
  }

  if (primary.status === 'valid') {
    // Keep the last verified primary generation before applying the new state.
    writePersistedKeyringStateAndVerify({
      storage: checkpointStorage,
      key,
      value: primary.value,
      ensureMMKVGuard: true,
    });
    // Do not advance the checkpoint after a failed primary verification: it
    // is the last known-good primary generation used for restart recovery.
    writePersistedKeyringStateAndVerify({
      storage: keyringStorage,
      key,
      value,
      ensureMMKVGuard: true,
    });
    return { target: 'keyring-primary' };
  }

  if (checkpoint.status === 'valid') {
    // A missing primary can be reconstructed from a verified checkpoint before
    // it is advanced. An invalid primary is deliberately handled above.
    writePersistedKeyringStateAndVerify({
      storage: keyringStorage,
      key,
      value: checkpoint.value,
      ensureMMKVGuard: true,
    });
    writePersistedKeyringStateAndVerify({
      storage: checkpointStorage,
      key,
      value: checkpoint.value,
      ensureMMKVGuard: true,
    });
    writePersistedKeyringStateAndVerify({
      storage: keyringStorage,
      key,
      value,
      ensureMMKVGuard: true,
    });
    return { target: 'keyring-primary' };
  }

  // First bootstrap: there is no prior state to checkpoint yet. Verify the
  // primary before creating a matching initial checkpoint.
  writePersistedKeyringStateAndVerify({
    storage: keyringStorage,
    key,
    value,
    ensureMMKVGuard: true,
  });
  writePersistedKeyringStateAndVerify({
    storage: checkpointStorage,
    key,
    value,
    ensureMMKVGuard: true,
  });
  return { target: 'keyring-primary' };
}

export function normalizePersistedKeyringState({
  key,
  keyringStorage,
  checkpointStorage,
  legacyStorage,
  onKeyringStateWrite,
}: {
  key: string;
  keyringStorage: KeyringStateStorage;
  checkpointStorage: KeyringStateStorage;
  legacyStorage: KeyringStateStorage;
  onKeyringStateWrite?(event: KeyringStateMigrationWriteEvent): void;
}) {
  const legacy = readPersistedKeyringState(legacyStorage, key);
  const checkpoint = readPersistedKeyringState(checkpointStorage, key);
  const keyring = readPersistedKeyringState(keyringStorage, key);

  if (keyring.status === 'valid') {
    let persistenceBlocked = false;

    if (checkpoint.status !== 'valid') {
      try {
        writePersistedKeyringStateAndVerify({
          storage: checkpointStorage,
          key,
          value: keyring.value,
          ensureMMKVGuard: true,
        });
      } catch {
        // Loading a known-good primary is still safe, but future updates must
        // not run without a verified rollback point.
        persistenceBlocked = true;
      }
    }

    if (legacy.status === 'valid') {
      // The encrypted keyring store is authoritative. Remove only a proven
      // duplicate legacy record so an invalid legacy value remains available
      // for diagnosis instead of being silently discarded.
      legacyStorage.delete(key);
    }

    return {
      legacyData: legacy.value,
      keyringData: keyring.value,
      recoverySource: 'keyring-primary' as const,
      ...(persistenceBlocked ? { persistenceBlocked: true } : {}),
    };
  }

  if (checkpoint.status === 'valid' && keyring.status === 'invalid') {
    // Do not attempt to repair a primary file that just failed its native
    // decoder. The checkpoint is already verified and may be carrying the
    // newest state recovered by persistKeyringState().
    return {
      legacyData: legacy.value,
      keyringData: checkpoint.value,
      recoverySource: 'keyring-checkpoint' as const,
      persistenceBlocked: true,
    };
  }

  const candidate = getFirstValidKeyringState([
    { source: 'keyring-checkpoint', state: checkpoint },
    { source: 'legacy-default-mmkv', state: legacy },
  ]);

  if (candidate?.state.status === 'valid') {
    const writeEvent = {
      source: candidate.source,
      value: candidate.state.value,
    };
    onKeyringStateWrite?.({ phase: 'request', ...writeEvent });

    try {
      if (candidate.source !== 'keyring-checkpoint') {
        writePersistedKeyringStateAndVerify({
          storage: checkpointStorage,
          key,
          value: candidate.state.value,
          ensureMMKVGuard: true,
        });
      }
      writePersistedKeyringStateAndVerify({
        storage: keyringStorage,
        key,
        value: candidate.state.value,
        ensureMMKVGuard: true,
      });
      onKeyringStateWrite?.({ phase: 'complete', ...writeEvent });
    } catch (error) {
      onKeyringStateWrite?.({ phase: 'error', ...writeEvent, error });
      return {
        legacyData: legacy.value,
        keyringData: candidate.state.value,
        recoverySource: candidate.source,
        persistenceBlocked: true,
      };
    }

    if (candidate.source === 'legacy-default-mmkv') {
      // This is no longer an authority after the primary keyring state and encrypted
      // checkpoint have both been verified. Do not trim here: trim clears the
      // native cache and is not a durability primitive.
      legacyStorage.delete(key);
    }

    return {
      legacyData: legacy.value,
      keyringData: candidate.state.value,
      recoverySource: candidate.source,
    };
  }

  return {
    legacyData: legacy.value,
    keyringData: null,
    recoverySource: null,
    ...(hasInvalidKeyringState([keyring, checkpoint, legacy])
      ? { persistenceBlocked: true }
      : {}),
  };
}
