import type { MarketData } from '@/hooks/perps/usePerpsStore';
import type { PerpsCategoryConfig } from '../constants/perpsCategories';

export type VisibleCategory = {
  id: string;
  cfg: PerpsCategoryConfig;
  items: MarketData[];
};

// The caller owns the volume sort. One pass distributes that same stable order
// to every category, instead of scanning all markets once per category.
export function groupPerpsMarkets(
  volumeSorted: MarketData[],
  favoriteMarkets: string[],
  configs: PerpsCategoryConfig[],
) {
  const favorites = new Set(favoriteMarkets.map(name => name.toUpperCase()));
  const buckets = new Map<string, MarketData[]>(
    configs.map(cfg => [cfg.id, []]),
  );
  const favoriteItems = buckets.get('favorite');
  buckets.set('topVolume', volumeSorted);

  for (const item of volumeSorted) {
    if (favoriteItems && favorites.has(item.name.toUpperCase())) {
      favoriteItems.push(item);
    }
    // Synthetic categories must not also receive categoryId matches.
    const categoryId = item.categoryId;
    if (
      categoryId !== undefined &&
      categoryId !== 'favorite' &&
      categoryId !== 'topVolume'
    ) {
      buckets.get(categoryId)?.push(item);
    }
  }

  const fullByCategory: Record<string, MarketData[]> = Object.fromEntries(
    configs.map(cfg => [cfg.id, buckets.get(cfg.id)!]),
  );
  const visibleHome: VisibleCategory[] = [];
  const visibleSearchTabs: VisibleCategory[] = [];
  for (const cfg of configs) {
    const all = fullByCategory[cfg.id];
    if (!all.length) {
      continue;
    }
    visibleSearchTabs.push({ id: cfg.id, cfg, items: all });
    const items = cfg.homeLimit == null ? all : all.slice(0, cfg.homeLimit);
    if (items.length) {
      visibleHome.push({ id: cfg.id, cfg, items });
    }
  }
  return { fullByCategory, visibleHome, visibleSearchTabs };
}
