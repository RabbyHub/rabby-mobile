import { PERPS_MINI_USD_VALUE } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchClearinghouseStateHttp,
  fetchPositionOpenOrdersHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export type PerpsModifyOpenOrderTif = 'Alo' | 'Gtc';

export type PerpsModifyOpenOrderCommand = {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  dexId: string;
  expected: {
    limitPrice: string;
    reduceOnly: boolean;
    remainingSize: string;
    side: 'buy' | 'sell';
    tif: PerpsModifyOpenOrderTif;
  };
  marketKey: string;
  oid: number;
  replacement: {
    baseSize: string;
    limitPrice: string;
  };
  type: 'modifyOpenOrder';
};

export type PerpsModifyOpenOrderResult = {
  error?: string;
  failureReason?: 'regionRestricted' | 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'filled' | 'resting' | 'staleContext' | 'unknownOutcome';
  oid?: number;
  refreshError?: string;
};

export type PerpsModifyOpenOrderDependencies = {
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getCurrentDex: (coin: string) => string;
  getLiveOpenOrders: () => readonly OpenOrder[];
  hasPermission: () => boolean;
  modifyOrder: (params: {
    coin: string;
    isBuy: boolean;
    limitPx: string;
    oid: number;
    orderType: { limit: { tif: PerpsModifyOpenOrderTif } };
    reduceOnly: boolean;
    sz: string;
  }) => Promise<unknown>;
  refreshClearinghouse: (dex: string) => Promise<unknown> | unknown;
  refreshOpenOrders: (dex: string) => Promise<unknown> | unknown;
};

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

const normalize = (value: string, decimals: number) => {
  const number = positive(value);
  if (!number || !Number.isSafeInteger(decimals) || decimals < 0) {
    return null;
  }
  const result = number.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed();
  return positive(result)?.toFixed() ?? null;
};

export const buildPerpsModifyOpenOrderCommand = ({
  account,
  baseSize,
  coin,
  dexId,
  expectedLimitPrice,
  expectedRemainingSize,
  limitPrice,
  marketKey,
  oid,
  pxDecimals,
  reduceOnly,
  side,
  szDecimals,
  tif,
}: {
  account: Pick<Account, 'address' | 'type'>;
  baseSize: string;
  coin: string;
  dexId: string;
  expectedLimitPrice: string;
  expectedRemainingSize: string;
  limitPrice: string;
  marketKey: string;
  oid: number;
  pxDecimals: number;
  reduceOnly: boolean;
  side: 'buy' | 'sell';
  szDecimals: number;
  tif: PerpsModifyOpenOrderTif;
}): PerpsModifyOpenOrderCommand => {
  const normalizedCoin = coin.trim();
  const normalizedPrice = normalize(limitPrice, pxDecimals);
  const normalizedSize = normalize(baseSize, szDecimals);
  const expectedPrice = positive(expectedLimitPrice)?.toFixed();
  const expectedSize = positive(expectedRemainingSize)?.toFixed();
  if (
    !account.address ||
    !normalizedCoin ||
    !marketKey ||
    !Number.isSafeInteger(oid) ||
    oid < 0 ||
    !normalizedPrice ||
    !normalizedSize ||
    !expectedPrice ||
    !expectedSize ||
    (tif !== 'Gtc' && tif !== 'Alo')
  ) {
    throw new Error('Invalid open order modification');
  }
  if (
    new BigNumber(normalizedPrice)
      .multipliedBy(normalizedSize)
      .lt(PERPS_MINI_USD_VALUE)
  ) {
    throw new Error(`Minimum amount is ${PERPS_MINI_USD_VALUE}`);
  }
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    coin: normalizedCoin,
    dexId,
    expected: Object.freeze({
      limitPrice: expectedPrice,
      reduceOnly,
      remainingSize: expectedSize,
      side,
      tif,
    }),
    marketKey,
    oid,
    replacement: Object.freeze({
      baseSize: normalizedSize,
      limitPrice: normalizedPrice,
    }),
    type: 'modifyOpenOrder' as const,
  });
};

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
  return exchange;
};

const defaultDependencies: PerpsModifyOpenOrderDependencies = {
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getCurrentDex: coin => getDexByCoin(coin),
  getLiveOpenOrders: () => perpsStore.getState().openOrders,
  hasPermission: () => perpsStore.getState().hasPermission,
  modifyOrder: params => getExchange().modifyOrder(params),
  refreshClearinghouse: dex => fetchClearinghouseStateHttp(dex),
  refreshOpenOrders: dex => fetchPositionOpenOrdersHttp(dex),
};

const hasBaseContext = (
  command: PerpsModifyOpenOrderCommand,
  dependencies: PerpsModifyOpenOrderDependencies,
  sceneGuard?: () => boolean,
) =>
  (sceneGuard?.() ?? true) &&
  isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account) &&
  dependencies.getCurrentDex(command.coin) === command.dexId;

const hasExpectedOrder = (
  command: PerpsModifyOpenOrderCommand,
  orders: readonly OpenOrder[],
) => {
  const order = orders.find(
    item => item.coin === command.coin && item.oid === command.oid,
  );
  return (
    !!order &&
    !order.isTrigger &&
    !order.isPositionTpsl &&
    order.orderType === 'Limit' &&
    order.side === (command.expected.side === 'buy' ? 'B' : 'A') &&
    order.reduceOnly === command.expected.reduceOnly &&
    order.tif === command.expected.tif &&
    new BigNumber(order.limitPx || Number.NaN).eq(
      command.expected.limitPrice,
    ) &&
    new BigNumber(order.sz || Number.NaN).eq(command.expected.remainingSize)
  );
};

const isUnknownOutcomeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network request failed|failed to fetch|connection/i.test(
    message,
  );
};

export const executePerpsModifyOpenOrder = async (
  command: PerpsModifyOpenOrderCommand,
  dependencies: PerpsModifyOpenOrderDependencies = defaultDependencies,
  sceneGuard?: () => boolean,
): Promise<PerpsModifyOpenOrderResult> => {
  if (command.type !== 'modifyOpenOrder') {
    return {
      error: 'Invalid open order modification command',
      failureReason: 'requestFailed',
      kind: 'failed',
    };
  }
  if (!dependencies.hasPermission()) {
    return { failureReason: 'regionRestricted', kind: 'failed' };
  }
  if (
    !hasBaseContext(command, dependencies, sceneGuard) ||
    !hasExpectedOrder(command, dependencies.getLiveOpenOrders())
  ) {
    return { kind: 'staleContext' };
  }
  try {
    if (!dependencies.hasPermission()) {
      return { failureReason: 'regionRestricted', kind: 'failed' };
    }
    const response = await dependencies.modifyOrder({
      coin: command.coin,
      isBuy: command.expected.side === 'buy',
      limitPx: command.replacement.limitPrice,
      oid: command.oid,
      orderType: { limit: { tif: command.expected.tif } },
      reduceOnly: command.expected.reduceOnly,
      sz: command.replacement.baseSize,
    });
    const payload = response as {
      response?: { data?: { statuses?: unknown[] } };
      status?: unknown;
    };
    const status = payload.response?.data?.statuses?.[0] as
      | {
          error?: string;
          filled?: { oid?: number };
          resting?: { oid?: number };
        }
      | undefined;
    if (payload.status !== 'ok' || status?.error) {
      throw new Error(
        status?.error || 'Hyperliquid rejected order modification',
      );
    }
    if (!hasBaseContext(command, dependencies, sceneGuard)) {
      return { kind: 'staleContext' };
    }
    const kind = status?.filled ? 'filled' : status?.resting ? 'resting' : null;
    if (!kind) {
      throw new Error('Missing Hyperliquid order status');
    }
    let refreshError: string | undefined;
    try {
      await (kind === 'filled'
        ? Promise.all([
            dependencies.refreshClearinghouse(command.dexId),
            dependencies.refreshOpenOrders(command.dexId),
          ])
        : dependencies.refreshOpenOrders(command.dexId));
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
    return {
      kind,
      oid: kind === 'filled' ? status?.filled?.oid : status?.resting?.oid,
      refreshError,
    };
  } catch (error) {
    if (isPerpsActionUserCancelled(error)) {
      return {
        error: error instanceof Error ? error.message : String(error),
        failureReason: 'userCancelled',
        kind: 'failed',
      };
    }
    if (isUnknownOutcomeError(error)) {
      let refreshError: string | undefined;
      try {
        await Promise.all([
          dependencies.refreshClearinghouse(command.dexId),
          dependencies.refreshOpenOrders(command.dexId),
        ]);
      } catch (refreshFailure) {
        refreshError =
          refreshFailure instanceof Error
            ? refreshFailure.message
            : String(refreshFailure);
      }
      return {
        error: error instanceof Error ? error.message : String(error),
        kind: 'unknownOutcome',
        refreshError,
      };
    }
    return {
      error: error instanceof Error ? error.message : String(error),
      failureReason: 'requestFailed',
      kind: 'failed',
    };
  }
};
