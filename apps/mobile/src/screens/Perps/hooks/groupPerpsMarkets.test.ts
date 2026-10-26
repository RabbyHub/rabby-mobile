import type { MarketData } from '@/hooks/perps/usePerpsStore';
import type { PerpsCategoryConfig } from '../constants/perpsCategories';
import { groupPerpsMarkets } from './groupPerpsMarkets';

const config = (
  id: string,
  homeLimit: number | null = 5,
): PerpsCategoryConfig => ({
  id,
  label: id,
  homeLimit,
  showRankOnHome: id === 'topVolume',
  showRankOnSearch: id === 'topVolume',
});

const market = (name: string, categoryId?: string) =>
  ({ name, categoryId } as MarketData);

// Keep the former repeated-filter implementation as an output-equivalence
// oracle, not as a runtime fallback.
function previousGroups(
  sorted: MarketData[],
  favorites: string[],
  configs: PerpsCategoryConfig[],
) {
  const favoriteSet = new Set(favorites.map(name => name.toUpperCase()));
  const fullByCategory: Record<string, MarketData[]> = {};
  for (const cfg of configs) {
    fullByCategory[cfg.id] =
      cfg.id === 'favorite'
        ? sorted.filter(item => favoriteSet.has(item.name.toUpperCase()))
        : cfg.id === 'topVolume'
        ? sorted
        : sorted.filter(item => item.categoryId === cfg.id);
  }
  return {
    fullByCategory,
    visibleHome: configs
      .map(cfg => {
        const all = fullByCategory[cfg.id];
        return {
          id: cfg.id,
          cfg,
          items: cfg.homeLimit == null ? all : all.slice(0, cfg.homeLimit),
        };
      })
      .filter(category => category.items.length > 0),
    visibleSearchTabs: configs
      .filter(cfg => fullByCategory[cfg.id].length > 0)
      .map(cfg => ({ id: cfg.id, cfg, items: fullByCategory[cfg.id] })),
  };
}

describe('Perps market grouping', () => {
  it('preserves category order, full search lists, Home limits and item identity', () => {
    const sorted = Array.from({ length: 12 }, (_, i) =>
      market(`COIN${i}`, 'meme'),
    );
    const configs = [
      config('favorite', null),
      config('topVolume'),
      config('meme'),
      config('empty'),
    ];
    const favorites = ['coin9', 'COIN1', 'coin9', 'MISSING'];
    const result = groupPerpsMarkets(sorted, favorites, configs);
    expect(result).toEqual(previousGroups(sorted, favorites, configs));
    expect(result.fullByCategory.topVolume).toBe(sorted);
    expect(result.fullByCategory.favorite).toEqual([sorted[1], sorted[9]]);
    expect(
      result.visibleHome.find(item => item.id === 'meme')?.items,
    ).toHaveLength(5);
    expect(result.fullByCategory.meme[7]).toBe(sorted[7]);
    expect(sorted).toHaveLength(12);
  });

  it.each([0, 1, 80, 1000])(
    'matches the former implementation for %i markets',
    count => {
      const sorted = Array.from({ length: count }, (_, i) =>
        market(
          `coin${i}`,
          [undefined, '', 'favorite', 'topVolume', 'meme', 'stock', 'unknown'][
            i % 7
          ],
        ),
      );
      const configs = [
        config('favorite', null),
        config('topVolume'),
        config('meme'),
        config('stock', 0),
        config(''),
        config('empty'),
        config('meme', 3),
      ];
      const favorites = sorted
        .filter((_, i) => i % 3 === 0)
        .map(item => item.name.toUpperCase());
      expect(groupPerpsMarkets(sorted, favorites, configs)).toEqual(
        previousGroups(sorted, favorites, configs),
      );
    },
  );

  it('reads each category once rather than once per configured category', () => {
    const readCategory = jest.fn(() => 'category0');
    const sorted = Array.from(
      { length: 200 },
      (_, i) =>
        ({
          name: `coin${i}`,
          get categoryId() {
            return readCategory();
          },
        } as MarketData),
    );
    const configs = [
      config('favorite'),
      config('topVolume'),
      ...Array.from({ length: 8 }, (_, i) => config(`category${i}`)),
    ];
    const previous = previousGroups(sorted, [], configs);
    expect(readCategory).toHaveBeenCalledTimes(1600);
    readCategory.mockClear();
    const current = groupPerpsMarkets(sorted, [], configs);
    expect(readCategory).toHaveBeenCalledTimes(200);
    expect(current).toEqual(previous);
  });
});
