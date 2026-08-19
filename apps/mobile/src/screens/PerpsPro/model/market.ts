import type { PerpTopTokenCategory } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

const PerpsMarketBigNumber = BigNumber.clone({ DECIMAL_PLACES: 40 });

export type PerpsProMarket = {
  canonicalCoin: string;
  change24h: number | null;
  displayBase: string;
  displayPair: string;
  fullName: string | null;
  marketData: MarketData;
  marketKey: string;
  price: number | null;
  quoteAsset: MarketData['quoteAsset'];
  sourceTag: string | null;
  volume24h: number | null;
};

export type PerpsProMarketDescriptor = Pick<
  PerpsProMarket,
  | 'canonicalCoin'
  | 'displayBase'
  | 'displayPair'
  | 'fullName'
  | 'marketKey'
  | 'quoteAsset'
  | 'sourceTag'
>;

export type PerpsProCategory = {
  id: string;
  label: string;
  priority: number;
};

export type PerpsProMarketTab = 'favorites' | 'all' | string;
export type PerpsProSortField = 'name' | 'volume';
export type PerpsProSortDirection = 'asc' | 'desc';
export type PerpsProMarketsByKey = ReadonlyMap<string, PerpsProMarket>;
export type PerpsProSortableMarket = Pick<
  PerpsProMarket,
  'displayPair' | 'marketKey' | 'volume24h'
>;

export type ReconciledPerpsProMarkets = {
  markets: PerpsProMarket[];
  marketsByKey: PerpsProMarketsByKey;
};

const createCollator = (options: Intl.CollatorOptions) => {
  if (typeof Intl === 'undefined' || typeof Intl.Collator !== 'function') {
    return null;
  }
  try {
    return new Intl.Collator('en', options);
  } catch {
    return null;
  }
};

// Creating collation options inside every Array.sort comparison is
// disproportionately expensive on mobile JS engines. These comparators keep
// the exact locale/options contract while paying initialization only once,
// before the selector can be opened.
const PERPS_PRO_BASE_COLLATOR = createCollator({ sensitivity: 'base' });
const PERPS_PRO_CASE_COLLATOR = createCollator({ sensitivity: 'case' });

const compareBaseText = (left: string, right: string) =>
  PERPS_PRO_BASE_COLLATOR?.compare(left, right) ??
  left.localeCompare(right, 'en', { sensitivity: 'base' });

const compareCaseText = (left: string, right: string) =>
  PERPS_PRO_CASE_COLLATOR?.compare(left, right) ??
  left.localeCompare(right, 'en', { sensitivity: 'case' });

const formatCanonicalBase = (coin: string) =>
  coin.includes(':') ? coin.split(':')[1] || '' : coin;

const toFiniteNumber = (value: string | number | undefined) => {
  if (value === '' || value == null) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const buildPerpsProMarketKey = (dexId: string, canonicalCoin: string) =>
  `${dexId || 'hyperliquid'}::${canonicalCoin}`;

export const getPerpsProMarketFullName = (marketData: MarketData) =>
  marketData.brief?.trim() || null;

export const calculatePerpsProChange24h = (marketData: MarketData) => {
  const markPrice = new PerpsMarketBigNumber(marketData.markPx || Number.NaN);
  const previousPrice = new PerpsMarketBigNumber(
    marketData.prevDayPx || Number.NaN,
  );
  if (
    !markPrice.isFinite() ||
    !previousPrice.isFinite() ||
    !previousPrice.isGreaterThan(0)
  ) {
    return null;
  }
  const change = markPrice.minus(previousPrice).dividedBy(previousPrice);
  const result = change.toNumber();
  return Number.isFinite(result) ? result : null;
};

export const getPerpsProMarketVolume24h = (marketData: MarketData) => {
  const volume = toFiniteNumber(marketData.dayNtlVlm);
  return volume != null && volume >= 0 ? volume : null;
};

export const buildPerpsProMarketDescriptor = (
  marketData: MarketData,
): PerpsProMarketDescriptor => {
  const displayBase =
    formatCanonicalBase(marketData.displayName || marketData.name).trim() ||
    formatCanonicalBase(marketData.name).trim();
  return {
    canonicalCoin: marketData.name,
    displayBase,
    displayPair: `${displayBase}${marketData.quoteAsset}`,
    fullName: getPerpsProMarketFullName(marketData),
    marketKey: buildPerpsProMarketKey(marketData.dexId, marketData.name),
    quoteAsset: marketData.quoteAsset,
    sourceTag: marketData.dexId.trim() || null,
  };
};

export const buildPerpsProMarket = (marketData: MarketData): PerpsProMarket => {
  const descriptor = buildPerpsProMarketDescriptor(marketData);
  const price = toFiniteNumber(marketData.markPx);
  return {
    ...descriptor,
    change24h: calculatePerpsProChange24h(marketData),
    marketData,
    price,
    volume24h: getPerpsProMarketVolume24h(marketData),
  };
};

export const buildPerpsProMarkets = (marketData: MarketData[]) =>
  marketData.map(buildPerpsProMarket);

export const reconcilePerpsProMarkets = (
  marketData: readonly MarketData[],
  previousMarketsByKey: PerpsProMarketsByKey = new Map(),
): ReconciledPerpsProMarkets => {
  const markets: PerpsProMarket[] = [];
  const marketsByKey = new Map<string, PerpsProMarket>();

  marketData.forEach(source => {
    const marketKey = buildPerpsProMarketKey(source.dexId, source.name);
    const previousMarket = previousMarketsByKey.get(marketKey);
    const market =
      previousMarket?.marketData === source
        ? previousMarket
        : buildPerpsProMarket(source);

    markets.push(market);
    marketsByKey.set(marketKey, market);
  });

  return {
    markets,
    marketsByKey,
  };
};

export const buildVisiblePerpsProCategoriesFromIds = (
  categories: PerpTopTokenCategory[],
  presentIds: ReadonlySet<string>,
  language?: string,
): PerpsProCategory[] => {
  return categories
    .filter(category => !category.is_disable && presentIds.has(category.id))
    .map(category => ({
      id: category.id,
      label:
        (language ? category.translations?.[language] : undefined) ||
        category.name ||
        category.id,
      priority: Number.isFinite(category.priority)
        ? category.priority
        : Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.priority - b.priority || compareBaseText(a.id, b.id));
};

export const buildVisiblePerpsProCategories = (
  categories: PerpTopTokenCategory[],
  markets: PerpsProMarket[],
  language?: string,
): PerpsProCategory[] =>
  buildVisiblePerpsProCategoriesFromIds(
    categories,
    new Set(
      markets
        .map(item => item.marketData.categoryId)
        .filter((id): id is string => !!id),
    ),
    language,
  );

export const filterPerpsProMarketsByTab = (
  markets: PerpsProMarket[],
  tab: PerpsProMarketTab,
  favoriteMarkets: string[],
) => {
  if (tab === 'all') {
    return markets;
  }
  if (tab === 'favorites') {
    const favoriteSet = new Set(
      favoriteMarkets.map(item => item.toUpperCase()),
    );
    return markets.filter(item =>
      favoriteSet.has(item.canonicalCoin.toUpperCase()),
    );
  }
  return markets.filter(item => item.marketData.categoryId === tab);
};

export const searchPerpsProMarkets = (
  markets: PerpsProMarket[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return markets;
  }
  return markets.filter(item =>
    [
      item.canonicalCoin,
      item.displayBase,
      item.displayPair,
      item.quoteAsset,
      item.sourceTag,
      item.fullName,
    ].some(value => value?.toLocaleLowerCase().includes(normalizedQuery)),
  );
};

const compareNullableNumber = (
  left: number | null,
  right: number | null,
  direction: PerpsProSortDirection,
) => {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return direction === 'asc' ? left - right : right - left;
};

export const comparePerpsProMarketOrder = (
  left: PerpsProSortableMarket,
  right: PerpsProSortableMarket,
  field: PerpsProSortField,
  direction: PerpsProSortDirection,
) => {
  const primary =
    field === 'volume'
      ? compareNullableNumber(left.volume24h, right.volume24h, direction)
      : (direction === 'asc' ? 1 : -1) *
        compareBaseText(left.displayPair, right.displayPair);
  return primary || compareCaseText(left.marketKey, right.marketKey);
};

export const sortPerpsProMarkets = (
  markets: PerpsProMarket[],
  field: PerpsProSortField,
  direction: PerpsProSortDirection,
) =>
  [...markets].sort((left, right) =>
    comparePerpsProMarketOrder(left, right, field, direction),
  );

export const getNextPerpsProSort = (
  currentField: PerpsProSortField,
  currentDirection: PerpsProSortDirection,
  nextField: PerpsProSortField,
) => {
  if (currentField !== nextField) {
    return {
      field: nextField,
      direction: nextField === 'name' ? ('asc' as const) : ('desc' as const),
    };
  }
  return {
    field: currentField,
    direction:
      currentDirection === 'asc' ? ('desc' as const) : ('asc' as const),
  };
};
