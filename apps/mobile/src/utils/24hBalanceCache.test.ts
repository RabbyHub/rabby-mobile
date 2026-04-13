const mockStore = new Map<string, string>();

const mockMMKVInstance = {
  getString: jest.fn((key: string) => mockStore.get(key)),
  set: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
  }),
  delete: jest.fn((key: string) => {
    mockStore.delete(key);
  }),
  getAllKeys: jest.fn(() => Array.from(mockStore.keys())),
};

const mockGet24hTotalBalance = jest.fn();
const mockComputeBalanceChange = jest.fn();

describe('utils/24hBalanceCache', () => {
  const now = 1_700_000_000_000;

  let balance24hModule: typeof import('./24hBalanceCache');

  beforeEach(() => {
    jest.resetModules();
    mockStore.clear();
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    jest.doMock('react-native-mmkv', () => ({
      MMKV: jest.fn(() => mockMMKVInstance),
    }));
    jest.doMock('@/core/utils/appFS', () => ({
      MMKV_FILE_NAMES: {
        BALANCE_24H: 'balance-24h',
      },
    }));
    jest.doMock('@/core/request', () => ({
      openapi: {
        get24hTotalBalance: mockGet24hTotalBalance,
      },
    }));
    jest.doMock('@/core/apis/balance', () => ({
      computeBalanceChange: mockComputeBalanceChange,
    }));

    balance24hModule = require('./24hBalanceCache');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores and reads cache entries using lowercase addresses', () => {
    balance24hModule.setBalance24hCache('0xABCD', {
      data: { total_usd_value: 12 },
      updateTime: now,
    });

    expect(balance24hModule.getBalance24hCache('0xabcd')).toEqual({
      data: { total_usd_value: 12 },
      updateTime: now,
      isExpired: false,
    });

    expect(mockMMKVInstance.set).toHaveBeenCalledWith(
      '0xabcd',
      JSON.stringify({
        data: { total_usd_value: 12 },
        updateTime: now,
      }),
    );
  });

  it('reuses fresh cache entries unless force is set', async () => {
    balance24hModule.setBalance24hCache('0xABCD', {
      data: { total_usd_value: 20 },
      updateTime: now - balance24hModule.CURE_CACHE_TIME + 1,
    });

    const result = await balance24hModule.get24hBalance('0xABCD');

    expect(result).toEqual({
      data: { total_usd_value: 20 },
      updateTime: now - balance24hModule.CURE_CACHE_TIME + 1,
      isExpired: false,
    });
    expect(mockGet24hTotalBalance).not.toHaveBeenCalled();
  });

  it('refreshes stale cache entries through openapi and overwrites storage', async () => {
    balance24hModule.setBalance24hCache('0xABCD', {
      data: { total_usd_value: 20 },
      updateTime: now - balance24hModule.CURE_CACHE_TIME - 1,
    });
    mockGet24hTotalBalance.mockResolvedValue({
      total_usd_value: 88,
    });

    const result = await balance24hModule.get24hBalance('0xABCD');

    expect(mockGet24hTotalBalance).toHaveBeenCalledWith('0xabcd');
    expect(result).toEqual({
      data: { total_usd_value: 88 },
      updateTime: now,
      isExpired: false,
    });
    expect(balance24hModule.getBalance24hCache('0xabcd')).toEqual({
      data: { total_usd_value: 88 },
      updateTime: now,
      isExpired: false,
    });
  });

  it('forces refresh even when cache is still fresh', async () => {
    balance24hModule.setBalance24hCache('0xABCD', {
      data: { total_usd_value: 20 },
      updateTime: now,
    });
    mockGet24hTotalBalance.mockResolvedValue({
      total_usd_value: 99,
    });

    const result = await balance24hModule.get24hBalance('0xABCD', true);

    expect(mockGet24hTotalBalance).toHaveBeenCalledWith('0xabcd');
    expect(result.data.total_usd_value).toBe(99);
  });

  it('deletes only long-expired cache entries', () => {
    balance24hModule.setBalance24hCache('0xOLD', {
      data: { total_usd_value: 1 },
      updateTime: now - balance24hModule.LONG_TIME_UNTIL_EXPIRED - 1,
    });
    balance24hModule.setBalance24hCache('0xFRESH', {
      data: { total_usd_value: 2 },
      updateTime: now - balance24hModule.LONG_TIME_UNTIL_EXPIRED + 1,
    });

    balance24hModule.deleteLongTime24hBalanceCache();

    expect(balance24hModule.getBalance24hCache('0xold')).toBeNull();
    expect(balance24hModule.getBalance24hCache('0xfresh')).toEqual({
      data: { total_usd_value: 2 },
      updateTime: now - balance24hModule.LONG_TIME_UNTIL_EXPIRED + 1,
      isExpired: true,
    });
  });

  it('swallows storage iteration errors during long-expired cleanup', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockMMKVInstance.getAllKeys.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() =>
      balance24hModule.deleteLongTime24hBalanceCache(),
    ).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'deleteLongTimeCurveCache',
      expect.any(Error),
    );
  });

  it('deletes cache entries by lowercased address', () => {
    balance24hModule.setBalance24hCache('0xABCD', {
      data: { total_usd_value: 12 },
      updateTime: now,
    });

    balance24hModule.delete24hBalanceCache('0xABCD');

    expect(balance24hModule.getBalance24hCache('0xabcd')).toBeNull();
  });

  it('uses realtime value only when realtime timestamp exists', () => {
    mockComputeBalanceChange.mockReturnValue({
      assetsChange: -3,
      changePercent: '3.00%',
    });

    const resultWithoutRealtime = balance24hModule.getChangeData(
      { total_usd_value: 50 },
      200,
      undefined,
    );

    expect(mockComputeBalanceChange).toHaveBeenNthCalledWith(1, 0, 50);
    expect(resultWithoutRealtime).toEqual({
      changePercent: '3.00%',
      isLoss: true,
    });

    mockComputeBalanceChange.mockReturnValueOnce({
      assetsChange: 10,
      changePercent: '20.00%',
    });

    const resultWithRealtime = balance24hModule.getChangeData(
      { total_usd_value: 50 },
      60,
      now,
    );

    expect(mockComputeBalanceChange).toHaveBeenNthCalledWith(2, 60, 50);
    expect(resultWithRealtime).toEqual({
      changePercent: '20.00%',
      isLoss: false,
    });
  });
});
