import { renderHook, waitFor } from '@testing-library/react-native';
import SimpleKeyring from '@rabby-wallet/eth-simple-keyring';

import * as SecretVault from '@/core/utils/secretVault';
import { prepareWalletCreation, useSetupWallet } from './useSetupWallet';

const PRIVATE_KEY = `${'0'.repeat(63)}1`;
const ADDRESS = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
const mockGetKeyringClassForType = jest.fn();

// Hook unit coverage: private-key preparation, validator, SDK, SecretVault
// and useAsync remain real. Service lookup and unrelated wallet APIs are
// controlled boundaries; this does not prove native navigation/persistence.
jest.mock('@rabby-wallet/eth-hd-keyring', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@/core/apis', () => ({ apiMnemonic: {}, apisLock: {} }));
jest.mock('@/core/apis/keychain', () => ({ KEYCHAIN_AUTH_TYPES: {} }));
jest.mock('@/core/apis/lock', () => ({}));
jest.mock('@/core/apis/mnemonic', () => ({}));
jest.mock('@/core/apis/account', () => ({ accountEvents: {} }));
jest.mock('@/core/apis/keyring', () => ({}));
jest.mock('@/core/serviceApi/keyring', () => ({
  keyringServiceApi: {
    getKeyringClassForType: () => mockGetKeyringClassForType(),
  },
}));
jest.mock('@/core/serviceApi/preference', () => ({}));
jest.mock('@/core/utils/authReadinessDiagnostics', () => ({}));
jest.mock('@/screens/Home/hooks/singleHome', () => ({ apisSingleHome: {} }));
jest.mock('@/hooks/navigation', () => ({ apisHomeTabIndex: {} }));
jest.mock('@/hooks/useLock', () => ({}));
jest.mock('@/hooks/biometrics', () => ({
  useBiometrics: () => ({ toggleBiometrics: jest.fn() }),
}));
jest.mock('@/components2024/Toast', () => ({ toast: { show: jest.fn() } }));
jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock('i18next', () => ({ t: (key: string) => key }));
jest.mock('@/utils/walletUnlockGuard', () => ({
  withWalletUnlock: (operation: unknown) => operation,
}));

describe('wallet setup private-key preparation', () => {
  beforeEach(() => {
    mockGetKeyringClassForType.mockReset();
    mockGetKeyringClassForType.mockResolvedValue(SimpleKeyring);
  });

  afterEach(() => {
    SecretVault.clearAll();
  });

  it.each([PRIVATE_KEY, `0x${PRIVATE_KEY}`])(
    'derives the public scalar fixture address with the real SDK',
    async secret => {
      const prepared = await prepareWalletCreation({
        mode: 'importPrivateKey',
        secret,
      });

      expect(prepared).toEqual({
        privateKey: PRIVATE_KEY,
        address: ADDRESS,
        addressIndex: 0,
        mode: 'importPrivateKey',
        accountsToCreate: [{ address: ADDRESS, index: 0 }],
      });
    },
  );

  it.each(['G', '0', ' G', '\nG'])(
    'rejects the invalid suffix %j before entering the SDK',
    async suffix => {
      await expect(
        prepareWalletCreation({
          mode: 'importPrivateKey',
          secret: `${PRIVATE_KEY}${suffix}`,
        }),
      ).rejects.toThrow('background.error.invalidPrivateKey');

      expect(mockGetKeyringClassForType).not.toHaveBeenCalled();
    },
  );

  it('awaits a decoder rejection before requesting any address', async () => {
    let rejectDecode!: (error: Error) => void;
    let started!: () => void;
    const decodeStarted = new Promise<void>(resolve => {
      started = resolve;
    });
    const decoding = new Promise<void>((_resolve, reject) => {
      rejectDecode = reject;
    });
    const getAccounts = jest.fn();
    class RejectingKeyring extends SimpleKeyring {
      deserialize(keys: string[] = []) {
        if (!keys.length) return super.deserialize(keys);
        started();
        return decoding;
      }

      getAccounts() {
        return getAccounts();
      }
    }
    mockGetKeyringClassForType.mockResolvedValue(RejectingKeyring);
    const preparing = prepareWalletCreation({
      mode: 'importPrivateKey',
      secret: PRIVATE_KEY,
    });
    await decodeStarted;
    expect(getAccounts).not.toHaveBeenCalled();

    const failure = new Error('decoder rejected public fixture');
    const expectedRejection = expect(preparing).rejects.toBe(failure);
    rejectDecode(failure);
    await expectedRejection;
    expect(getAccounts).not.toHaveBeenCalled();
  });

  it('does not return an address when private-key preparation fails', async () => {
    class RejectingKeyring extends SimpleKeyring {
      deserialize(keys: string[] = []) {
        if (!keys.length) return super.deserialize(keys);
        return Promise.reject(new Error('decoder rejected public fixture'));
      }
    }
    mockGetKeyringClassForType.mockResolvedValue(RejectingKeyring);
    const privateKeyVaultId = SecretVault.store(PRIVATE_KEY);
    const { result } = renderHook(() => useSetupWallet({ privateKeyVaultId }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mode).toBe('importPrivateKey');
    expect(result.current.address).toBeUndefined();
  });
});
