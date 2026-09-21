import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchClearinghouseStateHttp,
  fetchPositionOpenOrdersHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import type {
  OpenOrder,
  OrderStatusResponse,
} from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import {
  isPerpsProPriceProtocolValid,
  normalizePerpsProCalculatedPrice,
} from '@/utils/perpsPriceProtocol';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export type PerpsModifyOpenOrderTif = 'Alo' | 'Gtc' | 'Ioc';
export type PerpsModifyOpenOrderKind =
  | 'limit'
  | 'triggerLimit'
  | 'triggerMarket';
export type PerpsModifyOpenOrderTriggerKind = 'stopLoss' | 'takeProfit';
export type PerpsModifyOpenOrderStaleReason =
  | 'accountOrDexChanged'
  | 'orderChanged'
  | 'orderClosed';

type PerpsModifyOpenOrderWireType =
  | { limit: { tif: PerpsModifyOpenOrderTif } }
  | {
      trigger: {
        isMarket: boolean;
        triggerPx: string;
        tpsl: 'sl' | 'tp';
      };
    };

export type PerpsModifyOpenOrderCommand = {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  dexId: string;
  expected: {
    cloid: null;
    isPositionTpsl: boolean;
    kind: PerpsModifyOpenOrderKind;
    limitPrice: string;
    orderType: string;
    reduceOnly: boolean;
    remainingSize: string;
    side: 'buy' | 'sell';
    tif: PerpsModifyOpenOrderTif | null;
    triggerKind: PerpsModifyOpenOrderTriggerKind | null;
    triggerPrice: string | null;
  };
  marketKey: string;
  oid: number;
  replacement: {
    baseSize: string;
    limitPrice: string;
    orderType: PerpsModifyOpenOrderWireType;
    triggerPrice: string | null;
  };
  type: 'modifyOpenOrder';
};

type PerpsModifyOpenOrderResultBase = {
  error?: string;
  failureReason?: 'regionRestricted' | 'requestFailed' | 'userCancelled';
  oid?: number;
  refreshError?: string;
};

export type PerpsModifyOpenOrderResult =
  | (PerpsModifyOpenOrderResultBase & {
      kind: 'failed' | 'filled' | 'resting' | 'unknownOutcome' | 'updated';
      latestOrder?: never;
      staleReason?: never;
    })
  | (PerpsModifyOpenOrderResultBase & {
      kind: 'staleContext';
      latestOrder?: never;
      staleReason: Exclude<PerpsModifyOpenOrderStaleReason, 'orderChanged'>;
    })
  | (PerpsModifyOpenOrderResultBase & {
      kind: 'staleContext';
      latestOrder: OpenOrder;
      staleReason: 'orderChanged';
    });

export type PerpsModifyOpenOrderDependencies = {
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getCurrentDex: (coin: string) => string;
  getOrderStatus: (
    oid: number,
    address: string,
  ) => Promise<OrderStatusResponse>;
  hasPermission: () => boolean;
  modifyOrder: (params: {
    coin: string;
    isBuy: boolean;
    limitPx: string;
    oid: number;
    orderType: PerpsModifyOpenOrderWireType;
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

const normalizeSize = (value: string, decimals: number, allowZero: boolean) => {
  const number = new BigNumber(value || Number.NaN);
  if (
    !number.isFinite() ||
    number.isNegative() ||
    (!allowZero && number.isZero()) ||
    !Number.isSafeInteger(decimals) ||
    decimals < 0
  ) {
    return null;
  }
  const result = number.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed();
  return allowZero && new BigNumber(result).isZero()
    ? '0'
    : positive(result)?.toFixed() ?? null;
};

const isValidTif = (
  value: string | null | undefined,
): value is PerpsModifyOpenOrderTif =>
  value === 'Gtc' || value === 'Alo' || value === 'Ioc';

const expectedOrderTypeFor = ({
  kind,
  triggerKind,
}: {
  kind: PerpsModifyOpenOrderKind;
  triggerKind: PerpsModifyOpenOrderTriggerKind | null;
}) => {
  if (kind === 'limit') return ['Limit'];
  const execution = kind === 'triggerMarket' ? 'Market' : 'Limit';
  return triggerKind === 'takeProfit'
    ? [`Take Profit ${execution}`, `Take ${execution}`]
    : triggerKind === 'stopLoss'
    ? [`Stop ${execution}`]
    : [];
};

export const buildPerpsModifyOpenOrderCommand = ({
  account,
  baseSize,
  cloid = null,
  coin,
  dexId,
  editKind = 'limit',
  expectedIsPositionTpsl = false,
  expectedLimitPrice,
  expectedOrderType = 'Limit',
  expectedRemainingSize,
  expectedTriggerPrice = null,
  limitPrice,
  marketKey,
  oid,
  reduceOnly,
  side,
  szDecimals,
  tif,
  triggerKind = null,
  triggerPrice = null,
}: {
  account: Pick<Account, 'address' | 'type'>;
  baseSize: string;
  cloid?: string | null;
  coin: string;
  dexId: string;
  editKind?: PerpsModifyOpenOrderKind;
  expectedIsPositionTpsl?: boolean;
  expectedLimitPrice: string;
  expectedOrderType?: string;
  expectedRemainingSize: string;
  expectedTriggerPrice?: string | null;
  limitPrice?: string;
  marketKey: string;
  oid: number;
  pxDecimals: number;
  reduceOnly: boolean;
  side: 'buy' | 'sell';
  szDecimals: number;
  tif?: PerpsModifyOpenOrderTif | null;
  triggerKind?: PerpsModifyOpenOrderTriggerKind | null;
  triggerPrice?: string | null;
}): PerpsModifyOpenOrderCommand => {
  const normalizedCoin = coin.trim();
  const allowZeroSize = editKind !== 'limit' && expectedIsPositionTpsl;
  const normalizedSize = normalizeSize(baseSize, szDecimals, allowZeroSize);
  const expectedPrice = positive(expectedLimitPrice)?.toFixed();
  const expectedSize = normalizeSize(
    expectedRemainingSize,
    szDecimals,
    allowZeroSize,
  );
  const expectedTrigger =
    editKind === 'limit'
      ? null
      : positive(expectedTriggerPrice)?.toFixed() ?? null;
  const normalizedTrigger =
    editKind === 'limit'
      ? null
      : triggerPrice && isPerpsProPriceProtocolValid(triggerPrice, szDecimals)
      ? triggerPrice
      : null;
  const normalizedPrice =
    editKind === 'triggerMarket'
      ? expectedPrice && expectedTrigger && normalizedTrigger
        ? normalizePerpsProCalculatedPrice(
            new BigNumber(expectedPrice)
              .dividedBy(expectedTrigger)
              .multipliedBy(normalizedTrigger),
            szDecimals,
          )
        : null
      : limitPrice && isPerpsProPriceProtocolValid(limitPrice, szDecimals)
      ? limitPrice
      : null;
  const normalizedTif = editKind === 'limit' && isValidTif(tif) ? tif : null;
  const acceptedOrderTypes = expectedOrderTypeFor({
    kind: editKind,
    triggerKind,
  });
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
    cloid !== null ||
    !acceptedOrderTypes.includes(expectedOrderType) ||
    (editKind === 'limit' && !normalizedTif) ||
    (editKind !== 'limit' && (!expectedTrigger || !normalizedTrigger))
  ) {
    throw new Error('Invalid open order modification');
  }
  const replacementOrderType: PerpsModifyOpenOrderWireType =
    editKind === 'limit'
      ? { limit: { tif: normalizedTif! } }
      : {
          trigger: {
            isMarket: editKind === 'triggerMarket',
            // Hyperliquid signs the msgpack insertion order. Keep the
            // protocol-canonical isMarket -> triggerPx -> tpsl sequence.
            triggerPx: normalizedTrigger!,
            tpsl: triggerKind === 'takeProfit' ? 'tp' : 'sl',
          },
        };
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    coin: normalizedCoin,
    dexId,
    expected: Object.freeze({
      cloid: null,
      isPositionTpsl: expectedIsPositionTpsl,
      kind: editKind,
      limitPrice: expectedPrice,
      orderType: expectedOrderType,
      reduceOnly,
      remainingSize: expectedSize,
      side,
      tif: normalizedTif,
      triggerKind,
      triggerPrice: expectedTrigger,
    }),
    marketKey,
    oid,
    replacement: Object.freeze({
      baseSize: normalizedSize,
      limitPrice: normalizedPrice,
      orderType: Object.freeze(replacementOrderType),
      triggerPrice: normalizedTrigger,
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
  getOrderStatus: (oid, address) =>
    apisPerps.getPerpsSDK().info.getOrderStatus(oid, address),
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
    !order.children?.length &&
    !order.cloid &&
    order.isTrigger === (command.expected.kind !== 'limit') &&
    order.isPositionTpsl === command.expected.isPositionTpsl &&
    order.orderType === command.expected.orderType &&
    order.side === (command.expected.side === 'buy' ? 'B' : 'A') &&
    order.reduceOnly === command.expected.reduceOnly &&
    (command.expected.kind === 'limit'
      ? order.tif === command.expected.tif
      : true) &&
    new BigNumber(order.limitPx || Number.NaN).eq(
      command.expected.limitPrice,
    ) &&
    new BigNumber(order.sz || Number.NaN).eq(command.expected.remainingSize) &&
    (command.expected.kind === 'limit'
      ? true
      : new BigNumber(order.triggerPx || Number.NaN).eq(
          command.expected.triggerPrice || Number.NaN,
        ))
  );
};

const isUnknownOutcomeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network request failed|failed to fetch|connection/i.test(
    message,
  );
};

type ParsedModifyOrderResponse =
  | { kind: 'failed'; error: string }
  | { kind: 'filled' | 'resting'; oid?: number }
  | { kind: 'unknownOutcome'; error: string }
  | { kind: 'updated' };

const parseModifyOrderResponse = (
  response: unknown,
): ParsedModifyOrderResponse => {
  const payload = response as {
    response?:
      | string
      | {
          data?: { statuses?: unknown[] };
          type?: unknown;
        };
    status?: unknown;
  };
  if (payload?.status !== 'ok') {
    return {
      error:
        typeof payload?.response === 'string' && payload.response
          ? payload.response
          : 'Hyperliquid rejected order modification',
      kind: 'failed',
    };
  }
  if (
    payload.response &&
    typeof payload.response === 'object' &&
    payload.response.type === 'default'
  ) {
    return { kind: 'updated' };
  }
  const status =
    payload.response && typeof payload.response === 'object'
      ? (payload.response.data?.statuses?.[0] as
          | {
              error?: unknown;
              filled?: { oid?: unknown };
              resting?: { oid?: unknown };
            }
          | undefined)
      : undefined;
  if (typeof status?.error === 'string' && status.error) {
    return { error: status.error, kind: 'failed' };
  }
  if (status?.filled) {
    return {
      kind: 'filled',
      oid:
        typeof status.filled.oid === 'number' ? status.filled.oid : undefined,
    };
  }
  if (status?.resting) {
    return {
      kind: 'resting',
      oid:
        typeof status.resting.oid === 'number' ? status.resting.oid : undefined,
    };
  }
  return {
    error: 'Missing Hyperliquid order modification outcome',
    kind: 'unknownOutcome',
  };
};

const refreshModifyOrderFacts = async ({
  command,
  dependencies,
  refreshClearinghouse,
}: {
  command: PerpsModifyOpenOrderCommand;
  dependencies: PerpsModifyOpenOrderDependencies;
  refreshClearinghouse: boolean;
}) => {
  try {
    if (refreshClearinghouse) {
      await Promise.all([
        dependencies.refreshClearinghouse(command.dexId),
        dependencies.refreshOpenOrders(command.dexId),
      ]);
    } else {
      await dependencies.refreshOpenOrders(command.dexId);
    }
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
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
  if (!hasBaseContext(command, dependencies, sceneGuard)) {
    return {
      kind: 'staleContext',
      staleReason: 'accountOrDexChanged',
    };
  }
  let status: OrderStatusResponse | null = null;
  try {
    status = await dependencies.getOrderStatus(
      command.oid,
      command.account.address,
    );
  } catch {
    // A failed public preflight is not proof that the order is stale. The
    // authenticated modify endpoint remains authoritative for submission.
  }
  if (!hasBaseContext(command, dependencies, sceneGuard)) {
    return {
      kind: 'staleContext',
      staleReason: 'accountOrDexChanged',
    };
  }
  if (status?.status === 'order') {
    if (status.order.status !== 'open') {
      return { kind: 'staleContext', staleReason: 'orderClosed' };
    }
    const latestOrder = status.order.order as OpenOrder;
    if (!hasExpectedOrder(command, [latestOrder])) {
      return {
        kind: 'staleContext',
        latestOrder,
        staleReason: 'orderChanged',
      };
    }
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
      orderType: command.replacement.orderType,
      reduceOnly: command.expected.reduceOnly,
      sz: command.replacement.baseSize,
    });
    const outcome = parseModifyOrderResponse(response);
    if (outcome.kind === 'failed') {
      return { ...outcome, failureReason: 'requestFailed' };
    }
    const refreshError = await refreshModifyOrderFacts({
      command,
      dependencies,
      refreshClearinghouse:
        outcome.kind === 'filled' ||
        outcome.kind === 'unknownOutcome' ||
        outcome.kind === 'updated',
    });
    if (outcome.kind === 'unknownOutcome') {
      return { ...outcome, refreshError };
    }
    return {
      ...outcome,
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
