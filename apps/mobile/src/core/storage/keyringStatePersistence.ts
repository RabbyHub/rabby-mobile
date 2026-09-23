import { persistKeyringState } from './keyringStateMigration';
import type { KeyringStateStorage } from './keyringStateMigration';

type PersistedKeyringState = Parameters<typeof persistKeyringState>[0]['value'];

export function getKeyringStateSummary(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valueType: Array.isArray(value) ? 'array' : typeof value };
  }

  const state = value as Record<string, unknown>;
  const publicAccountSnapshot = state.publicAccountSnapshot;
  const accounts =
    publicAccountSnapshot &&
    typeof publicAccountSnapshot === 'object' &&
    !Array.isArray(publicAccountSnapshot)
      ? (publicAccountSnapshot as Record<string, unknown>).accounts
      : undefined;

  return {
    valueType: 'record',
    hasBooted: typeof state.booted === 'string',
    hasVault: typeof state.vault === 'string',
    hasEncryptedKeyringData: state.hasEncryptedKeyringData === true,
    hasPasswordState:
      !!state.passwordState && typeof state.passwordState === 'object',
    unencryptedKeyringCount: Array.isArray(state.unencryptedKeyringData)
      ? state.unencryptedKeyringData.length
      : null,
    publicAccountCount: Array.isArray(accounts) ? accounts.length : null,
  };
}

export function createKeyringStatePersistence({
  key,
  keyringStorage,
  checkpointStorage,
  initialBlocked = false,
  onDiagnostic = () => undefined,
}: {
  key: string;
  keyringStorage: KeyringStateStorage;
  checkpointStorage: KeyringStateStorage;
  initialBlocked?: boolean;
  onDiagnostic?: (event: string, data: Record<string, unknown>) => void;
}) {
  let sequence = 0;
  let blocked = initialBlocked;
  let prePersistedValue: PersistedKeyringState | null = null;

  function persist(value: PersistedKeyringState, requireSuccess: boolean) {
    const currentSequence = ++sequence;
    const summary = getKeyringStateSummary(value);
    onDiagnostic('persist.request', {
      sequence: currentSequence,
      state: summary,
    });

    if (blocked) {
      onDiagnostic('persist.blocked', {
        sequence: currentSequence,
        state: summary,
        reason: 'recovery-or-verification-required',
      });
      if (requireSuccess) {
        throw new Error(
          'Keyring persistence requires recovery or verification.',
        );
      }
      return;
    }

    try {
      const persistence = persistKeyringState({
        key,
        keyringStorage,
        checkpointStorage,
        value,
      });
      onDiagnostic('persist.complete', {
        sequence: currentSequence,
        state: summary,
        persistence,
      });
    } catch (error) {
      blocked = true;
      onDiagnostic('persist.error', {
        sequence: currentSequence,
        state: summary,
        error:
          error instanceof Error
            ? error.message.slice(0, 160)
            : String(error).slice(0, 160),
      });
      throw error;
    }
  }

  function onStoreUpdate(value: PersistedKeyringState) {
    const wasPrePersisted =
      prePersistedValue !== null && value === prePersistedValue;
    prePersistedValue = null;
    if (!wasPrePersisted) {
      persist(value, false);
    }
  }

  function persistVaultUpgrade(value: PersistedKeyringState): true {
    prePersistedValue = null;
    // Report write/readback failures directly, before ObservableStore publishes
    // memory or defers subscriber errors through SafeEventEmitter.
    persist(value, true);
    // The caller must immediately publish this exact, unchanged object with
    // putState. Repeating the write would replace the rollback checkpoint.
    prePersistedValue = value;
    return true;
  }

  return { onStoreUpdate, persistVaultUpgrade };
}
