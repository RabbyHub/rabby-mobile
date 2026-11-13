import { sortBy } from 'lodash';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import type { PerpsCategoryConfig } from '../constants/perpsCategories';
import { groupPerpsMarkets } from './groupPerpsMarkets';
import {
  createPerpsHomeRowsSelector,
  type PerpsHomeRow,
} from './perpsHomeRows';

const config = (
  id: string,
  overrides: Partial<PerpsCategoryConfig> = {},
): PerpsCategoryConfig => ({
  id,
  label: id,
  homeLimit: id === 'favorite' ? null : 5,
  showRankOnHome: id === 'topVolume',
  showRankOnSearch: id === 'topVolume',
  ...overrides,
});

const market = (
  name: string,
  dayNtlVlm: string,
  overrides: Partial<MarketData> = {},
): MarketData => ({
  index: 0,
  logoUrl: '',
  name,
  displayName: name,
  quoteAsset: 'USDC',
  maxLeverage: 20,
  minLeverage: 1,
  maxUsdValueSize: '100000',
  maintenanceMarginTiers: [],
  szDecimals: 2,
  pxDecimals: 2,
  dayBaseVlm: '1',
  dayNtlVlm,
  funding: '0',
  markPx: '100',
  midPx: '100',
  openInterest: '1',
  oraclePx: '100',
  premium: '0',
  prevDayPx: '100',
  dexId: '',
  categoryId: 'crypto',
  ...overrides,
});

const categoryRows = (rows: PerpsHomeRow[]) =>
  rows.filter(
    (row): row is Extract<PerpsHomeRow, { type: 'category' }> =>
      row.type === 'category',
  );

const marketRows = (rows: PerpsHomeRow[], category: string) =>
  rows.filter(
    (row): row is Extract<PerpsHomeRow, { type: 'market' }> =>
      row.type === 'market' && JSON.parse(row.key)[0] === category,
  );

const names = (rows: PerpsHomeRow[], category: string) =>
  marketRows(rows, category).map(row => row.marketName);

// Compare the identity-only projection with the real existing grouping and
// stable lodash volume ordering; do not mock the behavior being preserved.
function groupedRows(
  state: { marketData: MarketData[]; favoriteMarkets: string[] },
  configs: PerpsCategoryConfig[],
): PerpsHomeRow[] {
  const sorted = sortBy(
    state.marketData,
    item => -(Number(item.dayNtlVlm) || 0),
  );
  return groupPerpsMarkets(
    sorted,
    state.favoriteMarkets,
    configs,
  ).visibleHome.flatMap(category => [
    {
      key: JSON.stringify([category.id]),
      type: 'category' as const,
      cfg: category.cfg,
    },
    ...category.items.map((item, index) => ({
      key: JSON.stringify([category.id, item.name]),
      type: 'market' as const,
      marketName: item.name,
      rank: category.cfg.showRankOnHome ? index + 1 : undefined,
      first: index === 0,
      last: index === category.items.length - 1,
    })),
  ]);
}

describe('Perps Home structural rows selector', () => {
  it('retains the rows and item references for quote and non-structural updates', () => {
    const configs = [config('favorite'), config('topVolume'), config('crypto')];
    const select = createPerpsHomeRowsSelector(configs);
    const state = {
      marketData: [market('BTC', '100'), market('ETH', '50')],
      favoriteMarkets: ['eth'],
    };
    const initial = select(state);
    expect(select(state)).toBe(initial);
    const next = select({
      marketData: state.marketData.map(item => ({
        ...item,
        markPx: '999',
        midPx: '998',
        prevDayPx: '998',
        funding: '0.01',
        openInterest: '500',
        maxLeverage: 50,
        displayName: `${item.name} updated`,
        logoUrl: 'https://example.invalid/updated.png',
        description: 'Updated metadata',
      })),
      favoriteMarkets: [...state.favoriteMarkets],
    });
    expect(next).toBe(initial);
    next.forEach((row, index) => expect(row).toBe(initial[index]));
    expect(marketRows(next, 'topVolume')[0]).toEqual({
      key: '["topVolume","BTC"]',
      type: 'market',
      marketName: 'BTC',
      rank: 1,
      first: true,
      last: false,
    });
  });

  it('retains rows when volume changes do not change visible membership or order', () => {
    const select = createPerpsHomeRowsSelector([config('topVolume')]);
    const state = {
      marketData: Array.from({ length: 7 }, (_, index) =>
        market(`COIN${index}`, String(100 - index)),
      ),
      favoriteMarkets: [],
    };
    const initial = select(state);
    expect(
      select({
        ...state,
        marketData: state.marketData.map((item, index) => ({
          ...item,
          dayNtlVlm: index < 5 ? String(200 - index) : String(index),
        })),
      }),
    ).toBe(initial);
    expect(names(initial, 'topVolume')).toEqual([
      'COIN0',
      'COIN1',
      'COIN2',
      'COIN3',
      'COIN4',
    ]);
  });

  it('publishes reordered rows and ranks when volume changes the ranking', () => {
    const select = createPerpsHomeRowsSelector([config('topVolume')]);
    const state = {
      marketData: [market('BTC', '100'), market('ETH', '50')],
      favoriteMarkets: [],
    };
    const initial = select(state);
    const next = select({
      ...state,
      marketData: [
        state.marketData[0],
        { ...state.marketData[1], dayNtlVlm: '101' },
      ],
    });
    expect(next).not.toBe(initial);
    expect(marketRows(next, 'topVolume')).toEqual([
      {
        key: '["topVolume","ETH"]',
        type: 'market',
        marketName: 'ETH',
        rank: 1,
        first: true,
        last: false,
      },
      {
        key: '["topVolume","BTC"]',
        type: 'market',
        marketName: 'BTC',
        rank: 2,
        first: false,
        last: true,
      },
    ]);
    expect(names(initial, 'topVolume')).toEqual(['BTC', 'ETH']);
  });

  it('matches favorites case-insensitively without duplicates or a five-row cap', () => {
    const select = createPerpsHomeRowsSelector([
      config('favorite'),
      config('topVolume'),
      config('crypto'),
    ]);
    const marketData = Array.from({ length: 8 }, (_, index) =>
      market(`COIN${index}`, String(index)),
    );
    const initial = select({
      marketData,
      favoriteMarkets: [
        ...marketData.map(item => item.name.toLowerCase()),
        'COIN0',
        'coin0',
        'UNKNOWN',
      ],
    });
    const sortedNames = marketData.map(item => item.name).reverse();
    expect(names(initial, 'favorite')).toEqual(sortedNames);
    expect(names(initial, 'topVolume')).toEqual(sortedNames.slice(0, 5));
    expect(names(initial, 'crypto')).toEqual(sortedNames.slice(0, 5));
    expect(
      select({
        marketData,
        favoriteMarkets: [...sortedNames, 'coin0'],
      }),
    ).toBe(initial);
    expect(marketData.map(item => item.name)).toEqual([
      'COIN0',
      'COIN1',
      'COIN2',
      'COIN3',
      'COIN4',
      'COIN5',
      'COIN6',
      'COIN7',
    ]);
  });

  it('adds and removes a favorite category as membership changes', () => {
    const select = createPerpsHomeRowsSelector([
      config('favorite'),
      config('crypto'),
    ]);
    const state = {
      marketData: [market('BTC', '100'), market('ETH', '50')],
      favoriteMarkets: [] as string[],
    };
    const initial = select(state);
    const favorite = select({ ...state, favoriteMarkets: ['ETH'] });
    expect(favorite).not.toBe(initial);
    expect(categoryRows(favorite).map(row => row.cfg.id)).toEqual([
      'favorite',
      'crypto',
    ]);
    expect(names(favorite, 'favorite')).toEqual(['ETH']);
    const removed = select({ ...state, favoriteMarkets: ['MISSING'] });
    expect(removed).not.toBe(favorite);
    expect(removed).toEqual(initial);
    expect(categoryRows(removed).map(row => row.cfg.id)).toEqual(['crypto']);
  });

  it('updates backend category membership and omits empty categories', () => {
    const configs = [config('crypto'), config('stock'), config('empty')];
    const select = createPerpsHomeRowsSelector(configs);
    const state = {
      marketData: [market('BTC', '100'), market('ETH', '50')],
      favoriteMarkets: [],
    };
    const initial = select(state);
    const next = select({
      ...state,
      marketData: [
        { ...state.marketData[0], categoryId: 'stock' },
        state.marketData[1],
      ],
    });
    expect(next).not.toBe(initial);
    expect(categoryRows(next).map(row => row.cfg.id)).toEqual([
      'crypto',
      'stock',
    ]);
    expect(names(next, 'crypto')).toEqual(['ETH']);
    expect(names(next, 'stock')).toEqual(['BTC']);
    expect(marketRows(next, 'crypto')[0]).toMatchObject({
      first: true,
      last: true,
    });
    const unknown = select({
      ...state,
      marketData: state.marketData.map(item => ({
        ...item,
        categoryId: 'unknown',
      })),
    });
    expect(unknown).toEqual([]);
  });

  it('removes stale market rows, corrects edge flags, and stabilizes empty results', () => {
    const select = createPerpsHomeRowsSelector([
      config('favorite'),
      config('crypto'),
    ]);
    const state = {
      marketData: [market('BTC', '100'), market('ETH', '50')],
      favoriteMarkets: ['BTC', 'ETH'],
    };
    const initial = select(state);
    const next = select({ ...state, marketData: [state.marketData[1]] });
    expect(next).not.toBe(initial);
    expect(names(next, 'favorite')).toEqual(['ETH']);
    expect(names(next, 'crypto')).toEqual(['ETH']);
    for (const category of ['favorite', 'crypto']) {
      expect(marketRows(next, category)[0]).toMatchObject({
        first: true,
        last: true,
      });
    }
    const empty = select({ ...state, marketData: [] });
    expect(empty).toEqual([]);
    expect(select({ marketData: [], favoriteMarkets: [] })).toBe(empty);
  });

  it('keeps distinct category-scoped keys for the same market', () => {
    const configs = [config('favorite'), config('topVolume'), config('crypto')];
    const rows = createPerpsHomeRowsSelector(configs)({
      marketData: [market('BTC', '100')],
      favoriteMarkets: ['btc'],
    });
    expect(rows.map(row => row.key)).toEqual([
      '["favorite"]',
      '["favorite","BTC"]',
      '["topVolume"]',
      '["topVolume","BTC"]',
      '["crypto"]',
      '["crypto","BTC"]',
    ]);
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
    expect(marketRows(rows, 'favorite')[0].rank).toBeUndefined();
    expect(marketRows(rows, 'topVolume')[0].rank).toBe(1);
    expect(marketRows(rows, 'crypto')[0].rank).toBeUndefined();
  });

  it('preserves lodash input-order ties and numeric zero fallbacks', () => {
    const configs = [config('topVolume', { homeLimit: null })];
    const select = createPerpsHomeRowsSelector(configs);
    const state = {
      marketData: [
        market('TIE_B', '10'),
        market('INVALID', 'invalid'),
        market('TIE_A', '10.0'),
        market('ZERO', '0'),
        market('HIGH', '20'),
        market('EMPTY', ''),
        market('NEGATIVE', '-1'),
      ],
      favoriteMarkets: [],
    };
    const initial = select(state);
    expect(names(initial, 'topVolume')).toEqual([
      'HIGH',
      'TIE_B',
      'TIE_A',
      'INVALID',
      'ZERO',
      'EMPTY',
      'NEGATIVE',
    ]);
    expect(initial).toEqual(groupedRows(state, configs));
    expect(select({ ...state, marketData: [...state.marketData] })).toBe(
      initial,
    );
    const next = select({
      ...state,
      marketData: [
        state.marketData[2],
        state.marketData[1],
        state.marketData[0],
        ...state.marketData.slice(3),
      ],
    });
    expect(next).not.toBe(initial);
    expect(names(next, 'topVolume')).toEqual([
      'HIGH',
      'TIE_A',
      'TIE_B',
      'INVALID',
      'ZERO',
      'EMPTY',
      'NEGATIVE',
    ]);
  });

  it('uses new translated configs in a new selector even with identical state inputs', () => {
    const original = [config('favorite'), config('topVolume')];
    const translated = original.map(cfg => ({
      ...cfg,
      label: `translated ${cfg.id}`,
    }));
    const state = {
      marketData: [market('BTC', '100')],
      favoriteMarkets: ['BTC'],
    };
    const selectOriginal = createPerpsHomeRowsSelector(original);
    const selectTranslated = createPerpsHomeRowsSelector(translated);
    const initial = selectOriginal(state);
    const next = selectTranslated(state);
    expect(next).not.toBe(initial);
    expect(next.map(row => row.key)).toEqual(initial.map(row => row.key));
    expect(categoryRows(next).map(row => row.cfg.label)).toEqual([
      'translated favorite',
      'translated topVolume',
    ]);
    categoryRows(next).forEach((row, index) =>
      expect(row.cfg).toBe(translated[index]),
    );
    expect(selectOriginal(state)).toBe(initial);
    expect(selectTranslated(state)).toBe(next);
  });

  it('applies changed category order, limits and rank configuration in a new selector', () => {
    const state = {
      marketData: [market('BTC', '100'), market('ETH', '50')],
      favoriteMarkets: ['BTC', 'ETH'],
    };
    const before = createPerpsHomeRowsSelector([
      config('favorite'),
      config('topVolume'),
    ])(state);
    const configs = [
      config('topVolume', { homeLimit: 1, showRankOnHome: false }),
      config('favorite', { homeLimit: 1, showRankOnHome: true }),
    ];
    const after = createPerpsHomeRowsSelector(configs)(state);
    expect(after).not.toEqual(before);
    expect(categoryRows(after).map(row => row.cfg.id)).toEqual([
      'topVolume',
      'favorite',
    ]);
    expect(names(after, 'topVolume')).toEqual(['BTC']);
    expect(names(after, 'favorite')).toEqual(['BTC']);
    expect(marketRows(after, 'topVolume')[0]).toMatchObject({
      rank: undefined,
      first: true,
      last: true,
    });
    expect(marketRows(after, 'favorite')[0]).toMatchObject({
      rank: 1,
      first: true,
      last: true,
    });
  });

  it.each([0, 1, 80, 1000])(
    'matches existing grouping and sort semantics for %i markets',
    count => {
      const configs = [
        config('favorite'),
        config('topVolume'),
        config('crypto'),
        config('stock'),
        config('hidden', { homeLimit: 0 }),
        config(''),
      ];
      const state = {
        marketData: Array.from({ length: count }, (_, index) =>
          market(`COIN${index}`, String((index * 7) % 11), {
            categoryId: [
              undefined,
              '',
              'favorite',
              'topVolume',
              'crypto',
              'stock',
              'hidden',
              'unknown',
            ][index % 8],
          }),
        ),
        favoriteMarkets: Array.from(
          { length: Math.ceil(count / 3) },
          (_, index) => `coin${index * 3}`,
        ),
      };
      const select = createPerpsHomeRowsSelector(configs);
      expect(select(state)).toEqual(groupedRows(state, configs));
    },
  );
});
