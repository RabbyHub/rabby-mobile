import type { MarketData } from '@/hooks/perps/usePerpsStore';

import { buildPerpsProMarkets, buildPerpsProMarketKey } from './model/market';
import {
  buildPerpsProMarketSlotOrders,
  reconcilePerpsProMarketSelectorProjection,
  resolvePerpsProMarketFromLatestData,
} from './model/marketSelectorProjection';
import { resolveInitialPerpsProMarket } from './model/resolveInitialMarket';
import {
  getPerpsProMarketSession,
  getPerpsProSessionBookPrecision,
  resetPerpsProMarketSessionForTests,
  setPerpsProSessionBookPrecision,
  setPerpsProSessionMarket,
  setPerpsProSessionSort,
} from './session/perpsProMarketSession';

const createMarketData = (overrides: Partial<MarketData> = {}): MarketData => ({
  dayBaseVlm: '100',
  dayNtlVlm: '1000000',
  dexId: '',
  displayName: 'BTC',
  funding: '0.0001',
  index: 0,
  logoUrl: '',
  markPx: '64000',
  maxLeverage: 40,
  maxUsdValueSize: '1000000',
  midPx: '64000',
  minLeverage: 1,
  name: 'BTC',
  openInterest: '1',
  oraclePx: '64000',
  premium: '0',
  prevDayPx: '63000',
  pxDecimals: 0,
  quoteAsset: 'USDC',
  szDecimals: 5,
  ...overrides,
});

const buildMarketDataMap = (marketData: readonly MarketData[]) =>
  Object.fromEntries(marketData.map(market => [market.name, market]));

describe('Perps Pro market context integration', () => {
  beforeEach(() => {
    resetPerpsProMarketSessionForTests();
  });

  afterEach(() => {
    resetPerpsProMarketSessionForTests();
  });

  it('keeps route selection, process session and live market data on one canonical identity', () => {
    const initialSources = [
      createMarketData(),
      createMarketData({
        brief: 'Apple',
        categoryId: 'stocks',
        dayNtlVlm: '250000',
        dexId: 'xyz',
        displayName: 'AAPL',
        index: 1,
        markPx: '220',
        midPx: '220',
        name: 'xyz:AAPL',
        prevDayPx: '200',
        pxDecimals: 2,
        quoteAsset: 'USDT',
        szDecimals: 3,
      }),
    ];
    const markets = buildPerpsProMarkets(initialSources);
    const selected = resolveInitialPerpsProMarket({
      markets,
      navigationMarket: 'xyz:AAPL',
      sessionMarketKey: null,
    });

    expect(selected).toMatchObject({
      canonicalCoin: 'xyz:AAPL',
      displayPair: 'AAPLUSDT',
      marketKey: 'xyz::xyz:AAPL',
      price: 220,
    });

    setPerpsProSessionMarket(selected!.marketKey);
    setPerpsProSessionSort('name', 'asc');
    setPerpsProSessionBookPrecision(selected!.marketKey, {
      nSigFigs: 4,
      mantissa: 2,
    });

    const projection =
      reconcilePerpsProMarketSelectorProjection(initialSources);
    const slotOrders = buildPerpsProMarketSlotOrders(
      projection,
      'all',
      [],
      'apple',
    );
    expect(slotOrders.name.asc).toEqual([
      {
        canonicalCoin: 'xyz:AAPL',
        marketKey: selected!.marketKey,
        slotKey: 'slot:0',
      },
    ]);

    const liveSources = initialSources.map(source =>
      source.name === 'xyz:AAPL'
        ? {
            ...source,
            markPx: '225.5',
            midPx: '225.4',
          }
        : source,
    );
    const reconciledProjection = reconcilePerpsProMarketSelectorProjection(
      liveSources,
      projection,
    );
    const liveMarket = resolvePerpsProMarketFromLatestData(
      reconciledProjection,
      buildMarketDataMap(liveSources),
      selected!.marketKey,
    );

    expect(reconciledProjection).toBe(projection);
    expect(liveMarket).toMatchObject({
      canonicalCoin: 'xyz:AAPL',
      marketKey: selected!.marketKey,
      price: 225.5,
    });
    expect(getPerpsProMarketSession()).toEqual({
      marketKey: selected!.marketKey,
      sortDirection: 'asc',
      sortField: 'name',
    });
    expect(getPerpsProSessionBookPrecision(selected!.marketKey)).toEqual({
      nSigFigs: 4,
      mantissa: 2,
    });
  });

  it('falls back deterministically when a remembered market leaves the catalogue', () => {
    const rememberedKey = buildPerpsProMarketKey('xyz', 'xyz:AAPL');
    setPerpsProSessionMarket(rememberedKey);
    setPerpsProSessionBookPrecision(rememberedKey, {
      nSigFigs: 3,
      mantissa: null,
    });
    setPerpsProSessionBookPrecision('hyperliquid::BTC', {
      nSigFigs: 5,
      mantissa: 1,
    });

    const resolved = resolveInitialPerpsProMarket({
      markets: buildPerpsProMarkets([
        createMarketData(),
        createMarketData({
          displayName: 'ETH',
          index: 1,
          name: 'ETH',
        }),
      ]),
      navigationMarket: 'MISSING',
      sessionMarketKey: getPerpsProMarketSession().marketKey,
    });

    expect(resolved?.marketKey).toBe('hyperliquid::BTC');
    expect(getPerpsProSessionBookPrecision(rememberedKey)).toEqual({
      nSigFigs: 3,
      mantissa: null,
    });
    expect(getPerpsProSessionBookPrecision(resolved!.marketKey)).toEqual({
      nSigFigs: 5,
      mantissa: 1,
    });
  });
});
