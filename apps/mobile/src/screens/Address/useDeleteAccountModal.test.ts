import { renderHook } from '@testing-library/react-native';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { WalletUnlockCancelledError } from '@/utils/walletUnlockError';
import { useDeleteAccountModal } from './useDeleteAccountModal';

const mockShow = jest.fn();
const mockRemoveAccount = jest.fn();
const mockRefreshBalance = jest.fn();
const mockRefreshAccountFlags = jest.fn();
const mockRedirect = jest.fn();

jest.mock('@/components/AuthenticationModal/AuthenticationModal', () => ({
  AuthenticationModal: { show: (...args: unknown[]) => mockShow(...args) },
}));
jest.mock('@/core/apis', () => ({ apisLock: {} }));
jest.mock('@/core/serviceApi/keyring', () => ({ keyringServiceApi: {} }));
jest.mock('@/hooks/account', () => ({
  storeApiAccounts: {
    removeAccount: (...args: unknown[]) => mockRemoveAccount(...args),
  },
}));
jest.mock('@/hooks/useEnterPassphraseModal', () => ({
  useEnterPassphraseModal: () => jest.fn(),
}));
jest.mock('@/store/homeBalanceRefresh', () => ({
  refreshHomeBalanceAfterAccountMutation: () => mockRefreshBalance(),
}));
jest.mock('@/utils/navigation', () => ({
  redirectToAddAddressEntry: (...args: unknown[]) => mockRedirect(...args),
}));
jest.mock('@/hooks/useLock', () => ({
  refreshAppLockAccountFlags: () => mockRefreshAccountFlags(),
}));
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('@/utils/walletUnlock', () => ({
  ...jest.requireActual('@/utils/walletUnlockError'),
  ensureWalletUnlockedForAction: jest.fn(async () => true),
}));
jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const account = {
  address: '0xabcd000000000000000000000000000000001234',
  type: KEYRING_TYPE.LedgerKeyring,
  brandName: KEYRING_TYPE.LedgerKeyring,
};

describe('delete account modal completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRemoveAccount.mockResolvedValue(undefined);
    mockRefreshBalance.mockResolvedValue(undefined);
    mockRefreshAccountFlags.mockResolvedValue({ accountState: 'empty' });
  });

  async function confirmDeletion() {
    const onFinished = jest.fn();
    const { result } = renderHook(() => useDeleteAccountModal());
    await result.current({ account, onFinished });
    const modal = mockShow.mock.calls[0][0];
    expect(modal.authType).toEqual(['none']);
    return { finish: () => modal.onFinished(), onFinished };
  }

  it('handles unlock cancellation without continuing deletion completion', async () => {
    mockRemoveAccount.mockRejectedValue(new WalletUnlockCancelledError());
    const { finish, onFinished } = await confirmDeletion();

    await expect(finish()).resolves.toBeUndefined();

    expect(mockRemoveAccount).toHaveBeenCalledWith(account);
    expect(mockRefreshBalance).not.toHaveBeenCalled();
    expect(mockRefreshAccountFlags).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('preserves actual deletion failures', async () => {
    const error = new Error('Account removal failed');
    mockRemoveAccount.mockRejectedValue(error);
    const { finish, onFinished } = await confirmDeletion();

    await expect(finish()).rejects.toBe(error);

    expect(mockRefreshBalance).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('refreshes and navigates after successful removal', async () => {
    const { finish, onFinished } = await confirmDeletion();

    await expect(finish()).resolves.toBeUndefined();

    expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
    expect(mockRefreshAccountFlags).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith({ action: 'resetTo' });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
