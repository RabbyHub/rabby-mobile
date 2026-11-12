import {
  completeWalletCreation,
  type WalletCreationResult,
} from './useSetupWallet';

// Unit coverage for the onboarding consent mapping only: the preference
// write is observed at its service API boundary and wallet submission is
// stopped at the first lock call. Persistence, analytics SDK sync and the
// rest of wallet creation are not exercised here.
const mockSetUserBehaviorTrackingOptOut = jest.fn();
const mockResetPasswordOnUI = jest.fn();

jest.mock('@rabby-wallet/eth-hd-keyring', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@/core/apis', () => ({
  apiMnemonic: {},
  apisLock: {
    resetPasswordOnUI: (...args: unknown[]) => mockResetPasswordOnUI(...args),
  },
}));
jest.mock('@/core/apis/keychain', () => ({ KEYCHAIN_AUTH_TYPES: {} }));
jest.mock('@/core/apis/lock', () => ({}));
jest.mock('@/core/apis/mnemonic', () => ({}));
jest.mock('@/core/apis/account', () => ({ accountEvents: {} }));
jest.mock('@/core/apis/keyring', () => ({}));
jest.mock('@/core/apis/privateKey', () => ({}));
jest.mock('@/core/serviceApi/keyring', () => ({ keyringServiceApi: {} }));
jest.mock('@/core/serviceApi/preference', () => ({
  setUserBehaviorTrackingOptOut: (value: boolean) =>
    mockSetUserBehaviorTrackingOptOut(value),
}));
jest.mock('@/core/utils/authReadinessDiagnostics', () => ({}));
jest.mock('@/screens/Home/hooks/singleHome', () => ({ apisSingleHome: {} }));
jest.mock('@/hooks/navigation', () => ({ apisHomeTabIndex: {} }));
jest.mock('@/hooks/useLock', () => ({}));
jest.mock('@/hooks/biometrics', () => ({ useBiometrics: jest.fn() }));
jest.mock('@/components2024/Toast', () => ({ toast: {} }));
jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const SUBMISSION_STOPPED = 'stopped after the consent write';
const walletData: WalletCreationResult = {
  seedPhrase: 'public fixture seed phrase',
  address: '0x0000000000000000000000000000000000000001',
  addressIndex: 0,
  mode: 'create',
};

describe('wallet setup data analysis consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetUserBehaviorTrackingOptOut.mockResolvedValue(undefined);
    mockResetPasswordOnUI.mockResolvedValue({ error: SUBMISSION_STOPPED });
  });

  it.each([
    { enableDataAnalysis: true, optOut: false },
    { enableDataAnalysis: false, optOut: true },
  ])(
    'persists opt-out=$optOut before creating the wallet when the toggle is $enableDataAnalysis',
    async ({ enableDataAnalysis, optOut }) => {
      mockResetPasswordOnUI.mockImplementation(async () => {
        expect(mockSetUserBehaviorTrackingOptOut).toHaveBeenCalledTimes(1);
        return { error: SUBMISSION_STOPPED };
      });

      await expect(
        completeWalletCreation(walletData, {
          password: 'correct-horse-battery',
          confirmPassword: 'correct-horse-battery',
          enableBiometrics: false,
          enableDataAnalysis,
        }),
      ).rejects.toThrow(SUBMISSION_STOPPED);

      expect(mockSetUserBehaviorTrackingOptOut).toHaveBeenCalledTimes(1);
      expect(mockSetUserBehaviorTrackingOptOut).toHaveBeenCalledWith(optOut);
      expect(mockResetPasswordOnUI).toHaveBeenCalledTimes(1);
    },
  );
});
