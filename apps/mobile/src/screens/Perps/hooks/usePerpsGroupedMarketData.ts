import { useMemo } from 'react';
import { sortBy } from 'lodash';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import {
  PERPS_CATEGORIES,
  PerpsCategoryId,
  isCategoryMatch,
  PERPS_CATEGORY_MAP,
} from '../constants/perpsCategories';

export type VisibleCategory = {
  id: PerpsCategoryId;
  items: MarketData[];
};

const sortByVolDesc = (list: MarketData[]) =>
  sortBy(list, item => -(Number(item.dayNtlVlm) || 0));

export function usePerpsGroupedMarketData(params: {
  marketData: MarketData[];
  favoriteMarkets: string[];
}) {
  const { marketData, favoriteMarkets } = params;

  return useMemo(() => {
    const favSet = new Set(favoriteMarkets.map(s => s.toUpperCase()));

    const volSorted = sortByVolDesc(marketData);

    const fullByCategory: Record<PerpsCategoryId, MarketData[]> = {
      favorite: volSorted.filter(item => favSet.has(item.name.toUpperCase())),
      topVolume: volSorted,
      stocks: [],
      commodities: [],
      indices: [],
      fx: [],
    };

    (['stocks', 'commodities', 'indices', 'fx'] as const).forEach(id => {
      const cfg = PERPS_CATEGORY_MAP[id];
      fullByCategory[id] = volSorted.filter(item => isCategoryMatch(cfg, item));
    });

    const visibleHome: VisibleCategory[] = PERPS_CATEGORIES.map(cfg => {
      const all = fullByCategory[cfg.id];
      const limit = cfg.homeLimit;
      const items = limit == null ? all : all.slice(0, limit);
      return { id: cfg.id, items };
    }).filter(c => c.items.length > 0);

    const visibleSearchTabs: PerpsCategoryId[] = PERPS_CATEGORIES.filter(
      cfg => fullByCategory[cfg.id].length > 0,
    ).map(cfg => cfg.id);

    return { fullByCategory, visibleHome, visibleSearchTabs };
  }, [marketData, favoriteMarkets]);
}
