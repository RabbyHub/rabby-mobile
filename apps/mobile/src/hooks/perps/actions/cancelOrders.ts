import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchPositionOpenOrdersHttpForDexes,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export interface PerpsCancelOrderIntent {
  coin: string;
  oid: number;
}

export interface PerpsCancelOrdersCommand {
  account: Pick<Account, 'address' | 'type'>;
  orders: readonly PerpsCancelOrderIntent[];
  type: 'cancelOrders';
}

export interface PerpsCancelOrderItemResult extends PerpsCancelOrderIntent {
  error?: string;
  status: 'failed' | 'success';
}

export interface PerpsCancelOrdersResult {
  failureReason?: 'requestFailed' | 'userCancelled';
  items: PerpsCancelOrderItemResult[];
  kind: 'failed' | 'partial' | 'staleContext' | 'success';
  refreshError?: string;
}

export interface CancelOrdersDependencies {
  cancelOrders: (orders: readonly PerpsCancelOrderIntent[]) => Promise<unknown>;
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  refreshDexes: (dexes: string[]) => Promise<unknown> | unknown;
  resolveDex: (coin: string) => string;
}

const normalizeCoin = (coin: string) => coin.trim();

export const buildPerpsCancelOrdersCommand = (
  account: Pick<Account, 'address' | 'type'>,
  orders: readonly PerpsCancelOrderIntent[],
): PerpsCancelOrdersCommand => {
  if (!account.address) {
    throw new Error('Perps account is required');
  }
  const seen = new Set<number>();
  const normalized = orders.reduce<PerpsCancelOrderIntent[]>((result, item) => {
    const coin = normalizeCoin(item.coin);
    if (!coin || !Number.isSafeInteger(item.oid) || item.oid < 0) {
      throw new Error('Invalid Perps cancel order');
    }
    if (!seen.has(item.oid)) {
      seen.add(item.oid);
      result.push(Object.freeze({ coin, oid: item.oid }));
    }
    return result;
  }, []);
  if (normalized.length === 0) {
    throw new Error('At least one Perps order is required');
  }
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    orders: Object.freeze(normalized),
    type: 'cancelOrders' as const,
  });
};

const defaultDependencies: CancelOrdersDependencies = {
  cancelOrders: async orders => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) {
      throw new Error('Hyperliquid exchange client unavailable');
    }
    return exchange.cancelOrder(orders.map(item => ({ ...item })));
  },
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  refreshDexes: dexes => fetchPositionOpenOrdersHttpForDexes(dexes),
  resolveDex: coin => getDexByCoin(coin),
};

const getStatuses = (response: unknown): unknown[] => {
  const value = response as {
    response?: { data?: { statuses?: unknown[] } };
  };
  return Array.isArray(value?.response?.data?.statuses)
    ? value.response.data.statuses
    : [];
};

const normalizeStatus = (
  intent: PerpsCancelOrderIntent,
  status: unknown,
): PerpsCancelOrderItemResult => {
  if (
    status === 'success' ||
    (typeof status === 'object' &&
      status !== null &&
      (status as { success?: unknown }).success === true)
  ) {
    return { ...intent, status: 'success' };
  }
  const error =
    typeof status === 'object' && status !== null
      ? (status as { error?: unknown }).error
      : undefined;
  return {
    ...intent,
    error: typeof error === 'string' && error ? error : 'Cancel failed',
    status: 'failed',
  };
};

const failedResult = (
  command: PerpsCancelOrdersCommand,
  error: unknown,
): PerpsCancelOrdersResult => ({
  items: command.orders.map(item => ({
    ...item,
    error: error instanceof Error ? error.message : String(error),
    status: 'failed',
  })),
  failureReason: isPerpsActionUserCancelled(error)
    ? 'userCancelled'
    : 'requestFailed',
  kind: 'failed',
});

export const executePerpsCancelOrders = async (
  command: PerpsCancelOrdersCommand,
  dependencies: CancelOrdersDependencies = defaultDependencies,
): Promise<PerpsCancelOrdersResult> => {
  if (
    !isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account)
  ) {
    return { items: [], kind: 'staleContext' };
  }

  let response: unknown;
  try {
    response = await dependencies.cancelOrders(command.orders);
  } catch (error) {
    return failedResult(command, error);
  }

  const statuses = getStatuses(response);
  const items = command.orders.map((item, index) =>
    normalizeStatus(item, statuses[index]),
  );
  if (
    !isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account)
  ) {
    return { items, kind: 'staleContext' };
  }

  const successful = items.filter(item => item.status === 'success');
  let refreshError: string | undefined;
  if (successful.length > 0) {
    try {
      await dependencies.refreshDexes(
        successful.map(item => dependencies.resolveDex(item.coin)),
      );
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
  }
  if (
    !isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account)
  ) {
    return { items, kind: 'staleContext', refreshError };
  }
  if (successful.length === items.length) {
    return { items, kind: 'success', refreshError };
  }
  if (successful.length > 0) {
    return { items, kind: 'partial', refreshError };
  }
  return { items, kind: 'failed' };
};
