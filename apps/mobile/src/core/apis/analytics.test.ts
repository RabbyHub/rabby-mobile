function loadAnalyticsModule() {
  jest.resetModules();

  const mockGetAddressValueMap = jest.fn();
  const mockGetAllVisibleAccountsArray = jest.fn();
  const mockGetSendLogTime = jest.fn();
  const mockMatomoRequestEvent = jest.fn();
  const mockUpdateSendLogTime = jest.fn();

  jest.doMock('@/utils/analytics', () => ({
    matomoRequestEvent: (...args: unknown[]) => mockMatomoRequestEvent(...args),
  }));
  jest.doMock('@/store/balance', () => ({
    __esModule: true,
    default: {
      getAddressValueMap: (...args: unknown[]) =>
        mockGetAddressValueMap(...args),
    },
  }));
  jest.doMock('@rabby-wallet/keyring-utils', () => ({
    KEYRING_CATEGORY_MAP: {
      SimpleKeyring: 'private-key',
      WatchAddressKeyring: 'watch',
    },
  }));
  jest.doMock('../services/shared', () => ({
    keyringService: {
      getAllVisibleAccountsArray: (...args: unknown[]) =>
        mockGetAllVisibleAccountsArray(...args),
    },
    preferenceService: {
      getSendLogTime: (...args: unknown[]) => mockGetSendLogTime(...args),
      updateSendLogTime: (...args: unknown[]) => mockUpdateSendLogTime(...args),
    },
  }));

  const analyticsModule =
    require('./analytics') as typeof import('./analytics');

  return {
    ...analyticsModule,
    mocks: {
      mockGetAddressValueMap,
      mockGetAllVisibleAccountsArray,
      mockGetSendLogTime,
      mockMatomoRequestEvent,
      mockUpdateSendLogTime,
    },
  };
}

describe('core/apis/analytics', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it('skips user-address analytics when the send log time is already today', async () => {
    const now = new Date('2026-05-31T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);
    const { sendUserAddressEvent, mocks } = loadAnalyticsModule();
    mocks.mockGetSendLogTime.mockReturnValue(
      new Date('2026-05-31T01:00:00Z').getTime(),
    );

    await sendUserAddressEvent();

    expect(mocks.mockGetAllVisibleAccountsArray).not.toHaveBeenCalled();
    expect(mocks.mockMatomoRequestEvent).not.toHaveBeenCalled();
    expect(mocks.mockUpdateSendLogTime).not.toHaveBeenCalled();
  });

  it('groups visible accounts by keyring category, brand, and empty-balance state', async () => {
    const now = new Date('2026-05-31T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);
    const { sendUserAddressEvent, mocks } = loadAnalyticsModule();
    mocks.mockGetSendLogTime.mockReturnValue(
      new Date('2026-05-30T12:00:00Z').getTime(),
    );
    mocks.mockGetAddressValueMap.mockReturnValue({
      '0xaaa': {
        totalBalance: 10,
      },
      '0xbbb': {
        totalBalance: 20,
      },
    });
    mocks.mockGetAllVisibleAccountsArray.mockResolvedValue([
      {
        address: '0xAAA',
        brandName: 'Rabby',
        type: 'SimpleKeyring',
      },
      {
        address: '0xBBB',
        brandName: 'Rabby',
        type: 'SimpleKeyring',
      },
      {
        address: '0xCCC',
        brandName: 'Watch',
        type: 'WatchAddressKeyring',
      },
    ]);

    await sendUserAddressEvent();

    expect(mocks.mockMatomoRequestEvent).toHaveBeenCalledWith({
      action: 'private-key',
      category: 'UserAddress',
      label: 'Rabby|notEmpty|2',
      value: 2,
    });
    expect(mocks.mockMatomoRequestEvent).toHaveBeenCalledWith({
      action: 'watch',
      category: 'UserAddress',
      label: 'Watch|empty|1',
      value: 1,
    });
    expect(mocks.mockUpdateSendLogTime).toHaveBeenCalledWith(now.getTime());
  });
});
