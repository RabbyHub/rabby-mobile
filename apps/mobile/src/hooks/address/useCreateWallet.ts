import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { apiMnemonic, apisLock } from '@/core/apis';
import { addKeyringAndactiveAndPersistAccounts } from '@/core/apis/mnemonic';
import { keyringService, preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useCreateAddressProc } from '@/hooks/address/useNewUser';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { useBiometrics } from '@/hooks/biometrics';
import { toast } from '@/components2024/Toast';
import { PasswordFormValues } from '@/components2024/PasswordForm';

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
  | { seedPhrase: string; privateKey?: never }
  | { privateKey: string; seedPhrase?: never }
  | undefined;

export type UseCreateWalletResult = {
  /** Derived/generated address to display */
  address: string | undefined;
  /** Whether data is being loaded/generated */
  isLoading: boolean;
  /** Current mode based on params */
  mode: WalletCreationMode;
  /** Whether form submission is in progress */
  isSubmitting: boolean;
  /** Handler for password form submission */
  handleSubmit: (formValues: PasswordFormValues) => Promise<void>;
};

// ============ Data Generation Functions ============

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
 * TODO: Implement address derivation from seed phrase.
 */
async function importFromSeedPhrase(
  seedPhrase: string,
): Promise<WalletCreationResult> {
  // TODO: Derive address from seed phrase
  return {
    seedPhrase,
    address: '', // TODO: derive from seed phrase
    addressIndex: 0,
    mode: 'importSeedPhrase',
    accountsToCreate: undefined, // TODO: derive from seed phrase
  };
}

/**
 * Imports wallet from private key.
 * TODO: Implement address derivation from private key.
 */
async function importFromPrivateKey(
  privateKey: string,
): Promise<WalletCreationResult> {
  // TODO: Derive address from private key
  return {
    privateKey,
    address: '', // TODO: derive from private key
    addressIndex: 0,
    mode: 'importPrivateKey',
    accountsToCreate: undefined, // TODO: create from private key
  };
}

// ============ Submit Function ============

/**
 * Submits the wallet creation form and completes wallet setup.
 */
async function submitWalletCreation(
  walletData: WalletCreationResult,
  formValues: PasswordFormValues,
  callbacks: {
    storePassword: (params: {
      password: string;
      confirmPassword: string;
      enableBiometrics: boolean;
    }) => void;
    storeAddressList: (
      accounts: Array<{ address: string; aliasName: string; index?: number }>,
    ) => void;
    storeSeedPhrase: (seedPhrase: string) => void;
    resetCreateAddressProc: () => void;
    toggleBiometrics?: <T extends boolean>(
      nextEnabled: T,
      input: { tipLoading?: boolean } & (T extends true
        ? { validatedPassword: string }
        : { validatedPassword?: undefined }),
    ) => Promise<void>;
  },
): Promise<void> {
  const {
    mode,
    address,
    addressIndex,
    seedPhrase,
    privateKey,
    accountsToCreate,
  } = walletData;
  const {
    storePassword,
    storeAddressList,
    storeSeedPhrase,
    resetCreateAddressProc,
    toggleBiometrics,
  } = callbacks;

  // Validate required data based on mode
  if (!address) return;
  if (mode === 'create' && !seedPhrase) return;
  if (mode === 'importSeedPhrase' && !seedPhrase) return;
  if (mode === 'importPrivateKey' && !privateKey) return;

  // Store password
  storePassword({
    password: formValues.password,
    confirmPassword: formValues.confirmPassword,
    enableBiometrics: formValues.enableBiometrics,
  });

  // Store address list
  storeAddressList([
    {
      address,
      aliasName: '',
      index: addressIndex,
    },
  ]);

  // Store seed phrase (for create and seed phrase import modes)
  if (mode === 'create' || mode === 'importSeedPhrase') {
    storeSeedPhrase(seedPhrase!);
  }

  // Update password
  const result = await apisLock.resetPasswordOnUI(formValues.password);
  if (result.error) {
    throw new Error(result.error);
  }

  // Enable biometrics if selected
  if (toggleBiometrics && formValues.enableBiometrics) {
    try {
      await toggleBiometrics(true, {
        validatedPassword: formValues.password,
      });
    } catch (e) {
      console.log('toggleBiometrics error', e);
      // Non-fatal error, continue
    }
  }

  // Handle keyring creation based on mode
  if (mode === 'importPrivateKey') {
    // TODO: Implement private key import logic
    throw new Error('Private key import not yet implemented');
  }

  // For both 'create' and 'importSeedPhrase' modes
  await addKeyringAndactiveAndPersistAccounts(
    seedPhrase!,
    '',
    accountsToCreate || [],
    true,
  );

  // Clean up temporary pre-mnemonic data
  keyringService.removePreMnemonics();

  // Report action
  preferenceService.setReportActionTs(
    REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE,
  );

  // Reset the temporary process state
  resetCreateAddressProc();

  // Navigate directly to Home
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

// ============ Hook ============

/**
 * Derives mode from params.
 */
function deriveMode(params?: CreateWalletParams): WalletCreationMode {
  if (params?.seedPhrase) {
    return 'importSeedPhrase';
  }
  if (params?.privateKey) {
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
export function useCreateWallet(
  params?: CreateWalletParams,
): UseCreateWalletResult {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    storeSeedPharse,
    storeAddressList,
    storePassword,
    resetCreateAddressProc,
  } = useCreateAddressProc();
  const { toggleBiometrics } = useBiometrics({ autoFetch: true });

  // Derive mode from params
  const mode = deriveMode(params);

  // Generate/derive address data based on mode (gateway logic in hook)
  const { value: walletData, loading: isLoading } =
    useAsync(async (): Promise<WalletCreationResult> => {
      if (mode === 'importSeedPhrase' && params?.seedPhrase) {
        return importFromSeedPhrase(params.seedPhrase);
      }
      if (mode === 'importPrivateKey' && params?.privateKey) {
        return importFromPrivateKey(params.privateKey);
      }
      return createNewWallet();
    }, [mode, params?.seedPhrase, params?.privateKey]);

  const handleSubmit = async (formValues: PasswordFormValues) => {
    if (!walletData) return;

    setIsSubmitting(true);

    try {
      await submitWalletCreation(walletData, formValues, {
        storePassword,
        storeAddressList,
        storeSeedPhrase: storeSeedPharse,
        resetCreateAddressProc,
        toggleBiometrics,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create wallet';
      toast.show(message);
    } finally {
      setIsSubmitting(false);
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
