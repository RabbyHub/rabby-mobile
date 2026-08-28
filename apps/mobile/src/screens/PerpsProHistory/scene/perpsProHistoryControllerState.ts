import {
  PERPS_PRO_HISTORY_CASHFLOW_LIMIT,
  PERPS_PRO_HISTORY_ORDERS_LIMIT,
  PERPS_PRO_HISTORY_TRADE_LIMIT,
  PERPS_PRO_HISTORY_WINDOW_MS,
} from '../constants';
import type {
  PerpsProHistoryRow,
  PerpsProHistoryTab,
  PerpsProHistoryTabState,
  PerpsProHistoryWindow,
} from '../types';

export type PerpsProHistoryControllerState = Record<
  PerpsProHistoryTab,
  PerpsProHistoryTabState
>;

export type UpdatePerpsProHistoryTabState = (
  tab: PerpsProHistoryTab,
  updater: (previous: PerpsProHistoryTabState) => PerpsProHistoryTabState,
) => void;

export const PERPS_PRO_HISTORY_TABS: PerpsProHistoryTab[] = [
  'orders',
  'trade',
  'transaction',
  'funding',
];

const createTabState = (): PerpsProHistoryTabState => ({
  hasEarlier: false,
  loadingEarlier: false,
  refreshing: false,
  rows: [],
  status: 'idle',
});

export const createPerpsProHistoryState =
  (): PerpsProHistoryControllerState => ({
    funding: createTabState(),
    orders: createTabState(),
    trade: createTabState(),
    transaction: createTabState(),
  });

export const getPerpsProHistoryRowsStatus = (
  rows: readonly PerpsProHistoryRow[],
) => (rows.length > 0 ? ('ready' as const) : ('empty' as const));

export const getPerpsProHistoryOldestTime = (
  rows: readonly PerpsProHistoryRow[],
) =>
  rows.length > 0
    ? rows.reduce((oldest, row) => Math.min(oldest, row.time), rows[0].time)
    : undefined;

export const getPerpsProHistoryTabLimit = (tab: PerpsProHistoryTab) => {
  switch (tab) {
    case 'orders':
      return PERPS_PRO_HISTORY_ORDERS_LIMIT;
    case 'trade':
      return PERPS_PRO_HISTORY_TRADE_LIMIT;
    case 'transaction':
    case 'funding':
      return PERPS_PRO_HISTORY_CASHFLOW_LIMIT;
  }
};

export const makePerpsProHistoryEarlierWindow = (
  state: PerpsProHistoryTabState,
): PerpsProHistoryWindow | null => {
  const endTime = state.coveredWindow?.startTime ?? state.oldestLoadedTime;
  if (endTime == null) {
    return null;
  }
  return {
    endTime,
    startTime: Math.max(0, endTime - PERPS_PRO_HISTORY_WINDOW_MS),
  };
};
