import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';

import {
  PERPS_PRO_HISTORY_CASHFLOW_INITIAL_LIMIT,
  PERPS_PRO_HISTORY_TRADE_INITIAL_LIMIT,
  PERPS_PRO_HISTORY_WINDOW_MS,
} from '../constants';
import { perpsProHistoryRepository } from '../repository/perpsProHistoryRepository';
import type { PerpsProHistoryTab, PerpsProHistoryWindow } from '../types';

type PerpsProHistoryRepository = typeof perpsProHistoryRepository;

export type PerpsProHistoryBatch = {
  coveredWindow?: PerpsProHistoryWindow;
  hasEarlier: boolean;
  orderFills?: WsFill[];
  rawItems: unknown[];
};

const assertConvergedWindow = (
  result: {
    completed: boolean;
    stalled: boolean;
    truncated: boolean;
  },
  label: string,
) => {
  if (!result.completed || result.stalled || result.truncated) {
    throw new Error(`${label} history window did not converge`);
  }
};

export const loadLatestPerpsProHistoryBatch = async ({
  accountAddress,
  latestFills,
  now,
  repository = perpsProHistoryRepository,
  tab,
}: {
  accountAddress: string;
  latestFills?: Promise<WsFill[]>;
  now: number;
  repository?: PerpsProHistoryRepository;
  tab: PerpsProHistoryTab;
}): Promise<PerpsProHistoryBatch> => {
  if (tab === 'orders') {
    const [rawItems, orderFills] = await Promise.all([
      repository.fetchOrders(accountAddress),
      (latestFills ?? repository.fetchOrderFills(accountAddress)).catch(
        () => [],
      ),
    ]);
    return {
      hasEarlier: false,
      orderFills,
      rawItems,
    };
  }
  if (tab === 'trade') {
    const rawItems = await (latestFills ??
      repository.fetchLatestTrades(accountAddress));
    const oldest = rawItems.reduce(
      (value, item) => Math.min(value, item.time),
      now,
    );
    return {
      coveredWindow: { endTime: now, startTime: oldest },
      hasEarlier: rawItems.length >= PERPS_PRO_HISTORY_TRADE_INITIAL_LIMIT,
      rawItems,
    };
  }

  const window = {
    endTime: now,
    startTime: Math.max(0, now - PERPS_PRO_HISTORY_WINDOW_MS),
  };
  const result =
    tab === 'transaction'
      ? await repository.fetchTransactionsWindow(
          accountAddress,
          window,
          PERPS_PRO_HISTORY_CASHFLOW_INITIAL_LIMIT,
        )
      : await repository.fetchFundingWindow(
          accountAddress,
          window,
          PERPS_PRO_HISTORY_CASHFLOW_INITIAL_LIMIT,
        );
  assertConvergedWindow(result, tab);
  return {
    coveredWindow: result.window,
    hasEarlier: result.items.length > 0,
    rawItems: result.items,
  };
};

export const loadEarlierPerpsProHistoryBatch = async ({
  accountAddress,
  limit,
  repository = perpsProHistoryRepository,
  tab,
  window,
}: {
  accountAddress: string;
  limit: number;
  repository?: PerpsProHistoryRepository;
  tab: Exclude<PerpsProHistoryTab, 'orders'>;
  window: PerpsProHistoryWindow;
}) => {
  const result =
    tab === 'trade'
      ? await repository.fetchTradesWindow(accountAddress, window, limit)
      : tab === 'transaction'
      ? await repository.fetchTransactionsWindow(accountAddress, window, limit)
      : await repository.fetchFundingWindow(accountAddress, window, limit);
  assertConvergedWindow(result, `${tab} pagination`);
  return {
    rawItems: result.items as unknown[],
    window: result.window,
  };
};
