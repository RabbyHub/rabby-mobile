import type { PerpsBookPrecision } from '@/hooks/perps/subscriptions/perpsBookTypes';

import type { PerpsProSortDirection, PerpsProSortField } from '../model/market';

export type PerpsProMarketSessionSnapshot = {
  marketKey: string | null;
  sortDirection: PerpsProSortDirection;
  sortField: PerpsProSortField;
};

let snapshot: PerpsProMarketSessionSnapshot = {
  marketKey: null,
  sortDirection: 'desc',
  sortField: 'volume',
};
const bookPrecisionByMarket = new Map<string, PerpsBookPrecision>();

export const getPerpsProMarketSession = () => snapshot;

export const setPerpsProSessionMarket = (marketKey: string) => {
  snapshot = { ...snapshot, marketKey };
};

export const setPerpsProSessionSort = (
  sortField: PerpsProSortField,
  sortDirection: PerpsProSortDirection,
) => {
  snapshot = { ...snapshot, sortDirection, sortField };
};

export const getPerpsProSessionBookPrecision = (
  marketKey: string,
): PerpsBookPrecision | null => {
  const precision = bookPrecisionByMarket.get(marketKey);
  return precision ? { ...precision } : null;
};

export const setPerpsProSessionBookPrecision = (
  marketKey: string,
  precision: PerpsBookPrecision,
) => {
  bookPrecisionByMarket.set(marketKey, { ...precision });
};

export const resetPerpsProMarketSessionForTests = () => {
  snapshot = {
    marketKey: null,
    sortDirection: 'desc',
    sortField: 'volume',
  };
  bookPrecisionByMarket.clear();
};
