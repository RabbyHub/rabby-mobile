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
const mockGetNetCurve = jest.fn();

function loadCurveCacheModule() {
  jest.resetModules();

  jest.doMock('react-native-mmkv', () => ({
    MMKV: jest.fn(() => mockMMKVInstance),
  }));

  jest.doMock('@/core/utils/appFS', () => ({
    MMKV_FILE_NAMES: {
      DAYCURVE: 'DAYCURVE',
    },
  }));

  jest.doMock('@/core/request', () => ({
    openapi: {
      getNetCurve: (...args: unknown[]) => mockGetNetCurve(...args),
    },
  }));

  return require('./24balanceCurveCache') as typeof import('./24balanceCurveCache');
}

describe('24balanceCurveCache utils', () => {
  const now = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.clear();
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores and reads cache entries by lowercased address', () => {
    const curveModule = loadCurveCacheModule();

    curveModule.setCurveCache('0xABCD', {
      data: [{ timestamp: 1, usd_value: 2 }],
      updateTime: now,
    });

    expect(curveModule.getCurveCache('0xabcd')).toEqual({
      data: [{ timestamp: 1, usd_value: 2 }],
      updateTime: now,
      isExpired: false,
    });
  });

  it('reuses a fresh day-curve cache and refreshes stale cache', async () => {
    const curveModule = loadCurveCacheModule();
    curveModule.setCurveCache('0xABCD', {
      data: [{ timestamp: 1, usd_value: 2 }],
      updateTime: now - curveModule.CURE_CACHE_TIME + 1,
    });

    await expect(curveModule.getNetCurve('0xABCD', 1)).resolves.toEqual([
      { timestamp: 1, usd_value: 2 },
    ]);
    expect(mockGetNetCurve).not.toHaveBeenCalled();

    curveModule.setCurveCache('0xABCD', {
      data: [{ timestamp: 1, usd_value: 2 }],
      updateTime: now - curveModule.CURE_CACHE_TIME - 1,
    });
    mockGetNetCurve.mockResolvedValueOnce([{ timestamp: 2, usd_value: 3 }]);

    await expect(curveModule.getNetCurve('0xABCD', 1)).resolves.toEqual([
      { timestamp: 2, usd_value: 3 },
    ]);
    expect(mockGetNetCurve).toHaveBeenCalledWith('0xabcd', 1);
  });

  it('bypasses fresh cache when forced and delegates non-day queries directly', async () => {
    const curveModule = loadCurveCacheModule();
    curveModule.setCurveCache('0xABCD', {
      data: [{ timestamp: 1, usd_value: 2 }],
      updateTime: now,
    });
    mockGetNetCurve.mockResolvedValueOnce([{ timestamp: 2, usd_value: 3 }]);
    mockGetNetCurve.mockResolvedValueOnce([{ timestamp: 3, usd_value: 4 }]);

    await expect(curveModule.getNetCurve('0xABCD', 1, true)).resolves.toEqual([
      { timestamp: 2, usd_value: 3 },
    ]);
    await expect(curveModule.getNetCurve('0xABCD', 7)).resolves.toEqual([
      { timestamp: 3, usd_value: 4 },
    ]);

    expect(mockGetNetCurve).toHaveBeenNthCalledWith(1, '0xabcd', 1);
    expect(mockGetNetCurve).toHaveBeenNthCalledWith(2, '0xABCD', 7);
  });

  it('deletes only long-expired cache entries and swallows storage iteration errors', () => {
    const curveModule = loadCurveCacheModule();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    curveModule.setCurveCache('0xOLD', {
      data: [{ timestamp: 1, usd_value: 1 }],
      updateTime: now - curveModule.LONG_TIME_UNTIL_EXPIRED - 1,
    });
    curveModule.setCurveCache('0xFRESH', {
      data: [{ timestamp: 2, usd_value: 2 }],
      updateTime: now - curveModule.LONG_TIME_UNTIL_EXPIRED + 1,
    });

    curveModule.deleteLongTimeCurveCache();

    expect(curveModule.getCurveCache('0xold')).toBeNull();
    expect(curveModule.getCurveCache('0xfresh')).toEqual({
      data: [{ timestamp: 2, usd_value: 2 }],
      updateTime: now - curveModule.LONG_TIME_UNTIL_EXPIRED + 1,
      isExpired: true,
    });

    mockMMKVInstance.getAllKeys.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    curveModule.deleteLongTimeCurveCache();

    expect(errorSpy).toHaveBeenCalledWith(
      'deleteLongTimeCurveCache',
      expect.any(Error),
    );
  });
});
