import type {
  KeyringVaultStorageDebugState,
  KeyringVaultTimingResult,
} from '@rabby-wallet/service-keyring/src/keyringService';

import { keyringService } from '../services';

type KeyringServiceWithVaultDebug = typeof keyringService & {
  getVaultStorageDebugState: () => KeyringVaultStorageDebugState;
  debugMigrateShardedVault: (password: string) => Promise<{
    durationMs: number;
    recordCount: number;
    vaultDataKeyString: string;
    storage: KeyringVaultStorageDebugState;
  }>;
  debugMeasureUnlockPaths: (options: {
    password?: string;
    trustedVaultDataKeyString?: string;
  }) => Promise<KeyringVaultTimingResult[]>;
};

function getDebugService() {
  return keyringService as KeyringServiceWithVaultDebug;
}

export function getVaultStorageDebugState() {
  return getDebugService().getVaultStorageDebugState();
}

export function migrateShardedVault(password: string) {
  return getDebugService().debugMigrateShardedVault(password);
}

export function measureUnlockPaths(options: {
  password?: string;
  trustedVaultDataKeyString?: string;
}) {
  return getDebugService().debugMeasureUnlockPaths(options);
}
