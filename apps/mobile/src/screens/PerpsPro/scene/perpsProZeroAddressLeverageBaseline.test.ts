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
  prefetchPerpsProZeroAddressLeverageBaseline,
  preparePerpsProZeroAddressLeverageBaseline,
  readPerpsProZeroAddressLeverageBaseline,
} from './perpsProZeroAddressLeverageBaseline';

const activeAssetData = (
  coin: string,
  type: 'cross' | 'isolated',
  value: number,
) => ({
  coin,
  leverage: { type, value },
});

describe('Perps Pro zero-address leverage baseline', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockReadActiveAssetDataFromCache.mockReturnValue(null);
  });

  it('returns a matching cache entry synchronously without a request', async () => {
    mockReadActiveAssetDataFromCache.mockReturnValue(
      activeAssetData('SUI', 'cross', 10),
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
    const baseline = activeAssetData('SUI', 'cross', 10);
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
