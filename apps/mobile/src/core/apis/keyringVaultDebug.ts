import {
  exportTrustedVaultKeyStringForDebug,
  getKeyringVaultDebugStateSnapshot,
  measureKeyringUnlockPathsForDebug,
} from '@/core/serviceApi/keyring';

export function getVaultStorageDebugState() {
  return getKeyringVaultDebugStateSnapshot();
}

export function measureUnlockPaths(options: {
  password?: string;
  trustedVaultKeyString?: string;
  measurePassword?: boolean;
  measureCachedKey?: boolean;
}) {
  return measureKeyringUnlockPathsForDebug(options);
}

export function exportTrustedVaultKeyString(password: string) {
  return exportTrustedVaultKeyStringForDebug(password);
}
