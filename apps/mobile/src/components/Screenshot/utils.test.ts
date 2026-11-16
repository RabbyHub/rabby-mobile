const mockGetItem = jest.fn();
const mockGetGasAccountSig = jest.fn();
const mockGetPendingHardwareAccount = jest.fn();
const mockGetPerpsCurrentAccount = jest.fn();
const mockGetAllAccounts = jest.fn();
const mockGetFallbackAccountSnapshot = jest.fn();

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
  getAllAccounts: (...args: unknown[]) => mockGetAllAccounts(...args),
}));

jest.mock('@/core/apis', () => ({
  apisPerps: {
    getPerpsCurrentAccount: (...args: unknown[]) =>
      mockGetPerpsCurrentAccount(...args),
  },
}));

jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: (...args: unknown[]) =>
    mockGetFallbackAccountSnapshot(...args),
}));

jest.mock('@/core/serviceApi/gasAccount', () => ({
  gasAccountServiceApi: {
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
    mockGetAllAccounts.mockResolvedValue([]);
    mockGetFallbackAccountSnapshot.mockReturnValue(null);
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

  describe('address opt-in', () => {
    const FIRST_ADDRESS = '0x' + 'a'.repeat(40);
    const CURRENT_ADDRESS = '0x' + 'b'.repeat(40);
    const WATCH_ADDRESS = '0x' + 'c'.repeat(40);
    const TX_HASH = '0x' + 'd'.repeat(64);

    const recordGlobalError = (error: unknown) => {
      const handler = jest.mocked((global as any).ErrorUtils.setGlobalHandler)
        .mock.calls[0][0];
      handler(error, false);
    };

    beforeEach(() => {
      mockGetAllAccounts.mockResolvedValue([
        { address: WATCH_ADDRESS, type: 'Watch Address', brandName: 'Watch' },
        { address: FIRST_ADDRESS, type: 'HD Key Tree', brandName: 'Rabby' },
      ]);
      mockGetFallbackAccountSnapshot.mockReturnValue({
        address: CURRENT_ADDRESS,
        type: 'Simple Key Pair',
        brandName: 'Rabby',
      });
    });

    it('leaves addresses and their types out unless the user opts in', async () => {
      const { getScreenshotFeedbackExtra } = loadUtils();
      recordGlobalError({
        message: `send failed from ${FIRST_ADDRESS} in ${TX_HASH} on 0x38`,
      });

      const extra = await getScreenshotFeedbackExtra();

      expect(extra).not.toHaveProperty('myFirstAddress');
      expect(extra).not.toHaveProperty('myCurrentAddress');
      expect(extra).not.toHaveProperty('mySceneAddresses');
      expect(extra).not.toHaveProperty('myFirstAddressType');
      expect(extra).not.toHaveProperty('myCurrentAddressType');
      expect(extra).not.toHaveProperty('totalBalanceText');
      expect(extra).not.toHaveProperty('myCallableAddressCount');
      expect(extra).not.toHaveProperty('myUncallableAddressCount');
      const serializedText = JSON.stringify(extra);
      for (const accountType of ['HD Key Tree', 'Simple Key Pair']) {
        expect(serializedText).not.toContain(accountType);
      }
      expect(mockGetItem).not.toHaveBeenCalled();
      expect(mockGetPerpsCurrentAccount).not.toHaveBeenCalled();
      expect(mockGetAllAccounts).not.toHaveBeenCalled();
      expect(mockGetFallbackAccountSnapshot).not.toHaveBeenCalled();

      const serialized = JSON.stringify(extra).toLowerCase();
      for (const address of [FIRST_ADDRESS, CURRENT_ADDRESS, WATCH_ADDRESS]) {
        expect(serialized).not.toContain(address.slice(2));
      }
      expect(extra.latestErrors).toContain('send failed from 0x*** in 0x***');
      expect(extra.latestErrors).toContain('on 0x38');
    });

    it('does not treat a non-boolean value as consent', async () => {
      const { getScreenshotFeedbackExtra } = loadUtils();

      const extra = await getScreenshotFeedbackExtra({
        includeAddress: 'true' as unknown as boolean,
      });

      expect(extra).not.toHaveProperty('myCurrentAddress');
      expect(extra).not.toHaveProperty('myCurrentAddressType');
    });

    it('attaches addresses, their types and raw errors after the user opts in', async () => {
      const { getScreenshotFeedbackExtra } = loadUtils();
      recordGlobalError({ message: `send failed from ${FIRST_ADDRESS}` });

      const extra = await getScreenshotFeedbackExtra({
        includeAddress: true,
      });

      expect(extra).toMatchObject({
        myFirstAddress: FIRST_ADDRESS,
        myFirstAddressType: 'HD Key Tree',
        myCurrentAddress: CURRENT_ADDRESS,
        myCurrentAddressType: 'Simple Key Pair',
        mySceneAddresses: expect.objectContaining({ Receive: '0xreceive' }),
      });
      expect(extra).not.toHaveProperty('totalBalanceText');
      expect(extra).not.toHaveProperty('myCallableAddressCount');
      expect(extra).not.toHaveProperty('myUncallableAddressCount');
      expect(extra.latestErrors).toContain(FIRST_ADDRESS);
    });
  });

  describe('maskScreenshotFeedbackAddresses', () => {
    it('masks addresses and tx hashes but keeps short hex values', () => {
      const { maskScreenshotFeedbackAddresses } = loadUtils();
      const address = '0x' + 'AbCdEf0123'.repeat(4);
      const txHash = '0x' + 'f'.repeat(64);

      expect(
        maskScreenshotFeedbackAddresses(
          `to=${address}&hash=${txHash}&chainId=0x38&value=0x0`,
        ),
      ).toBe('to=0x***&hash=0x***&chainId=0x38&value=0x0');
      expect(maskScreenshotFeedbackAddresses(null)).toBeNull();
    });
  });
});
