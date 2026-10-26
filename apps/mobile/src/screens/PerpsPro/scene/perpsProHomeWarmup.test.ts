import type { MarketData } from '@/hooks/perps/usePerpsStore';

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {},
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: { getState: jest.fn() },
}));

jest.mock('../session/perpsProMarketSession', () => ({
  getPerpsProMarketSession: () => ({ marketKey: null }),
}));

jest.mock('./perpsProEntryIntent', () => ({
  prewarmPerpsProEntryIntent: jest.fn(),
}));

jest.mock('./perpsProZeroAddressLeverageBaseline', () => ({
  prefetchPerpsProLeverageSources: jest.fn(),
}));

import {
  prewarmPerpsProExternalNavigationIntent,
  prewarmPerpsProHomeAffinity,
  prewarmPerpsProHomeNavigationIntent,
} from './perpsProHomeWarmup';

const createMarketData = (name: string): MarketData => ({
  dayBaseVlm: '100',
  dayNtlVlm: '100000',
  dexId: '',
  displayName: name,
  funding: '0',
  index: 0,
  logoUrl: '',
  markPx: '10',
  maxLeverage: 20,
  maxUsdValueSize: '1000000',
  midPx: '10',
  minLeverage: 1,
  name,
  openInterest: '1',
  oraclePx: '10',
  premium: '0',
  prevDayPx: '9',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 2,
});

const BTC = createMarketData('BTC');
const SOL = createMarketData('SOL');
const PERSISTED_ADDRESS = '0x1111111111111111111111111111111111111111';
const LIVE_ADDRESS = '0x341a1fBD51825E5a107DB54cCb3166DeBA145479';

const createDependencies = () => ({
  getCurrentAccount: jest.fn(async () => ({
    address: PERSISTED_ADDRESS,
    type: 'WatchAddressKeyring',
  })),
  getLastUsedAccount: jest.fn(async () => null),
  getSessionMarketKey: jest.fn(() => 'hyperliquid::SOL'),
  getState: jest.fn(() => ({
    currentPerpsAccount: {
      address: LIVE_ADDRESS,
      type: 'WatchAddressKeyring',
    },
    marketData: [BTC, SOL],
  })),
  prefetchLeverageSources: jest.fn(async () => undefined),
  prewarmEntryIntent: jest.fn(() => jest.fn()),
});

describe('Perps Pro Home warmup', () => {
  it('warms the latest session target with the live account after Home is idle', async () => {
    const dependencies = createDependencies();

    await expect(prewarmPerpsProHomeAffinity(dependencies)).resolves.toBe(true);

    expect(dependencies.prefetchLeverageSources).toHaveBeenCalledWith(
      'SOL',
      LIVE_ADDRESS,
    );
  });

  it('uses the persisted account when Home has not selected one in memory', async () => {
    const dependencies = createDependencies();
    dependencies.getState.mockReturnValue({
      currentPerpsAccount: null,
      marketData: [BTC, SOL],
    });

    await prewarmPerpsProHomeAffinity(dependencies);

    expect(dependencies.prefetchLeverageSources).toHaveBeenCalledWith(
      'SOL',
      PERSISTED_ADDRESS,
    );
  });

  it('skips persisted account reads when no real catalogue target exists', async () => {
    const dependencies = createDependencies();
    dependencies.getState.mockReturnValue({
      currentPerpsAccount: null,
      marketData: [],
    });

    await expect(prewarmPerpsProHomeAffinity(dependencies)).resolves.toBe(
      false,
    );
    expect(dependencies.getCurrentAccount).not.toHaveBeenCalled();
    expect(dependencies.prefetchLeverageSources).not.toHaveBeenCalled();
  });

  it('starts one exact entry intent for the pre-gated Pro navigation', async () => {
    const dependencies = createDependencies();

    await expect(
      prewarmPerpsProHomeNavigationIntent(dependencies),
    ).resolves.toBe(true);

    expect(dependencies.prewarmEntryIntent).toHaveBeenCalledWith({
      accountAddress: LIVE_ADDRESS,
      market: expect.objectContaining({
        canonicalCoin: 'SOL',
        marketKey: 'hyperliquid::SOL',
      }),
    });
  });

  it('prewarms the explicit external market and account without session fallback', async () => {
    const dependencies = createDependencies();

    await expect(
      prewarmPerpsProExternalNavigationIntent(
        { accountAddress: PERSISTED_ADDRESS, market: 'BTC' },
        dependencies,
      ),
    ).resolves.toBe(true);

    expect(dependencies.prewarmEntryIntent).toHaveBeenCalledWith({
      accountAddress: PERSISTED_ADDRESS,
      market: expect.objectContaining({ canonicalCoin: 'BTC' }),
    });
  });

  it('does not prewarm a fallback market for an unresolved external target', async () => {
    const dependencies = createDependencies();

    await expect(
      prewarmPerpsProExternalNavigationIntent(
        { marketCandidates: ['MISSING'] },
        dependencies,
      ),
    ).resolves.toBe(false);
    expect(dependencies.prewarmEntryIntent).not.toHaveBeenCalled();
  });
});
