import type { MarketData, MarketDataMap } from '@/hooks/perps/usePerpsStore';

import {
  buildPerpsProMarket,
  buildPerpsProMarketDescriptor,
  buildPerpsProMarketKey,
  comparePerpsProMarketOrder,
  getPerpsProMarketVolume24h,
  type PerpsProMarket,
  type PerpsProSortDirection,
  type PerpsProSortField,
  type PerpsProSortableMarket,
} from './market';

export type PerpsProMarketRowModel = Readonly<{
  canonicalCoin: string;
  change24h: number | null;
  displayPair: string;
  fullName: string | null;
  logoUrl: string;
  marketKey: string;
  price: number | null;
  pxDecimals: number;
  sourceTag: string | null;
  volume24h: number | null;
}>;

export type PerpsProMarketSlot = Readonly<{
  // The canonical coin resolves the latest source through marketDataMap.
  canonicalCoin: string;
  // Business identity. All row content and actions must resolve through this key.
  marketKey: string;
  // Physical VirtualizedList identity. It is stable for the current row position.
  slotKey: string;
}>;

type PerpsProMarketSelectorSourceFields = Readonly<
  Pick<
    MarketData,
    | 'brief'
    | 'categoryId'
    | 'dayNtlVlm'
    | 'dexId'
    | 'displayName'
    | 'name'
    | 'quoteAsset'
  >
>;

type PerpsProMarketSelectorRecord = PerpsProSortableMarket &
  Readonly<{
    canonicalCoin: string;
    canonicalCoinUpper: string;
    categoryId: string | null;
    searchValues: readonly string[];
    sourceFields: PerpsProMarketSelectorSourceFields;
  }>;

export type PerpsProMarketOrders<T> = Readonly<{
  name: Readonly<Record<PerpsProSortDirection, readonly T[]>>;
  volume: Readonly<Record<PerpsProSortDirection, readonly T[]>>;
}>;

export type PerpsProMarketSelectorProjection = Readonly<{
  categoryIds: ReadonlySet<string>;
  orders: PerpsProMarketOrders<string>;
  recordsByKey: ReadonlyMap<string, PerpsProMarketSelectorRecord>;
}>;

const EMPTY_ORDERS: PerpsProMarketOrders<string> = {
  name: {
    asc: [],
    desc: [],
  },
  volume: {
    asc: [],
    desc: [],
  },
};

export const EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION: PerpsProMarketSelectorProjection =
  {
    categoryIds: new Set(),
    orders: EMPTY_ORDERS,
    recordsByKey: new Map(),
  };

const haveSameRecordSourceFields = (
  previous: PerpsProMarketSelectorSourceFields,
  next: MarketData,
) =>
  previous.name === next.name &&
  previous.displayName === next.displayName &&
  previous.quoteAsset === next.quoteAsset &&
  previous.dexId === next.dexId &&
  previous.brief === next.brief &&
  previous.categoryId === next.categoryId &&
  previous.dayNtlVlm === next.dayNtlVlm;

const buildSourceFields = (
  source: MarketData,
): PerpsProMarketSelectorSourceFields => ({
  brief: source.brief,
  categoryId: source.categoryId,
  dayNtlVlm: source.dayNtlVlm,
  dexId: source.dexId,
  displayName: source.displayName,
  name: source.name,
  quoteAsset: source.quoteAsset,
});

const buildRecord = (source: MarketData): PerpsProMarketSelectorRecord => {
  const descriptor = buildPerpsProMarketDescriptor(source);
  return {
    canonicalCoin: descriptor.canonicalCoin,
    canonicalCoinUpper: descriptor.canonicalCoin.toUpperCase(),
    categoryId: source.categoryId ?? null,
    displayPair: descriptor.displayPair,
    marketKey: descriptor.marketKey,
    searchValues: [
      descriptor.canonicalCoin,
      descriptor.displayBase,
      descriptor.displayPair,
      descriptor.quoteAsset,
      descriptor.sourceTag,
      descriptor.fullName,
    ]
      .filter((value): value is string => !!value)
      .map(value => value.toLocaleLowerCase()),
    sourceFields: buildSourceFields(source),
    volume24h: getPerpsProMarketVolume24h(source),
  };
};

export const buildPerpsProMarketRowModel = (
  source: MarketData,
): PerpsProMarketRowModel => {
  const market = buildPerpsProMarket(source);
  return {
    canonicalCoin: market.canonicalCoin,
    change24h: market.change24h,
    displayPair: market.displayPair,
    fullName: market.fullName,
    logoUrl: source.logoUrl,
    marketKey: market.marketKey,
    price: market.price,
    pxDecimals: source.pxDecimals,
    sourceTag: market.sourceTag,
    volume24h: market.volume24h,
  };
};

const haveSameSetValues = (
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
) => {
  if (previous.size !== next.size) {
    return false;
  }
  for (const value of next) {
    if (!previous.has(value)) {
      return false;
    }
  }
  return true;
};

const haveSameCatalog = (
  previous: ReadonlyMap<string, PerpsProMarketSelectorRecord>,
  next: ReadonlyMap<string, PerpsProMarketSelectorRecord>,
) => {
  if (previous.size !== next.size) {
    return false;
  }
  for (const key of next.keys()) {
    if (!previous.has(key)) {
      return false;
    }
  }
  return true;
};

const canReuseOrder = (
  previous: ReadonlyMap<string, PerpsProMarketSelectorRecord>,
  next: ReadonlyMap<string, PerpsProMarketSelectorRecord>,
  field: PerpsProSortField,
) => {
  if (!haveSameCatalog(previous, next)) {
    return false;
  }
  for (const [key, record] of next) {
    const previousRecord = previous.get(key);
    const unchanged =
      field === 'name'
        ? previousRecord?.displayPair === record.displayPair
        : previousRecord?.volume24h === record.volume24h;
    if (!unchanged) {
      return false;
    }
  }
  return true;
};

const buildOrder = (
  records: ReadonlyMap<string, PerpsProMarketSelectorRecord>,
  field: PerpsProSortField,
  direction: PerpsProSortDirection,
) =>
  Array.from(records.values())
    .sort((left, right) =>
      comparePerpsProMarketOrder(left, right, field, direction),
    )
    .map(record => record.marketKey);

const canReuseProjection = (
  marketData: readonly MarketData[],
  previous: PerpsProMarketSelectorProjection,
) => {
  if (marketData.length !== previous.recordsByKey.size) {
    return false;
  }
  const previousRecords = previous.recordsByKey.values();
  for (const source of marketData) {
    const previousRecord = previousRecords.next().value;
    if (
      !previousRecord ||
      !haveSameRecordSourceFields(previousRecord.sourceFields, source)
    ) {
      return false;
    }
  }
  return true;
};

export const reconcilePerpsProMarketSelectorProjection = (
  marketData: readonly MarketData[],
  previous: PerpsProMarketSelectorProjection = EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION,
): PerpsProMarketSelectorProjection => {
  // Fast mark/mid frames replace marketData but do not affect the selector
  // catalogue. Return the exact previous snapshot so a closed selector and its
  // FlatList do not render on those frames.
  if (canReuseProjection(marketData, previous)) {
    return previous;
  }

  const nextRecordsByKey = new Map<string, PerpsProMarketSelectorRecord>();
  marketData.forEach(source => {
    const marketKey = buildPerpsProMarketKey(source.dexId, source.name);
    const previousRecord = previous.recordsByKey.get(marketKey);
    const record =
      previousRecord &&
      haveSameRecordSourceFields(previousRecord.sourceFields, source)
        ? previousRecord
        : buildRecord(source);
    nextRecordsByKey.set(marketKey, record);
  });

  const nextCategoryIds = new Set<string>();
  nextRecordsByKey.forEach(record => {
    if (record.categoryId) {
      nextCategoryIds.add(record.categoryId);
    }
  });
  const categoryIds = haveSameSetValues(previous.categoryIds, nextCategoryIds)
    ? previous.categoryIds
    : nextCategoryIds;
  const reuseNameOrder = canReuseOrder(
    previous.recordsByKey,
    nextRecordsByKey,
    'name',
  );
  const reuseVolumeOrder = canReuseOrder(
    previous.recordsByKey,
    nextRecordsByKey,
    'volume',
  );
  const nameOrders = reuseNameOrder
    ? previous.orders.name
    : {
        asc: buildOrder(nextRecordsByKey, 'name', 'asc'),
        desc: buildOrder(nextRecordsByKey, 'name', 'desc'),
      };
  const volumeOrders = reuseVolumeOrder
    ? previous.orders.volume
    : {
        asc: buildOrder(nextRecordsByKey, 'volume', 'asc'),
        desc: buildOrder(nextRecordsByKey, 'volume', 'desc'),
      };
  const orders =
    nameOrders === previous.orders.name &&
    volumeOrders === previous.orders.volume
      ? previous.orders
      : {
          name: nameOrders,
          volume: volumeOrders,
        };

  return {
    categoryIds,
    orders,
    recordsByKey: nextRecordsByKey,
  };
};

const buildSlots = (
  order: readonly string[],
  eligibleKeys: ReadonlySet<string>,
  recordsByKey: ReadonlyMap<string, PerpsProMarketSelectorRecord>,
): readonly PerpsProMarketSlot[] => {
  const slots: PerpsProMarketSlot[] = [];
  order.forEach(marketKey => {
    if (!eligibleKeys.has(marketKey)) {
      return;
    }
    const record = recordsByKey.get(marketKey);
    if (!record) {
      return;
    }
    slots.push({
      canonicalCoin: record.canonicalCoin,
      marketKey,
      slotKey: `slot:${slots.length}`,
    });
  });
  return slots;
};

export const buildPerpsProMarketSlotOrders = (
  projection: Pick<PerpsProMarketSelectorProjection, 'orders' | 'recordsByKey'>,
  tab: string,
  favoriteMarkets: readonly string[],
  query: string,
): PerpsProMarketOrders<PerpsProMarketSlot> => {
  const favoriteSet = new Set(favoriteMarkets.map(item => item.toUpperCase()));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const eligibleKeys = new Set<string>();

  projection.recordsByKey.forEach(record => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'favorites'
        ? favoriteSet.has(record.canonicalCoinUpper)
        : record.categoryId === tab);
    const matchesQuery =
      !normalizedQuery ||
      record.searchValues.some(value => value.includes(normalizedQuery));
    if (matchesTab && matchesQuery) {
      eligibleKeys.add(record.marketKey);
    }
  });

  return {
    name: {
      asc: buildSlots(
        projection.orders.name.asc,
        eligibleKeys,
        projection.recordsByKey,
      ),
      desc: buildSlots(
        projection.orders.name.desc,
        eligibleKeys,
        projection.recordsByKey,
      ),
    },
    volume: {
      asc: buildSlots(
        projection.orders.volume.asc,
        eligibleKeys,
        projection.recordsByKey,
      ),
      desc: buildSlots(
        projection.orders.volume.desc,
        eligibleKeys,
        projection.recordsByKey,
      ),
    },
  };
};

export const resolvePerpsProMarketFromLatestData = (
  projection: Pick<PerpsProMarketSelectorProjection, 'recordsByKey'>,
  marketDataMap: MarketDataMap,
  marketKey: string,
): PerpsProMarket | null => {
  const record = projection.recordsByKey.get(marketKey);
  const source = record ? marketDataMap[record.canonicalCoin] : undefined;
  if (
    !source ||
    buildPerpsProMarketKey(source.dexId, source.name) !== marketKey
  ) {
    return null;
  }
  return buildPerpsProMarket(source);
};
