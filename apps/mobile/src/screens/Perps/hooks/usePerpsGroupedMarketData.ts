import { useMemo } from 'react';
import { sortBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import type { PerpTopTokenCategory } from '@rabby-wallet/rabby-api/dist/types';
import { useAppLanguage } from '@/hooks/lang';
import {
  PerpsCategoryConfig,
  PerpsCategoryId,
} from '../constants/perpsCategories';
import { groupPerpsMarkets } from './groupPerpsMarkets';
export type { VisibleCategory } from './groupPerpsMarkets';

type BuiltinSpec = {
  id: PerpsCategoryId;
  i18nKey: string;
  homeLimit: number | null;
  showRankOnHome: boolean;
  showRankOnSearch: boolean;
};

// Home modules preview this many pairs (favorites are the exception and show
// everything); the full list lives on the search page's matching tab.
const HOME_CATEGORY_LIMIT = 5;

const BUILTIN_SPECS: BuiltinSpec[] = [
  {
    id: 'favorite',
    i18nKey: 'page.perps.categories.favorite',
    homeLimit: null,
    showRankOnHome: false,
    showRankOnSearch: false,
  },
  {
    id: 'topVolume',
    i18nKey: 'page.perps.categories.topVolume',
    homeLimit: HOME_CATEGORY_LIMIT,
    showRankOnHome: true,
    showRankOnSearch: true,
  },
];

const sortByVolDesc = (list: MarketData[]) =>
  sortBy(list, item => -(Number(item.dayNtlVlm) || 0));

export function usePerpsGroupedMarketData(params: {
  marketData: MarketData[];
  favoriteMarkets: string[];
  backendCategories: PerpTopTokenCategory[];
}) {
  const { marketData, favoriteMarkets, backendCategories } = params;
  const { t } = useTranslation();
  const { currentLanguage } = useAppLanguage();

  const volumeSorted = useMemo(() => sortByVolDesc(marketData), [marketData]);
  const configs = useMemo<PerpsCategoryConfig[]>(
    () => [
      ...BUILTIN_SPECS.map<PerpsCategoryConfig>(b => ({
        id: b.id,
        label: t(b.i18nKey),
        homeLimit: b.homeLimit,
        showRankOnHome: b.showRankOnHome,
        showRankOnSearch: b.showRankOnSearch,
        synthetic: true,
      })),
      ...(backendCategories ?? []).map<PerpsCategoryConfig>(c => ({
        id: c.id,
        label: c.translations?.[currentLanguage] ?? c.name ?? c.id,
        homeLimit: HOME_CATEGORY_LIMIT,
        showRankOnHome: false,
        showRankOnSearch: false,
      })),
    ],
    [backendCategories, t, currentLanguage],
  );

  return useMemo(
    () => groupPerpsMarkets(volumeSorted, favoriteMarkets, configs),
    [volumeSorted, favoriteMarkets, configs],
  );
}
