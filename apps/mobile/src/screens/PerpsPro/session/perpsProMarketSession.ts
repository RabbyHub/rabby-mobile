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

export const resetPerpsProMarketSessionForTests = () => {
  snapshot = {
    marketKey: null,
    sortDirection: 'desc',
    sortField: 'volume',
  };
};
