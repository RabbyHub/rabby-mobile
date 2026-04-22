import type { MarketData } from '@/hooks/perps/usePerpsStore';

export type PerpsCategoryId =
  | 'favorite'
  | 'topVolume'
  | 'stocks'
  | 'commodities'
  | 'indices'
  | 'fx';

export type PerpsCategoryConfig = {
  id: PerpsCategoryId;
  labelI18nKey: string;
  homeLimit: number | null;
  showRankOnHome: boolean;
  showRankOnSearch: boolean;
  /** Set to true for synthetic categories (favorite/topVolume) that aren't
   *  matched against `item.category`. */
  synthetic?: boolean;
};

export const PERPS_CATEGORIES: PerpsCategoryConfig[] = [
  {
    id: 'favorite',
    labelI18nKey: 'page.perps.categories.favorite',
    homeLimit: null,
    showRankOnHome: false,
    showRankOnSearch: false,
    synthetic: true,
  },
  {
    id: 'topVolume',
    labelI18nKey: 'page.perps.categories.topVolume',
    homeLimit: 5,
    showRankOnHome: true,
    showRankOnSearch: true,
    synthetic: true,
  },
  {
    id: 'stocks',
    labelI18nKey: 'page.perps.categories.stocks',
    homeLimit: 3,
    showRankOnHome: false,
    showRankOnSearch: false,
  },
  {
    id: 'commodities',
    labelI18nKey: 'page.perps.categories.commodities',
    homeLimit: 3,
    showRankOnHome: false,
    showRankOnSearch: false,
  },
  {
    id: 'indices',
    labelI18nKey: 'page.perps.categories.indices',
    homeLimit: 3,
    showRankOnHome: false,
    showRankOnSearch: false,
  },
  {
    id: 'fx',
    labelI18nKey: 'page.perps.categories.fx',
    homeLimit: 3,
    showRankOnHome: false,
    showRankOnSearch: false,
  },
];

export const PERPS_CATEGORY_MAP = PERPS_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c }),
  {} as Record<PerpsCategoryId, PerpsCategoryConfig>,
);

export const isCategoryMatch = (
  cfg: PerpsCategoryConfig,
  item: MarketData,
): boolean => {
  if (cfg.synthetic || !item.category) {
    return false;
  }
  return item.category.toLowerCase() === cfg.id.toLowerCase();
};
