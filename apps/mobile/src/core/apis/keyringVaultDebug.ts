import { keyringService } from '../services';

type KeyringServiceWithVaultDebug = typeof keyringService & {
  getVaultStorageDebugState: () => {
    hasVault: boolean;
    vaultBytes: number;
    vaultHash: string | null;
    hasBooted: boolean;
    hasUnencryptedKeyringData: boolean;
    unencryptedKeyringCount: number;
    hasEncryptedKeyringData: boolean;
  };
  debugMeasureUnlockPaths: (options: {
    password?: string;
    trustedVaultKeyString?: string;
    measurePassword?: boolean;
    measureCachedKey?: boolean;
  }) => Promise<
    Array<{
      label: string;
      source: 'password' | 'cachedKey';
      success: boolean;
      durationMs: number;
      error?: string;
      keyringCount?: number;
    }>
  >;
  debugExportTrustedVaultKeyString: (password: string) => Promise<string>;
};

const vaultDebugService = keyringService as KeyringServiceWithVaultDebug;

export function getVaultStorageDebugState() {
  return vaultDebugService.getVaultStorageDebugState();
}

export function measureUnlockPaths(options: {
  password?: string;
  trustedVaultKeyString?: string;
  measurePassword?: boolean;
  measureCachedKey?: boolean;
}) {
  return vaultDebugService.debugMeasureUnlockPaths(options);
}

export function exportTrustedVaultKeyString(password: string) {
  return vaultDebugService.debugExportTrustedVaultKeyString(password);
}
