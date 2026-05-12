import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import HdKeyring from '@rabby-wallet/eth-hd-keyring';
import { RABBY_MOBILE_KR_PWD } from '@/constant/encryptor';
import { apiMnemonic, apisLock } from '@/core/apis';
import { KEYCHAIN_AUTH_TYPES } from '@/core/apis/keychain';
import {
  addKeyringAndactiveAndPersistAccounts,
  activeAndPersistAccountsByMnemonics,
  generateKeyringWithMnemonic,
} from '@/core/apis/mnemonic';
import { accountEvents } from '@/core/apis/account';
import { requestKeyring } from '@/core/apis/keyring';
import { validateAndCleanPrivateKey } from '@/core/apis/privateKey';
import { keyringService, preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { useBiometrics } from '@/hooks/biometrics';
import { toast } from '@/components2024/Toast';
import { PasswordFormValues } from '@/components2024/PasswordForm';
import i18n from '@/utils/i18n';
import * as SecretVault from '@/core/utils/secretVault';

// ============ Types ============

export type WalletCreationMode =
  | 'create'
  | 'importSeedPhrase'
  | 'importPrivateKey';

export type WalletCreationResult = {
  seedPhrase?: string;
  privateKey?: string;
  address: string;
  addressIndex: number;
  accountsToCreate?: Array<{ address: string; index?: number }>;
  mode: WalletCreationMode;
};

/** Params for wallet creation - union type for type safety */
export type CreateWalletParams =
  | { seedPhraseVaultId: string; privateKeyVaultId?: never }
  | { privateKeyVaultId: string; seedPhraseVaultId?: never }
  | undefined;

export type UseSetupWalletResult = {
  /** Derived/generated address to display */
  address: string | undefined;
  /** Whether data is being loaded/generated */
  isLoading: boolean;
  /** Current mode based on params */
  mode: WalletCreationMode;
  /** Whether form submission is in progress */
  isSubmitting: boolean;
  /** Handler for password form submission */
  handleSubmit: (
    formValues: PasswordFormValues,
  ) => Promise<void | 'fallback' | 'success'>;
};

// ============ Data Generation Functions ============

function generateRandomPassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(__DEV__ ? 6 : 32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

/**
 * Creates a new wallet with generated seed phrase.
 */
async function createNewWallet(): Promise<WalletCreationResult> {
  const generatedSeedPhrase = await apiMnemonic.generatePreMnemonic();

  const Keyring = keyringService.getKeyringClassForType(
    KEYRING_CLASS.MNEMONIC,
  ) as any;
  const keyring = new Keyring({
    mnemonic: generatedSeedPhrase,
    passphrase: '',
  });
  const accountsToCreate = keyring?.getAddresses(0, 1);
  const address = accountsToCreate?.[0].address;

  return {
    seedPhrase: generatedSeedPhrase,
    address,
    addressIndex: accountsToCreate?.[0].index ?? 0,
    accountsToCreate,
    mode: 'create',
  };
}

/**
 * Imports wallet from seed phrase.
 * Replicates the old user flow for importing from seed phrase.
 * First generates a keyring, then derives the first address.
 */
async function importFromSeedPhrase(
  seedPhrase: string,
): Promise<WalletCreationResult> {
  // 1. Validate the mnemonic
  if (!HdKeyring.validateMnemonic(seedPhrase)) {
    throw new Error('Invalid mnemonic');
  }

  // 2. Create a temporary keyring instance to derive the address
  // Note: We DON'T persist this keyring yet - that happens after password is set
  const Keyring = keyringService.getKeyringClassForType(
    KEYRING_CLASS.MNEMONIC,
  ) as any;
  const keyring = new Keyring({
    mnemonic: seedPhrase,
    passphrase: '',
  });

  // 3. Get first address from the temporary keyring
  const accountsToCreate = keyring?.getAddresses(0, 1);
  const address = accountsToCreate?.[0].address;
  const addressIndex = accountsToCreate?.[0].index ?? 0;

  if (!address) {
    throw new Error('Failed to derive address from seed phrase');
  }

  return {
    seedPhrase,
    address,
    addressIndex,
    accountsToCreate,
    mode: 'importSeedPhrase',
  };
}

/**
 * Imports wallet from private key.
 * Validates the private key and derives the address for display.
 * Note: We DON'T persist this keyring yet - that happens after password is set.
 */
async function importFromPrivateKey(
  privateKey: string,
): Promise<WalletCreationResult> {
  // 1. Validate and clean the private key
  const cleanedPrivateKey = validateAndCleanPrivateKey(privateKey);

  // 2. Create a temporary keyring instance to derive the address
  // Note: We DON'T persist this keyring yet - that happens after password is set
  const Keyring = keyringService.getKeyringClassForType(
    KEYRING_CLASS.PRIVATE_KEY,
  ) as any;
  const keyring = new Keyring([cleanedPrivateKey]);

  // 3. Get the address from the temporary keyring
  const accounts = await keyring.getAccounts();
  const address = accounts[0];

  if (!address) {
    throw new Error('Failed to derive address from private key');
  }

  return {
    privateKey: cleanedPrivateKey,
    address,
    addressIndex: 0,
    mode: 'importPrivateKey',
    accountsToCreate: [{ address, index: 0 }],
  };
}

// ============ Submit Functions ============

/**
 * Submits for 'create' mode - creates new wallet from generated seed phrase.
 * This replicates the old user flow for creating a new wallet.
 */
async function submitCreateWallet(
  walletData: WalletCreationResult,
  formValues: PasswordFormValues,
  callbacks: {
    toggleBiometrics?: <T extends boolean>(
      nextEnabled: T,
      input: {
        tipLoading?: boolean;
        authenticationType?: KEYCHAIN_AUTH_TYPES;
      } & (T extends true
        ? { validatedPassword: string }
        : { validatedPassword?: undefined }),
    ) => Promise<boolean>;
  },
): Promise<void> {
  const { address, addressIndex, seedPhrase, accountsToCreate } = walletData;
  const { toggleBiometrics } = callbacks;

  // Validate required data
  if (!address || !seedPhrase) {
    throw new Error('Missing address or seed phrase');
  }

  // 1. Update password
  const result = await apisLock.resetPasswordOnUI(formValues.password);
  if (result.error) {
    throw new Error(result.error);
  }

  // 2. Enable biometrics if selected
  if (toggleBiometrics && formValues.enableBiometrics) {
    try {
      const ok = await toggleBiometrics(true, {
        validatedPassword: formValues.password,
        authenticationType: KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
      });
      if (!ok) throw new Error('Biometrics rejected');
    } catch (e) {
      if (formValues.useAutoGeneratedPassword) {
        // Revert wallet password — it was changed to an unknown random value.
        await keyringService.resetPassword(RABBY_MOBILE_KR_PWD);
        throw e;
      }
      console.log('toggleBiometrics error', e);
      // Non-fatal error, continue
    }
  }

  // 3. Create keyring and persist accounts
  await addKeyringAndactiveAndPersistAccounts(
    seedPhrase,
    '',
    accountsToCreate || [],
    true,
  );

  // 4. Clean up temporary pre-mnemonic data
  keyringService.removePreMnemonics();

  // 5. Report action
  preferenceService.setReportActionTs(
    REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE,
  );

  // 6. Emit account added event
  accountEvents.emit('ACCOUNT_ADDED', {
    accounts: [
      {
        address,
        brandName: KEYRING_CLASS.MNEMONIC,
        type: KEYRING_TYPE.HdKeyring,
      },
    ],
    scene: 'memonics',
    needsBackupReminder: true,
  });

  // 7. Show success toast (will appear on Home page after navigation due to delay)
  toast.success(
    i18n.t('page.importSuccess.success', {
      type: i18n.t('global.WalletCreated'),
    }),
    {
      delay: 500,
      duration: 3000,
    },
  );

  // 8. Navigate directly to Home
  apisSingleHome.navigateToSingleHome(
    {
      address,
      brandName: KEYRING_CLASS.MNEMONIC,
      type: KEYRING_TYPE.HdKeyring,
      index: addressIndex,
    },
    { replace: true },
  );
  apisHomeTabIndex.setTabIndex(0);
}

/**
 * Submits for 'importSeedPhrase' mode.
 * Replicates the old user flow for importing from seed phrase.
 * Uses activeAndPersistAccountsByMnemonics instead of addKeyringAndactiveAndPersistAccounts.
 */
async function submitImportSeedPhrase(
  walletData: WalletCreationResult,
  formValues: PasswordFormValues,
  callbacks: {
    toggleBiometrics?: <T extends boolean>(
      nextEnabled: T,
      input: {
        tipLoading?: boolean;
        authenticationType?: KEYCHAIN_AUTH_TYPES;
      } & (T extends true
        ? { validatedPassword: string }
        : { validatedPassword?: undefined }),
    ) => Promise<boolean>;
  },
): Promise<void> {
  const { seedPhrase } = walletData;
  const { toggleBiometrics } = callbacks;

  // Validate required data
  if (!seedPhrase) {
    throw new Error('Missing seed phrase');
  }

  // 1. Update password
  const result = await apisLock.resetPasswordOnUI(formValues.password);
  if (result.error) {
    throw new Error(result.error);
  }

  // 2. Enable biometrics if selected
  if (toggleBiometrics && formValues.enableBiometrics) {
    try {
      const ok = await toggleBiometrics(true, {
        validatedPassword: formValues.password,
        authenticationType: KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
      });
      if (!ok) throw new Error('Biometrics rejected');
    } catch (e) {
      if (formValues.useAutoGeneratedPassword) {
        // Revert wallet password — it was changed to an unknown random value.
        await keyringService.resetPassword(RABBY_MOBILE_KR_PWD);
        throw e;
      }
      console.log('toggleBiometrics error', e);
      // Non-fatal error, continue
    }
  }

  // 3. Create keyring with mnemonic (now that password is set)
  // This persists the keyring to encrypted storage
  const { keyringId } = await generateKeyringWithMnemonic(seedPhrase, '', true);

  // 4. Get addresses from the persisted keyring
  const firstAddress = await requestKeyring(
    KEYRING_TYPE.HdKeyring,
    'getAddresses',
    keyringId ?? null,
    0,
    1,
  );

  if (!firstAddress?.[0]?.address) {
    throw new Error('Failed to get address from keyring');
  }

  const address = firstAddress[0].address;
  const addressIndex = firstAddress[0].index ?? 0;

  // XXX: CRUCIAL!!! Delete this line and you fxxk up.
  await new Promise(resolve => setTimeout(resolve, 1));

  // 5. Activate and persist accounts using the addresses from the actual keyring
  await activeAndPersistAccountsByMnemonics(seedPhrase, '', firstAddress, true);

  // 6. Clean up temporary pre-mnemonic data
  keyringService.removePreMnemonics();

  // 7. Report action
  preferenceService.setReportActionTs(
    REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE,
  );

  // 8. Emit account added event
  accountEvents.emit('ACCOUNT_ADDED', {
    accounts: [
      {
        address,
        brandName: KEYRING_CLASS.MNEMONIC,
        type: KEYRING_TYPE.HdKeyring,
      },
    ],
    scene: 'memonics',
  });

  // 9. Show success toast (will appear on Home page after navigation due to delay)
  toast.success(
    i18n.t('page.importSuccess.success', {
      type: i18n.t('global.WalletImported'),
    }),
    {
      delay: 500,
      duration: 3000,
    },
  );

  // 10. Navigate directly to Home
  apisSingleHome.navigateToSingleHome(
    {
      address,
      brandName: KEYRING_CLASS.MNEMONIC,
      type: KEYRING_TYPE.HdKeyring,
      index: addressIndex,
    },
    { replace: true },
  );
  apisHomeTabIndex.setTabIndex(0);
}

/**
 * Submits for 'importPrivateKey' mode.
 * Replicates the old user flow for importing from private key.
 * Uses keyringService.importPrivateKey for the actual import.
 */
async function submitImportPrivateKey(
  walletData: WalletCreationResult,
  formValues: PasswordFormValues,
  callbacks: {
    toggleBiometrics?: <T extends boolean>(
      nextEnabled: T,
      input: {
        tipLoading?: boolean;
        authenticationType?: KEYCHAIN_AUTH_TYPES;
      } & (T extends true
        ? { validatedPassword: string }
        : { validatedPassword?: undefined }),
    ) => Promise<boolean>;
  },
): Promise<void> {
  const { privateKey } = walletData;
  const { toggleBiometrics } = callbacks;

  // Validate required data
  if (!privateKey) {
    throw new Error('Missing private key');
  }

  // 1. Update password
  const result = await apisLock.resetPasswordOnUI(formValues.password);
  if (result.error) {
    throw new Error(result.error);
  }

  // 2. Enable biometrics if selected
  if (toggleBiometrics && formValues.enableBiometrics) {
    try {
      const ok = await toggleBiometrics(true, {
        validatedPassword: formValues.password,
        authenticationType: KEYCHAIN_AUTH_TYPES.BIOMETRICS_OR_PASSCODE,
      });
      if (!ok) throw new Error('Biometrics rejected');
    } catch (e) {
      if (formValues.useAutoGeneratedPassword) {
        // Revert wallet password — it was changed to an unknown random value.
        await keyringService.resetPassword(RABBY_MOBILE_KR_PWD);
        throw e;
      }
      console.log('toggleBiometrics error', e);
      // Non-fatal error, continue
    }
  }

  // 3. Import the private key (this creates the keyring, persists it, and sets current account)
  const keyring = await keyringService.importPrivateKey(privateKey);

  // 4. Get the address from the imported keyring
  const accounts = await keyring.getAccounts();
  const address = accounts[0];

  if (!address) {
    throw new Error('Failed to get address from imported private key');
  }

  // 5. Clean up temporary pre-mnemonic data
  keyringService.removePreMnemonics();

  // 6. Report action
  preferenceService.setReportActionTs(
    REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE,
  );

  // 7. Emit account added event
  accountEvents.emit('ACCOUNT_ADDED', {
    accounts: [
      {
        address,
        brandName: KEYRING_CLASS.PRIVATE_KEY,
        type: KEYRING_TYPE.SimpleKeyring,
      },
    ],
    scene: 'privateKey',
  });

  // 8. Show success toast (will appear on Home page after navigation due to delay)
  toast.success(
    i18n.t('page.importSuccess.success', {
      type: i18n.t('global.Imported'),
    }),
    {
      delay: 500,
      duration: 3000,
    },
  );

  // 9. Navigate directly to Home
  apisSingleHome.navigateToSingleHome(
    {
      address,
      brandName: KEYRING_CLASS.PRIVATE_KEY,
      type: KEYRING_TYPE.SimpleKeyring,
      index: 0,
    },
    { replace: true },
  );
  apisHomeTabIndex.setTabIndex(0);
}

// ============ Gateway Submit Function ============

/**
 * Gateway function that routes to the appropriate submit handler based on mode.
 */
async function submitWalletCreation(
  walletData: WalletCreationResult,
  formValues: PasswordFormValues,
  callbacks: {
    toggleBiometrics?: <T extends boolean>(
      nextEnabled: T,
      input: {
        tipLoading?: boolean;
        authenticationType?: KEYCHAIN_AUTH_TYPES;
      } & (T extends true
        ? { validatedPassword: string }
        : { validatedPassword?: undefined }),
    ) => Promise<boolean>;
  },
): Promise<void> {
  const { mode } = walletData;

  switch (mode) {
    case 'create':
      return submitCreateWallet(walletData, formValues, callbacks);
    case 'importSeedPhrase':
      return submitImportSeedPhrase(walletData, formValues, callbacks);
    case 'importPrivateKey':
      return submitImportPrivateKey(walletData, formValues, callbacks);
    default:
      throw new Error(`Unknown wallet creation mode: ${mode}`);
  }
}

// ============ Hook ============

/**
 * Derives mode from params.
 */
function deriveMode(params?: CreateWalletParams): WalletCreationMode {
  if (params?.seedPhraseVaultId) {
    return 'importSeedPhrase';
  }
  if (params?.privateKeyVaultId) {
    return 'importPrivateKey';
  }
  return 'create';
}

/**
 * Hook that handles wallet creation for all three modes:
 * - Create new wallet (no params)
 * - Import from seed phrase
 * - Import from private key
 */
export function useSetupWallet(
  params?: CreateWalletParams,
): UseSetupWalletResult {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toggleBiometrics } = useBiometrics({ autoFetch: true });

  // Derive mode from params
  const mode = deriveMode(params);

  // Generate/derive address data based on mode (gateway logic in hook)
  const { value: walletData, loading: isLoading } =
    useAsync(async (): Promise<WalletCreationResult> => {
      if (mode === 'importSeedPhrase' && params?.seedPhraseVaultId) {
        const seedPhrase = SecretVault.retrieve(params.seedPhraseVaultId);
        if (!seedPhrase) {
          throw new Error(
            'Seed phrase vault expired or invalid. Please try importing again.',
          );
        }
        return importFromSeedPhrase(seedPhrase);
      }
      if (mode === 'importPrivateKey' && params?.privateKeyVaultId) {
        const privateKey = SecretVault.retrieve(params.privateKeyVaultId);
        if (!privateKey) {
          throw new Error(
            'Private key vault expired or invalid. Please try importing again.',
          );
        }
        return importFromPrivateKey(privateKey);
      }
      return createNewWallet();
    }, [mode, params?.seedPhraseVaultId, params?.privateKeyVaultId]);

  const handleSubmit = async (
    formValues: PasswordFormValues,
  ): Promise<void | 'fallback' | 'success'> => {
    if (!walletData) return;

    if (formValues.useAutoGeneratedPassword) {
      formValues.password = generateRandomPassword();
      formValues.confirmPassword = formValues.password;
      formValues.enableBiometrics = true;
    }

    setIsSubmitting(true);
    try {
      await submitWalletCreation(walletData, formValues, { toggleBiometrics });
    } catch (error) {
      toast.show(i18n.t('page.newUserOnboarding.createWalletError'));
      setIsSubmitting(false);
      return formValues.useAutoGeneratedPassword ? 'fallback' : undefined;
    }

    if (formValues.useAutoGeneratedPassword) {
      preferenceService.setPasswordIsAutoGenerated(true);
      return 'success';
    }
  };

  return {
    address: walletData?.address,
    isLoading,
    mode,
    isSubmitting,
    handleSubmit,
  };
}
