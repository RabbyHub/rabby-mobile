const mockFetchActiveAssetDataWithCache = jest.fn();
const mockReadActiveAssetDataFromCache = jest.fn();

jest.mock('@/constant/perps', () => ({
  DELETE_AGENT_EMPTY_ADDRESS: '0x0000000000000000000000000000000000000000',
}));

jest.mock('@/hooks/perps/useActiveAssetDataCache', () => ({
  fetchActiveAssetDataWithCache: (...args: unknown[]) =>
    mockFetchActiveAssetDataWithCache(...args),
  readActiveAssetDataFromCache: (...args: unknown[]) =>
    mockReadActiveAssetDataFromCache(...args),
}));

import {
  prefetchPerpsProLeverageSources,
  prefetchPerpsProZeroAddressLeverageBaseline,
  preparePerpsProLeverageSources,
  preparePerpsProZeroAddressLeverageBaseline,
  readPerpsProAccountLeverageConfiguration,
  readPerpsProZeroAddressLeverageBaseline,
} from './perpsProZeroAddressLeverageBaseline';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const USER_ADDRESS = '0x341a1fBD51825E5a107DB54cCb3166DeBA145479';
const activeAssetData = (
  user: string,
  coin: string,
  type: 'cross' | 'isolated',
  value: number,
) => ({
  coin,
  leverage: { type, value },
  user,
});

describe('Perps Pro zero-address leverage baseline', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockReadActiveAssetDataFromCache.mockReturnValue(null);
  });

  it('returns a matching cache entry synchronously without a request', async () => {
    mockReadActiveAssetDataFromCache.mockReturnValue(
      activeAssetData(ZERO_ADDRESS, 'SUI', 'cross', 10),
    );

    expect(readPerpsProZeroAddressLeverageBaseline('SUI')).toEqual({
      type: 'cross',
      value: 10,
    });
    await expect(
      preparePerpsProZeroAddressLeverageBaseline('SUI'),
    ).resolves.toEqual({ type: 'cross', value: 10 });
    expect(mockFetchActiveAssetDataWithCache).not.toHaveBeenCalled();
  });

  it('retries until a quickly settled request writes a fresh cache entry', async () => {
    const baseline = activeAssetData(ZERO_ADDRESS, 'SUI', 'cross', 10);
    mockFetchActiveAssetDataWithCache
      // The shared fetcher can return expired data after a network failure;
      // without a fresh cache write it is not a prepared market baseline.
      .mockResolvedValueOnce(baseline)
      .mockImplementationOnce(async () => {
        mockReadActiveAssetDataFromCache.mockReturnValue(baseline);
        return baseline;
      });

    await expect(
      preparePerpsProZeroAddressLeverageBaseline('SUI'),
    ).resolves.toEqual({ type: 'cross', value: 10 });
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledTimes(2);
  });

  it('returns fallback input after the bounded deadline instead of hanging', async () => {
    jest.useFakeTimers();
    mockFetchActiveAssetDataWithCache.mockImplementation(
      () => new Promise(() => undefined),
    );

    const pending = preparePerpsProZeroAddressLeverageBaseline('SUI');
    await jest.advanceTimersByTimeAsync(1500);

    await expect(pending).resolves.toBeNull();
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledTimes(1);
  });

  it('prepares current-account and zero-address sources within one deadline', async () => {
    const accountData = activeAssetData(USER_ADDRESS, 'SOL', 'isolated', 4);
    const zeroData = activeAssetData(ZERO_ADDRESS, 'SOL', 'cross', 20);
    const fetchedByAddress = new Map<
      string,
      ReturnType<typeof activeAssetData>
    >();
    mockReadActiveAssetDataFromCache.mockImplementation(
      (_cachedCoin: string, cachedAddress: string) =>
        fetchedByAddress.get(cachedAddress) ?? null,
    );
    mockFetchActiveAssetDataWithCache.mockImplementation(
      async (_coin: string, address: string) => {
        const data = address === USER_ADDRESS ? accountData : zeroData;
        fetchedByAddress.set(address, data);
        return data;
      },
    );

    await expect(
      preparePerpsProLeverageSources('SOL', USER_ADDRESS),
    ).resolves.toEqual({
      accountLeverageConfiguration: { type: 'isolated', value: 4 },
      zeroAddressLeverageBaseline: { type: 'cross', value: 20 },
    });
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledWith(
      'SOL',
      USER_ADDRESS,
    );
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledWith(
      'SOL',
      ZERO_ADDRESS,
    );
  });

  it('prefetches current-account and zero-address sources once for Home idle', async () => {
    mockFetchActiveAssetDataWithCache.mockResolvedValue(null);

    await prefetchPerpsProLeverageSources('SOL', USER_ADDRESS);

    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledTimes(2);
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledWith(
      'SOL',
      USER_ADDRESS,
    );
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledWith(
      'SOL',
      ZERO_ADDRESS,
    );
  });

  it('rejects cached data whose user does not match the requested account', () => {
    mockReadActiveAssetDataFromCache.mockReturnValue(
      activeAssetData(ZERO_ADDRESS, 'SOL', 'cross', 20),
    );

    expect(
      readPerpsProAccountLeverageConfiguration('SOL', USER_ADDRESS),
    ).toBeNull();
  });

  it('limits visible-row prefetch fan-out to four concurrent requests', async () => {
    const resolvers: Array<() => void> = [];
    mockFetchActiveAssetDataWithCache.mockImplementation(
      () =>
        new Promise<null>(resolve => {
          resolvers.push(() => resolve(null));
        }),
    );

    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(coin =>
      prefetchPerpsProZeroAddressLeverageBaseline(coin),
    );
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledTimes(4);

    resolvers.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockFetchActiveAssetDataWithCache).toHaveBeenCalledTimes(5);

    while (resolvers.length > 0) {
      resolvers.shift()?.();
      await Promise.resolve();
    }
    await Promise.resolve();
  });
});
