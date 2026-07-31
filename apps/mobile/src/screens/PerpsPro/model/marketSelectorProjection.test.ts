import type { MarketData } from '@/hooks/perps/usePerpsStore';

import {
  buildPerpsProMarketSlotOrders,
  reconcilePerpsProMarketSelectorProjection,
  resolvePerpsProMarketFromLatestData,
} from './marketSelectorProjection';

const createMarketData = (
  index: number,
  overrides: Partial<MarketData> = {},
): MarketData => {
  const name = `MARKET${String(index).padStart(3, '0')}`;
  return {
    brief: `Market ${index}`,
    categoryId: index < 20 ? 'layer-one' : undefined,
    dayBaseVlm: String(index + 1),
    dayNtlVlm: String(index + 1),
    dexId: '',
    displayName: name,
    funding: '0.0001',
    index,
    logoUrl: `https://example.test/${name}.png`,
    markPx: String(index + 100),
    maxLeverage: 20,
    maxUsdValueSize: '1000000',
    midPx: String(index + 100),
    minLeverage: 1,
    name,
    openInterest: '1',
    oraclePx: String(index + 100),
    premium: '0',
    prevDayPx: String(index + 99),
    pxDecimals: 2,
    quoteAsset: 'USDC',
    szDecimals: 2,
    ...overrides,
  };
};

describe('Perps Pro market selector projection', () => {
  it('precomputes all four stable orders and keeps slot identity positional', () => {
    const projection = reconcilePerpsProMarketSelectorProjection([
      createMarketData(0, {
        dayNtlVlm: '100',
        displayName: 'SAME',
      }),
      createMarketData(1, {
        dayNtlVlm: '100',
        dexId: 'xyz',
        displayName: 'SAME',
        name: 'xyz:MARKET001',
      }),
      createMarketData(2, {
        dayNtlVlm: 'invalid',
        displayName: 'ALPHA',
      }),
    ]);
    const slots = buildPerpsProMarketSlotOrders(projection, 'all', [], '');

    expect(projection.orders.name.asc).toEqual([
      'hyperliquid::MARKET002',
      'hyperliquid::MARKET000',
      'xyz::xyz:MARKET001',
    ]);
    expect(projection.orders.name.desc).toEqual([
      'hyperliquid::MARKET000',
      'xyz::xyz:MARKET001',
      'hyperliquid::MARKET002',
    ]);
    expect(projection.orders.volume.asc).toEqual([
      'hyperliquid::MARKET000',
      'xyz::xyz:MARKET001',
      'hyperliquid::MARKET002',
    ]);
    expect(projection.orders.volume.desc).toEqual([
      'hyperliquid::MARKET000',
      'xyz::xyz:MARKET001',
      'hyperliquid::MARKET002',
    ]);
    [
      slots.name.asc,
      slots.name.desc,
      slots.volume.asc,
      slots.volume.desc,
    ].forEach(order => {
      expect(order.map(slot => slot.slotKey)).toEqual([
        'slot:0',
        'slot:1',
        'slot:2',
      ]);
      expect(order.every(slot => slot.canonicalCoin.length > 0)).toBe(true);
    });
  });

  it('invalidates only the indexes affected by a live field change', () => {
    const sources = Array.from({ length: 296 }, (_, index) =>
      createMarketData(index),
    );
    const initial = reconcilePerpsProMarketSelectorProjection(sources);
    const clonedSnapshot = reconcilePerpsProMarketSelectorProjection(
      sources.map(source => ({ ...source })),
      initial,
    );

    expect(clonedSnapshot).toBe(initial);

    const changedIndex = 173;
    const markOnly = reconcilePerpsProMarketSelectorProjection(
      sources.map((source, index) =>
        index === changedIndex ? { ...source, markPx: '9999' } : source,
      ),
      initial,
    );

    expect(markOnly).toBe(initial);

    const volumeOnly = reconcilePerpsProMarketSelectorProjection(
      sources.map((source, index) =>
        index === changedIndex ? { ...source, dayNtlVlm: '999999' } : source,
      ),
      initial,
    );

    expect(volumeOnly.orders.name.asc).toBe(initial.orders.name.asc);
    expect(volumeOnly.orders.name.desc).toBe(initial.orders.name.desc);
    expect(volumeOnly.orders.volume.asc).not.toBe(initial.orders.volume.asc);
    expect(volumeOnly.orders.volume.desc).not.toBe(initial.orders.volume.desc);

    const nameOnly = reconcilePerpsProMarketSelectorProjection(
      sources.map((source, index) =>
        index === changedIndex
          ? { ...source, displayName: 'A-MARKET173' }
          : source,
      ),
      initial,
    );

    expect(nameOnly.orders.name.asc).not.toBe(initial.orders.name.asc);
    expect(nameOnly.orders.name.desc).not.toBe(initial.orders.name.desc);
    expect(nameOnly.orders.volume.asc).toBe(initial.orders.volume.asc);
    expect(nameOnly.orders.volume.desc).toBe(initial.orders.volume.desc);
  });

  it('filters every cached order without changing search, tab or favorite semantics', () => {
    const projection = reconcilePerpsProMarketSelectorProjection([
      createMarketData(0, {
        brief: 'Bitcoin',
        categoryId: 'crypto',
        displayName: 'BTC',
        name: 'BTC',
      }),
      createMarketData(1, {
        brief: 'Apple',
        categoryId: 'stocks',
        dexId: 'xyz',
        displayName: 'AAPL',
        name: 'xyz:AAPL',
        quoteAsset: 'USDT',
      }),
      createMarketData(2, {
        brief: 'Ethereum',
        categoryId: 'crypto',
        displayName: 'ETH',
        name: 'ETH',
      }),
    ]);

    const favorites = buildPerpsProMarketSlotOrders(
      projection,
      'favorites',
      ['XYZ:AAPL'],
      '',
    );
    const category = buildPerpsProMarketSlotOrders(
      projection,
      'crypto',
      [],
      '',
    );
    const search = buildPerpsProMarketSlotOrders(
      projection,
      'all',
      [],
      'apple',
    );

    expect(favorites.name.asc.map(slot => slot.marketKey)).toEqual([
      'xyz::xyz:AAPL',
    ]);
    expect(category.name.asc.map(slot => slot.marketKey)).toEqual([
      'hyperliquid::BTC',
      'hyperliquid::ETH',
    ]);
    expect(search.volume.desc.map(slot => slot.marketKey)).toEqual([
      'xyz::xyz:AAPL',
    ]);
  });

  it('resolves actions against the latest raw market instead of a cached row', () => {
    const source = createMarketData(0);
    const initial = reconcilePerpsProMarketSelectorProjection([source]);
    const latestSource = {
      ...source,
      description: 'latest metadata',
    };
    const latest = reconcilePerpsProMarketSelectorProjection(
      [latestSource],
      initial,
    );

    expect(latest).toBe(initial);
    expect(
      resolvePerpsProMarketFromLatestData(
        latest,
        { MARKET000: latestSource },
        'hyperliquid::MARKET000',
      )?.marketData,
    ).toBe(latestSource);
  });
});
