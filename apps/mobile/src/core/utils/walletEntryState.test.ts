import {
  resolveWalletAccountState,
  resolveWalletEntryDestination,
} from './walletEntryState';

describe('wallet entry state', () => {
  describe('resolveWalletAccountState', () => {
    it.each([
      {
        name: 'available when at least one visible account exists',
        input: {
          hasVisibleAccounts: true,
          hasStoredKeyrings: true,
          hasPersistedAccountSnapshot: true,
          isKeyringUnlocked: false,
        },
        expected: 'available',
      },
      {
        name: 'empty when no keyring data exists',
        input: {
          hasVisibleAccounts: false,
          hasStoredKeyrings: false,
          hasPersistedAccountSnapshot: false,
          isKeyringUnlocked: false,
        },
        expected: 'empty',
      },
      {
        name: 'empty when the persisted snapshot authoritatively has no accounts',
        input: {
          hasVisibleAccounts: false,
          hasStoredKeyrings: true,
          hasPersistedAccountSnapshot: true,
          isKeyringUnlocked: false,
        },
        expected: 'empty',
      },
      {
        name: 'empty when an unlocked keyring runtime has no accounts',
        input: {
          hasVisibleAccounts: false,
          hasStoredKeyrings: true,
          hasPersistedAccountSnapshot: false,
          isKeyringUnlocked: true,
        },
        expected: 'empty',
      },
      {
        name: 'unknown for locked legacy data without an account snapshot',
        input: {
          hasVisibleAccounts: false,
          hasStoredKeyrings: true,
          hasPersistedAccountSnapshot: false,
          isKeyringUnlocked: false,
        },
        expected: 'unknown',
      },
    ])('$name', ({ input, expected }) => {
      expect(resolveWalletAccountState(input)).toBe(expected);
    });
  });

  describe('resolveWalletEntryDestination', () => {
    it.each([
      {
        name: 'waits while account state is checking',
        accountState: 'checking' as const,
        isAppUnlocked: false,
        isUnlockSessionValid: false,
        expected: null,
      },
      {
        name: 'opens onboarding for a locked empty wallet',
        accountState: 'empty' as const,
        isAppUnlocked: false,
        isUnlockSessionValid: false,
        expected: 'GetStarted',
      },
      {
        name: 'opens onboarding for an unlocked empty wallet',
        accountState: 'empty' as const,
        isAppUnlocked: true,
        isUnlockSessionValid: true,
        expected: 'GetStarted',
      },
      {
        name: 'unlocks legacy wallet data whose account state is unknown',
        accountState: 'unknown' as const,
        isAppUnlocked: false,
        isUnlockSessionValid: true,
        expected: 'Unlock',
      },
      {
        name: 'keeps the previous home fallback after an unlocked account check fails',
        accountState: 'unknown' as const,
        isAppUnlocked: true,
        isUnlockSessionValid: true,
        expected: 'Home',
      },
      {
        name: 'unlocks a wallet with accounts and no valid session',
        accountState: 'available' as const,
        isAppUnlocked: false,
        isUnlockSessionValid: false,
        expected: 'Unlock',
      },
      {
        name: 'opens home for an unlocked wallet with accounts',
        accountState: 'available' as const,
        isAppUnlocked: true,
        isUnlockSessionValid: false,
        expected: 'Home',
      },
      {
        name: 'skips unlock for a wallet with accounts and a valid session',
        accountState: 'available' as const,
        isAppUnlocked: false,
        isUnlockSessionValid: true,
        expected: 'Home',
      },
    ])(
      '$name',
      ({ accountState, isAppUnlocked, isUnlockSessionValid, expected }) => {
        expect(
          resolveWalletEntryDestination({
            accountState,
            isAppUnlocked,
            isUnlockSessionValid,
          }),
        ).toBe(expected);
      },
    );

    it('opens onboarding on both launch paths after the last account is removed', () => {
      const accountState = resolveWalletAccountState({
        hasVisibleAccounts: false,
        hasStoredKeyrings: true,
        hasPersistedAccountSnapshot: true,
        isKeyringUnlocked: false,
      });

      expect(
        resolveWalletEntryDestination({
          accountState,
          isAppUnlocked: false,
          isUnlockSessionValid: false,
        }),
      ).toBe('GetStarted');
      expect(
        resolveWalletEntryDestination({
          accountState,
          isAppUnlocked: false,
          isUnlockSessionValid: true,
        }),
      ).toBe('GetStarted');
    });
  });
});
