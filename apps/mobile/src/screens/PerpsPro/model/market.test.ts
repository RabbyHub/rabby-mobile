import type { PerpTopTokenCategory } from '@rabby-wallet/rabby-api/dist/types';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

import {
  buildPerpsProMarket,
  buildVisiblePerpsProCategories,
  calculatePerpsProChange24h,
  comparePerpsProMarketOrder,
  filterPerpsProMarketsByTab,
  getNextPerpsProSort,
  reconcilePerpsProMarkets,
  searchPerpsProMarkets,
  sortPerpsProMarkets,
} from './market';

const createMarketData = (overrides: Partial<MarketData> = {}): MarketData => ({
  index: 0,
  logoUrl: '',
  name: 'BTC',
  displayName: 'BTC',
  quoteAsset: 'USDC',
  maxLeverage: 40,
  minLeverage: 1,
  maxUsdValueSize: '1000000',
  szDecimals: 5,
  pxDecimals: 0,
  dayBaseVlm: '100',
  dayNtlVlm: '1000000',
  funding: '0.0001',
  markPx: '64000',
  midPx: '64000',
  openInterest: '1',
  oraclePx: '64000',
  premium: '0',
  prevDayPx: '63000',
  dexId: '',
  ...overrides,
});

describe('Perps Pro market model', () => {
  it('keeps canonical subscription identity separate from display identity', () => {
    const market = buildPerpsProMarket(
      createMarketData({
        name: 'xyz:AAPL',
        displayName: 'AAPL',
        dexId: 'xyz',
        quoteAsset: 'USDT',
        brief: 'Apple',
      }),
    );

    expect(market).toMatchObject({
      canonicalCoin: 'xyz:AAPL',
      displayBase: 'AAPL',
      displayPair: 'AAPLUSDT',
      fullName: 'Apple',
      marketKey: 'xyz::xyz:AAPL',
      sourceTag: 'xyz',
    });
  });

  it('uses only trimmed backend full names and never infers local aliases', () => {
    expect(
      buildPerpsProMarket(createMarketData({ brief: '  Bitcoin  ' })).fullName,
    ).toBe('Bitcoin');
    ['BTC', 'ETH', 'SOL', 'DOGE', 'PUNDIX'].forEach(name => {
      expect(
        buildPerpsProMarket(createMarketData({ name, displayName: name }))
          .fullName,
      ).toBeNull();
    });
    expect(
      buildPerpsProMarket(createMarketData({ brief: '   ' })).fullName,
    ).toBeNull();
  });

  it('calculates 24h change only from valid mark and previous-day prices', () => {
    expect(buildPerpsProMarket(createMarketData()).change24h).toBeCloseTo(
      1000 / 63000,
    );
    expect(
      buildPerpsProMarket(createMarketData({ prevDayPx: '0' })).change24h,
    ).toBeNull();
    expect(
      buildPerpsProMarket(createMarketData({ markPx: '' })).change24h,
    ).toBeNull();
    expect(
      calculatePerpsProChange24h(
        createMarketData({
          markPx: '1000000000000000000000001',
          prevDayPx: '1000000000000000000000000',
        }),
      ),
    ).toBeCloseTo(1e-24, 30);
  });

  it('reuses unchanged market view models and prunes removed cache entries', () => {
    const sources = Array.from({ length: 296 }, (_, index) =>
      createMarketData({
        dayNtlVlm: String(index + 1),
        displayName: `MARKET${index}`,
        index,
        markPx: String(index + 100),
        name: `MARKET${index}`,
        prevDayPx: String(index + 99),
      }),
    );
    const first = reconcilePerpsProMarkets(sources);
    const changedIndex = 173;
    const changedSource = {
      ...sources[changedIndex],
      markPx: '9999',
    };
    const nextSources = sources.map((source, index) =>
      index === changedIndex ? changedSource : source,
    );
    const second = reconcilePerpsProMarkets(nextSources, first.marketsByKey);

    second.markets.forEach((market, index) => {
      if (index === changedIndex) {
        expect(market).not.toBe(first.markets[index]);
        expect(market.marketData).toBe(changedSource);
        expect(market.price).toBe(9999);
      } else {
        expect(market).toBe(first.markets[index]);
      }
    });

    const removedKey = second.markets[0].marketKey;
    const third = reconcilePerpsProMarkets(
      nextSources.slice(1),
      second.marketsByKey,
    );
    expect(third.markets).toHaveLength(295);
    expect(third.marketsByKey.size).toBe(295);
    expect(third.marketsByKey.has(removedKey)).toBe(false);
  });

  it('keeps only enabled, referenced backend categories in priority order', () => {
    const markets = [
      buildPerpsProMarket(createMarketData({ categoryId: 'crypto' })),
      buildPerpsProMarket(
        createMarketData({
          name: 'xyz:AAPL',
          displayName: 'AAPL',
          dexId: 'xyz',
          categoryId: 'stocks',
        }),
      ),
    ];
    const categories: PerpTopTokenCategory[] = [
      {
        id: 'stocks',
        name: 'Stocks',
        priority: 2,
        is_disable: false,
        translations: {},
      },
      {
        id: 'crypto',
        name: 'Crypto',
        priority: 1,
        is_disable: false,
        translations: {},
      },
      {
        id: 'orphan',
        name: 'Orphan',
        priority: 0,
        is_disable: false,
        translations: {},
      },
      {
        id: 'disabled',
        name: 'Disabled',
        priority: 0,
        is_disable: true,
        translations: {},
      },
    ];

    expect(buildVisiblePerpsProCategories(categories, markets)).toEqual([
      { id: 'crypto', label: 'Crypto', priority: 1 },
      { id: 'stocks', label: 'Stocks', priority: 2 },
    ]);
  });

  it('uses backend translations for the active language with stable fallbacks', () => {
    const markets = [
      buildPerpsProMarket(createMarketData({ categoryId: 'crypto' })),
    ];
    const categories: PerpTopTokenCategory[] = [
      {
        id: 'crypto',
        name: 'Crypto',
        priority: 1,
        is_disable: false,
        translations: { 'zh-CN': '加密货币' },
      },
    ];

    expect(
      buildVisiblePerpsProCategories(categories, markets, 'zh-CN')[0]?.label,
    ).toBe('加密货币');
    expect(
      buildVisiblePerpsProCategories(categories, markets, 'de')[0]?.label,
    ).toBe('Crypto');
  });

  it('filters favorites and categories without changing All ordering', () => {
    const btc = buildPerpsProMarket(createMarketData({ categoryId: 'crypto' }));
    const apple = buildPerpsProMarket(
      createMarketData({
        name: 'xyz:AAPL',
        displayName: 'AAPL',
        dexId: 'xyz',
        categoryId: 'stocks',
      }),
    );
    const markets = [btc, apple];

    expect(filterPerpsProMarketsByTab(markets, 'all', ['XYZ:AAPL'])).toBe(
      markets,
    );
    expect(
      filterPerpsProMarketsByTab(markets, 'favorites', ['XYZ:AAPL']),
    ).toEqual([apple]);
    expect(filterPerpsProMarketsByTab(markets, 'crypto', [])).toEqual([btc]);
  });

  it('searches every approved display field case-insensitively', () => {
    const markets = [
      buildPerpsProMarket(createMarketData()),
      buildPerpsProMarket(
        createMarketData({
          name: 'xyz:AAPL',
          displayName: 'AAPL',
          dexId: 'xyz',
          brief: 'Apple',
        }),
      ),
    ];

    expect(searchPerpsProMarkets(markets, 'apple')).toEqual([markets[1]]);
    expect(searchPerpsProMarkets(markets, 'XYZ:')).toEqual([markets[1]]);
    expect(searchPerpsProMarkets(markets, 'usdc')).toEqual(markets);
  });

  it('sorts by volume/name with missing values last and stable keys', () => {
    const btc = buildPerpsProMarket(createMarketData({ dayNtlVlm: '100' }));
    const eth = buildPerpsProMarket(
      createMarketData({
        name: 'ETH',
        displayName: 'ETH',
        dayNtlVlm: '200',
      }),
    );
    const unknown = buildPerpsProMarket(
      createMarketData({
        name: 'NEW',
        displayName: 'NEW',
        dayNtlVlm: 'invalid',
      }),
    );

    expect(
      sortPerpsProMarkets([btc, unknown, eth], 'volume', 'desc').map(
        item => item.canonicalCoin,
      ),
    ).toEqual(['ETH', 'BTC', 'NEW']);
    expect(
      sortPerpsProMarkets([eth, btc, unknown], 'name', 'asc').map(
        item => item.canonicalCoin,
      ),
    ).toEqual(['BTC', 'ETH', 'NEW']);
  });

  it('keeps cached Collator ordering equivalent to the previous locale contract', () => {
    const markets = [
      { displayPair: 'alphaUSDC', marketKey: 'z::alpha', volume24h: 100 },
      { displayPair: 'AlphaUSDC', marketKey: 'a::Alpha', volume24h: 100 },
      { displayPair: 'A-USD', marketKey: 'x::A-USD', volume24h: null },
      { displayPair: 'ÄtherUSDC', marketKey: 'x::Äther', volume24h: 10 },
    ];
    const referenceCompare = (
      left: (typeof markets)[number],
      right: (typeof markets)[number],
      field: 'name' | 'volume',
      direction: 'asc' | 'desc',
    ) => {
      const compareVolume = () => {
        if (left.volume24h == null && right.volume24h == null) {
          return 0;
        }
        if (left.volume24h == null) {
          return 1;
        }
        if (right.volume24h == null) {
          return -1;
        }
        return direction === 'asc'
          ? left.volume24h - right.volume24h
          : right.volume24h - left.volume24h;
      };
      const primary =
        field === 'volume'
          ? compareVolume()
          : (direction === 'asc' ? 1 : -1) *
            left.displayPair.localeCompare(right.displayPair, 'en', {
              sensitivity: 'base',
            });
      return (
        primary ||
        left.marketKey.localeCompare(right.marketKey, 'en', {
          sensitivity: 'case',
        })
      );
    };

    (['name', 'volume'] as const).forEach(field => {
      (['asc', 'desc'] as const).forEach(direction => {
        const expected = [...markets]
          .sort((left, right) =>
            referenceCompare(left, right, field, direction),
          )
          .map(item => item.marketKey);
        const actual = [...markets]
          .sort((left, right) =>
            comparePerpsProMarketOrder(left, right, field, direction),
          )
          .map(item => item.marketKey);
        expect(actual).toEqual(expected);
      });
    });
  });

  it('uses Name ascending and Vol descending on first selection', () => {
    expect(getNextPerpsProSort('volume', 'desc', 'name')).toEqual({
      field: 'name',
      direction: 'asc',
    });
    expect(getNextPerpsProSort('name', 'asc', 'name')).toEqual({
      field: 'name',
      direction: 'desc',
    });
    expect(getNextPerpsProSort('name', 'desc', 'volume')).toEqual({
      field: 'volume',
      direction: 'desc',
    });
  });
});
