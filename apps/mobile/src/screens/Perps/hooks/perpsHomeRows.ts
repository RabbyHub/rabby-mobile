import { sortBy } from 'lodash';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import type { PerpsCategoryConfig } from '../constants/perpsCategories';
import { groupPerpsMarkets } from './groupPerpsMarkets';

export type PerpsHomeRow =
  | { key: string; type: 'category'; cfg: PerpsCategoryConfig }
  | {
      key: string;
      type: 'market';
      marketName: string;
      rank?: number;
      first: boolean;
      last: boolean;
    };

type HomeMarketState = {
  marketData: MarketData[];
  favoriteMarkets: string[];
};

// The list owns membership/order, not quotes. Re-evaluate the existing ranking
// rule on every market publication, but publish new list data only if its
// structure changes. Mounted rows subscribe to their own current market.
export function createPerpsHomeRowsSelector(configs: PerpsCategoryConfig[]) {
  let previousMarkets: MarketData[] | undefined;
  let previousFavorites: string[] | undefined;
  let previousRows: PerpsHomeRow[] = [];

  return (state: HomeMarketState): PerpsHomeRow[] => {
    if (
      state.marketData === previousMarkets &&
      state.favoriteMarkets === previousFavorites
    ) {
      return previousRows;
    }
    previousMarkets = state.marketData;
    previousFavorites = state.favoriteMarkets;
    const sorted = sortBy(
      state.marketData,
      item => -(Number(item.dayNtlVlm) || 0),
    );
    const { visibleHome } = groupPerpsMarkets(
      sorted,
      state.favoriteMarkets,
      configs,
    );
    const rows = visibleHome.flatMap<PerpsHomeRow>(cat => [
      { key: JSON.stringify([cat.id]), type: 'category', cfg: cat.cfg },
      ...cat.items.map(
        (market, index): PerpsHomeRow => ({
          key: JSON.stringify([cat.id, market.name]),
          type: 'market',
          marketName: market.name,
          rank: cat.cfg.showRankOnHome ? index + 1 : undefined,
          first: index === 0,
          last: index === cat.items.length - 1,
        }),
      ),
    ]);
    if (
      rows.length !== previousRows.length ||
      rows.some((row, index) => {
        const previous = previousRows[index];
        return (
          row.key !== previous.key ||
          (row.type === 'category'
            ? previous.type !== 'category' || row.cfg !== previous.cfg
            : previous.type !== 'market' ||
              row.rank !== previous.rank ||
              row.first !== previous.first ||
              row.last !== previous.last)
        );
      })
    ) {
      previousRows = rows;
    }
    return previousRows;
  };
}
