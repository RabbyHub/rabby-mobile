const mockGetItem = jest.fn();
const mockGetGasAccountSig = jest.fn();
const mockGetPendingHardwareAccount = jest.fn();
const mockGetPerpsCurrentAccount = jest.fn();

jest.mock('@/constant', () => ({
  APP_VERSIONS: {
    forFeedback: '1.0.0',
    fromNative: '1.0.0',
    buildNumber: '1',
  },
  APPLICATION_ID: 'com.rabby.test',
}));

jest.mock('@/constant/env', () => ({
  BUILD_GIT_INFO: {
    BUILD_GIT_HASH: 'test-hash',
  },
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getSystemName: jest.fn(() => 'Android'),
    getSystemVersion: jest.fn(() => '15'),
    getModel: jest.fn(() => 'Pixel'),
    getDeviceId: jest.fn(() => 'pixel'),
    getDeviceType: jest.fn(() => 'Handset'),
    getManufacturerSync: jest.fn(() => 'Google'),
    isLandscapeSync: jest.fn(() => false),
    isTablet: jest.fn(() => false),
    isLowRamDevice: jest.fn(() => false),
    isDisplayZoomed: jest.fn(() => false),
    isAirplaneModeSync: jest.fn(() => false),
    getAndroidId: jest.fn(() => Promise.resolve('android-id')),
    getApiLevelSync: jest.fn(() => 35),
    getUserAgentSync: jest.fn(() => 'test-agent'),
    getFontScaleSync: jest.fn(() => 1),
  },
}));

jest.mock('@/core/apis/address', () => ({
  getAllAccounts: jest.fn(async () => []),
}));

jest.mock('@/core/apis', () => ({
  apisPerps: {
    getPerpsCurrentAccount: (...args: unknown[]) =>
      mockGetPerpsCurrentAccount(...args),
  },
}));

jest.mock('@/core/services', () => ({
  preferenceService: {
    getFallbackAccount: jest.fn(() => null),
  },
  gasAccountService: {
    getGasAccountSig: (...args: unknown[]) => mockGetGasAccountSig(...args),
    getPendingHardwareAccount: (...args: unknown[]) =>
      mockGetPendingHardwareAccount(...args),
  },
}));

jest.mock('@/core/storage/mmkv', () => ({
  appJsonStore: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
  },
}));

jest.mock('@/core/storage/mmkvConstants', () => ({
  APP_MMKV_WEAK_KEYS: {
    SCENE_ACCOUNTS: '@SceneAccounts202512',
  },
}));

jest.mock('@/utils/navigation', () => ({
  getLatestNavigationName: jest.fn(() => 'GasAccount'),
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  KEYRING_TYPE: {
    WatchAddressKeyring: 'Watch Address',
    GnosisKeyring: 'Gnosis',
  },
}));

const loadUtils = () => {
  jest.resetModules();
  (global as any).ErrorUtils = {
    setGlobalHandler: jest.fn(),
  };

  return require('./utils') as typeof import('./utils');
};

describe('Screenshot feedback utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGasAccountSig.mockReturnValue({});
    mockGetPendingHardwareAccount.mockReturnValue(undefined);
    mockGetPerpsCurrentAccount.mockResolvedValue(null);
    mockGetItem.mockReturnValue({
      state: {
        GasAccount: {
          currentAccount: {
            address: '0xstalegasaccount',
            type: 'HD Key Tree',
            brandName: 'Rabby',
          },
        },
        Receive: {
          currentAccount: {
            address: '0xreceive',
            type: 'HD Key Tree',
            brandName: 'Rabby',
          },
        },
      },
    });
  });

  it('reports the active GasAccount session address instead of a stale scene address', async () => {
    mockGetGasAccountSig.mockReturnValue({
      sig: 'sig',
      accountId: '0xactivegasaccount',
    });

    const { getSceneAddresses } = loadUtils();

    await expect(getSceneAddresses()).resolves.toMatchObject({
      GasAccount: '0xactivegasaccount',
      Receive: '0xreceive',
    });
  });

  it('reports a pending hardware GasAccount address when there is no active session', async () => {
    mockGetPendingHardwareAccount.mockReturnValue({
      address: '0xpendinghardware',
      type: 'Ledger Hardware',
      brandName: 'Ledger',
    });

    const { getSceneAddresses } = loadUtils();

    await expect(getSceneAddresses()).resolves.toMatchObject({
      GasAccount: '0xpendinghardware',
    });
  });
});
