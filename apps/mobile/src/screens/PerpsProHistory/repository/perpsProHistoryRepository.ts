import type {
  UserFunding,
  UserHistoricalOrders,
  UserNonFundingLedgerUpdates,
  WsFill,
  WsUserFunding,
  WsUserHistoricalOrders,
} from '@rabby-wallet/hyperliquid-sdk';

import { apisPerps } from '@/core/apis/perps';
import { getFillKey } from '@/hooks/perps/userFills';

import {
  PERPS_PRO_HISTORY_CASHFLOW_INITIAL_LIMIT,
  PERPS_PRO_HISTORY_LEDGER_PAGE_HINT,
  PERPS_PRO_HISTORY_MAX_NARROW_ATTEMPTS,
  PERPS_PRO_HISTORY_MAX_WINDOW_REQUESTS,
  PERPS_PRO_HISTORY_ORDERS_LIMIT,
  PERPS_PRO_HISTORY_TRADE_INITIAL_LIMIT,
  PERPS_PRO_HISTORY_TRADE_PAGE_HINT,
} from '../constants';
import { getPerpsProFundingHistoryKey } from '../model/fundingHistory';
import {
  getPerpsProTransactionHistoryKey,
  summarizePerpsProTransactionHistoryFacts,
} from '../model/transactionHistory';
import type {
  PerpsProFundingFact,
  PerpsProHistoryOrderFact,
  PerpsProHistoryWindow,
  PerpsProLedgerFact,
} from '../types';

type PerpsProHistoryInfoClient = {
  getUserFills(address?: string, aggregateByTime?: boolean): Promise<WsFill[]>;
  getUserFillsByTime?: (
    address: string | undefined,
    startTime: number,
    endTime?: number,
    aggregateByTime?: boolean,
  ) => Promise<WsFill[]>;
  getUserFunding(
    address?: string,
    startTime?: number,
    endTime?: number,
  ): Promise<UserFunding[]>;
  getUserHistoricalOrders(address?: string): Promise<UserHistoricalOrders[]>;
  getUserNonFundingLedgerUpdates(
    address?: string,
    startTime?: number,
    endTime?: number,
  ): Promise<UserNonFundingLedgerUpdates[]>;
};

type PerpsProHistoryWsClient = {
  subscribeToUserFunding(callback: (payload: WsUserFunding) => void): {
    unsubscribe: () => void;
  };
  subscribeToUserHistoricalOrders(
    callback: (payload: WsUserHistoricalOrders) => void,
  ): { unsubscribe: () => void };
};

export type PerpsProHistoryWindowResult<Item> = {
  completed: boolean;
  items: Item[];
  requests: number;
  stalled: boolean;
  truncated: boolean;
  window: PerpsProHistoryWindow;
};

type PerpsProHistoryRepositoryDependencies = {
  getInfoClient: () => PerpsProHistoryInfoClient;
  getWsClient: () => PerpsProHistoryWsClient;
};

type LoadWindowOptions<Item> = {
  endTime: number;
  fetchPage: (startTime: number, endTime: number) => Promise<Item[]>;
  getKey: (item: Item) => string;
  getTime: (item: Item) => number;
  limit: number;
  pageSizeHint: number;
  startTime: number;
};

const sortByTimeAscending = <Item>(
  items: readonly Item[],
  getTime: (item: Item) => number,
  getKey: (item: Item) => string,
) =>
  [...items].sort(
    (left, right) =>
      getTime(left) - getTime(right) ||
      getKey(left).localeCompare(getKey(right)),
  );

export const loadPerpsProHistoryInclusiveWindow = async <Item>({
  endTime,
  fetchPage,
  getKey,
  getTime,
  limit,
  pageSizeHint,
  startTime,
}: LoadWindowOptions<Item>): Promise<PerpsProHistoryWindowResult<Item>> => {
  const itemsByKey = new Map<string, Item>();
  let cursor = startTime;
  let requests = 0;
  let completed = false;
  let stalled = false;
  let truncated = false;

  if (limit <= 0 || endTime < startTime) {
    return {
      completed: true,
      items: [],
      requests,
      stalled,
      truncated,
      window: { endTime, startTime },
    };
  }

  while (requests < PERPS_PRO_HISTORY_MAX_WINDOW_REQUESTS) {
    const page = await fetchPage(cursor, endTime);
    requests += 1;
    const inWindow = page.filter(item => {
      const time = getTime(item);
      return Number.isFinite(time) && time >= cursor && time <= endTime;
    });
    const previousSize = itemsByKey.size;
    let newestTime: number | null = null;

    inWindow.forEach(item => {
      itemsByKey.set(getKey(item), item);
      const time = getTime(item);
      newestTime = newestTime == null ? time : Math.max(newestTime, time);
    });

    if (page.length === 0 || newestTime == null) {
      completed = true;
      break;
    }

    if (itemsByKey.size > limit) {
      truncated = true;
      break;
    }

    if (newestTime >= endTime || page.length < pageSizeHint) {
      completed = true;
      break;
    }

    if (itemsByKey.size === limit) {
      truncated = true;
      break;
    }

    if (newestTime <= cursor && itemsByKey.size === previousSize) {
      stalled = true;
      break;
    }

    cursor = newestTime;
  }

  if (!completed && !stalled && !truncated) {
    stalled = true;
  }

  const sorted = sortByTimeAscending([...itemsByKey.values()], getTime, getKey);
  return {
    completed,
    items: (truncated ? sorted.slice(-limit) : sorted).slice(-limit),
    requests,
    stalled,
    truncated,
    window: { endTime, startTime },
  };
};

const loadLatestBoundedWindow = async <Item>(
  options: LoadWindowOptions<Item>,
): Promise<PerpsProHistoryWindowResult<Item>> => {
  let startTime = options.startTime;
  let latestResult: PerpsProHistoryWindowResult<Item> | null = null;

  for (
    let attempt = 0;
    attempt < PERPS_PRO_HISTORY_MAX_NARROW_ATTEMPTS;
    attempt += 1
  ) {
    latestResult = await loadPerpsProHistoryInclusiveWindow({
      ...options,
      startTime,
    });
    if (!latestResult.truncated) {
      return latestResult;
    }

    const nextStart = Math.floor(startTime + (options.endTime - startTime) / 2);
    if (nextStart <= startTime || nextStart >= options.endTime) {
      break;
    }
    startTime = nextStart;
  }

  return (
    latestResult ??
    loadPerpsProHistoryInclusiveWindow({ ...options, startTime })
  );
};

const getOrderKey = (fact: PerpsProHistoryOrderFact) =>
  `${fact.order.oid}:${fact.status}:${fact.statusTimestamp}`;
const normalizeLatestFills = (fills: readonly WsFill[]) =>
  [...fills]
    .sort(
      (left, right) =>
        right.time - left.time ||
        getFillKey(left).localeCompare(getFillKey(right)),
    )
    .slice(0, PERPS_PRO_HISTORY_TRADE_INITIAL_LIMIT);
const mapUserFunding = (fact: UserFunding): PerpsProFundingFact | null => {
  if (fact.delta.type !== 'funding') {
    return null;
  }
  return {
    coin: fact.delta.coin,
    fundingRate: fact.delta.fundingRate,
    hash: fact.hash,
    szi: fact.delta.szi,
    time: fact.time,
    usdc: fact.delta.usdc,
  };
};

export const createPerpsProHistoryRepository = (
  dependencies: PerpsProHistoryRepositoryDependencies = {
    getInfoClient: () =>
      apisPerps.getPerpsSDK().info as unknown as PerpsProHistoryInfoClient,
    getWsClient: () =>
      apisPerps.getPerpsSDK().ws as unknown as PerpsProHistoryWsClient,
  },
) => ({
  isSupported: () =>
    typeof dependencies.getInfoClient().getUserFillsByTime === 'function',

  fetchOrders: async (address: string) => {
    const result = await dependencies
      .getInfoClient()
      .getUserHistoricalOrders(address);
    return [...result]
      .sort(
        (left, right) =>
          right.statusTimestamp - left.statusTimestamp ||
          getOrderKey(left).localeCompare(getOrderKey(right)),
      )
      .slice(0, PERPS_PRO_HISTORY_ORDERS_LIMIT);
  },

  fetchLatestTrades: async (address: string) => {
    const result = await dependencies
      .getInfoClient()
      .getUserFills(address, true);
    return normalizeLatestFills(result);
  },

  fetchOrderFills: async (address: string) => {
    const result = await dependencies
      .getInfoClient()
      .getUserFills(address, true);
    return normalizeLatestFills(result);
  },

  fetchTradesWindow: async (
    address: string,
    window: PerpsProHistoryWindow,
    limit: number,
  ) => {
    const info = dependencies.getInfoClient();
    if (!info.getUserFillsByTime) {
      throw new Error('Perps history SDK capability is unavailable');
    }
    return loadLatestBoundedWindow({
      ...window,
      fetchPage: (startTime, endTime) =>
        info.getUserFillsByTime!(address, startTime, endTime, true),
      getKey: getFillKey,
      getTime: item => item.time,
      limit,
      pageSizeHint: PERPS_PRO_HISTORY_TRADE_PAGE_HINT,
    });
  },

  fetchTransactionsWindow: async (
    address: string,
    window: PerpsProHistoryWindow,
    limit = PERPS_PRO_HISTORY_CASHFLOW_INITIAL_LIMIT,
  ) => {
    const result = await loadLatestBoundedWindow({
      ...window,
      fetchPage: async (startTime, endTime) =>
        (await dependencies
          .getInfoClient()
          .getUserNonFundingLedgerUpdates(
            address,
            startTime,
            endTime,
          )) as PerpsProLedgerFact[],
      getKey: getPerpsProTransactionHistoryKey,
      getTime: item => item.time,
      limit,
      pageSizeHint: PERPS_PRO_HISTORY_LEDGER_PAGE_HINT,
    });
    return {
      ...result,
      diagnostics: summarizePerpsProTransactionHistoryFacts(
        result.items,
        address,
      ),
    };
  },

  fetchFundingWindow: async (
    address: string,
    window: PerpsProHistoryWindow,
    limit = PERPS_PRO_HISTORY_CASHFLOW_INITIAL_LIMIT,
  ) => {
    const info = dependencies.getInfoClient();
    return loadLatestBoundedWindow({
      ...window,
      fetchPage: async (startTime, endTime) =>
        (await info.getUserFunding(address, startTime, endTime))
          .map(mapUserFunding)
          .filter((item): item is PerpsProFundingFact => !!item),
      getKey: getPerpsProFundingHistoryKey,
      getTime: item => item.time,
      limit,
      pageSizeHint: PERPS_PRO_HISTORY_LEDGER_PAGE_HINT,
    });
  },

  subscribeOrders: (callback: (payload: WsUserHistoricalOrders) => void) => {
    const subscription = dependencies
      .getWsClient()
      .subscribeToUserHistoricalOrders(callback);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      subscription.unsubscribe();
    };
  },

  subscribeFunding: (callback: (payload: WsUserFunding) => void) => {
    const subscription = dependencies
      .getWsClient()
      .subscribeToUserFunding(callback);
    let active = true;
    return () => {
      if (!active) {
        return;
      }
      active = false;
      subscription.unsubscribe();
    };
  },
});

export const perpsProHistoryRepository = createPerpsProHistoryRepository();

export const isPerpsProHistorySdkSupported = () => {
  try {
    return perpsProHistoryRepository.isSupported();
  } catch {
    return false;
  }
};
