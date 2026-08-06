export type WalletAccountState = 'checking' | 'unknown' | 'empty' | 'available';

export type WalletEntryDestination = 'Home' | 'Unlock' | 'GetStarted';

export function resolveWalletAccountState({
  hasVisibleAccounts,
  hasStoredKeyrings,
  hasPersistedAccountSnapshot,
  isKeyringUnlocked,
}: {
  hasVisibleAccounts: boolean;
  hasStoredKeyrings: boolean;
  hasPersistedAccountSnapshot: boolean;
  isKeyringUnlocked: boolean;
}): Exclude<WalletAccountState, 'checking'> {
  if (hasVisibleAccounts) {
    return 'available';
  }

  if (!hasStoredKeyrings || hasPersistedAccountSnapshot || isKeyringUnlocked) {
    return 'empty';
  }

  return 'unknown';
}

export function resolveWalletEntryDestination({
  accountState,
  isAppUnlocked,
  isUnlockSessionValid,
}: {
  accountState: WalletAccountState;
  isAppUnlocked: boolean;
  isUnlockSessionValid: boolean;
}): WalletEntryDestination | null {
  switch (accountState) {
    case 'checking':
      return null;
    case 'empty':
      return 'GetStarted';
    case 'unknown':
      return isAppUnlocked ? 'Home' : 'Unlock';
    case 'available':
      return isAppUnlocked || isUnlockSessionValid ? 'Home' : 'Unlock';
  }
}
