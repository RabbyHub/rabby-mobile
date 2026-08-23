const mockGetActiveAssetData = jest.fn();

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      info: { getActiveAssetData: mockGetActiveAssetData },
    }),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: Object.assign(jest.fn(), {
    getState: () => ({ currentPerpsAccount: null }),
  }),
}));

import {
  fetchActiveAssetDataWithCache,
  readActiveAssetDataFromCache,
  updateActiveAssetLeverageCache,
  writeActiveAssetDataToCache,
} from './useActiveAssetDataCache';

const address = '0x0000000000000000000000000000000000000001';
const activeAssetData = (coin: string, type: 'cross' | 'isolated') =>
  ({
    availableToTrade: ['100', '100'],
    coin,
    leverage: { type, value: 10 },
    markPx: '1',
    maxTradeSzs: ['100', '100'],
    user: address,
  } as never);

describe('active asset data cache leverage confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('keeps an accepted account-and-coin mode against a delayed server frame', () => {
    const coin = 'CACHE_GUARD_DOGE';
    writeActiveAssetDataToCache(
      coin,
      address,
      activeAssetData(coin, 'isolated'),
    );

    updateActiveAssetLeverageCache(coin, address, {
      type: 'cross',
      value: 10,
    });
    const effective = writeActiveAssetDataToCache(
      coin,
      address,
      activeAssetData(coin, 'isolated'),
    );

    expect(effective.leverage).toEqual({ type: 'cross', value: 10 });
    expect(readActiveAssetDataFromCache(coin, address)?.leverage).toEqual({
      type: 'cross',
      value: 10,
    });
  });

  it('keeps the guard through confirmation and releases it after its grace period', () => {
    const coin = 'CACHE_CONFIRMED_DOGE';
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    writeActiveAssetDataToCache(
      coin,
      address,
      activeAssetData(coin, 'isolated'),
    );
    updateActiveAssetLeverageCache(coin, address, {
      type: 'cross',
      value: 10,
    });

    expect(
      writeActiveAssetDataToCache(coin, address, activeAssetData(coin, 'cross'))
        .leverage,
    ).toEqual({ type: 'cross', value: 10 });
    expect(
      writeActiveAssetDataToCache(
        coin,
        address,
        activeAssetData(coin, 'isolated'),
      ).leverage,
    ).toEqual({ type: 'cross', value: 10 });
    now.mockReturnValue(32_000);
    expect(
      writeActiveAssetDataToCache(
        coin,
        address,
        activeAssetData(coin, 'isolated'),
      ).leverage,
    ).toEqual({ type: 'isolated', value: 10 });
  });

  it('does not let an older in-flight fetch replace the accepted mode', async () => {
    const coin = 'CACHE_INFLIGHT_DOGE';
    let resolveFetch!: (data: ReturnType<typeof activeAssetData>) => void;
    mockGetActiveAssetData.mockReturnValueOnce(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    writeActiveAssetDataToCache(
      coin,
      address,
      activeAssetData(coin, 'isolated'),
    );
    now.mockReturnValue(700_000);

    const request = fetchActiveAssetDataWithCache(coin, address);
    updateActiveAssetLeverageCache(coin, address, {
      type: 'cross',
      value: 10,
    });
    resolveFetch(activeAssetData(coin, 'isolated'));

    await expect(request).resolves.toMatchObject({
      leverage: { type: 'cross', value: 10 },
    });
    expect(readActiveAssetDataFromCache(coin, address)?.leverage).toEqual({
      type: 'cross',
      value: 10,
    });
  });

  it('keeps untouched coins on their own server-provided default', () => {
    const changedCoin = 'CACHE_CHANGED_DOGE';
    const untouchedCoin = 'CACHE_UNTOUCHED_ETH';
    writeActiveAssetDataToCache(
      changedCoin,
      address,
      activeAssetData(changedCoin, 'isolated'),
    );
    writeActiveAssetDataToCache(
      untouchedCoin,
      address,
      activeAssetData(untouchedCoin, 'isolated'),
    );
    updateActiveAssetLeverageCache(changedCoin, address, {
      type: 'cross',
      value: 10,
    });

    expect(
      readActiveAssetDataFromCache(changedCoin, address)?.leverage.type,
    ).toBe('cross');
    expect(
      readActiveAssetDataFromCache(untouchedCoin, address)?.leverage.type,
    ).toBe('isolated');
  });
});
