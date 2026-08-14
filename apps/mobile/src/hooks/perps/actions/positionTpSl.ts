import { PERPS_BUILDER_INFO } from '@/constant/perps';
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

export const PERPS_POSITION_TPSL_SLIPPAGE = 0.08;

export type PerpsPositionTpSlCommandScope = 'partial' | 'position';
export type PerpsPositionTpSlCommandKind = 'takeProfit' | 'stopLoss';

export interface PerpsPositionTpSlCommandLeg {
  kind: PerpsPositionTpSlCommandKind;
  replaceOid: number | null;
  size: string | null;
  triggerPrice: string;
}

export interface PerpsPositionTpSlCommand {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  direction: 'long' | 'short';
  expectedPositionSize: string;
  legs: readonly PerpsPositionTpSlCommandLeg[];
  markPrice: string;
  scope: PerpsPositionTpSlCommandScope;
  type: 'positionTpSl';
}

export interface PerpsPositionTpSlLegResult {
  cancel: 'failed' | 'notRequired' | 'success';
  create: 'failed' | 'notAttempted' | 'success';
  error?: string;
  kind: PerpsPositionTpSlCommandKind;
  oid?: number;
  replacedOid: number | null;
}

export interface PerpsPositionTpSlResult {
  contextChanged?: boolean;
  failureReason?: 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'partial' | 'staleContext' | 'success';
  legs: PerpsPositionTpSlLegResult[];
  refreshError?: string;
}

export interface PositionTpSlDependencies {
  cancelOrder: (coin: string, oid: number) => Promise<unknown>;
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getLiveMark: (coin: string) => string | null;
  getLiveOpenOrders: () => readonly OpenOrder[];
  getLiveSignedSize: (coin: string) => string | null;
  placePartial: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    reduceOnly: true;
    size: string;
    slippage: typeof PERPS_POSITION_TPSL_SLIPPAGE;
    tpsl: 'sl' | 'tp';
    triggerPx: string;
  }) => Promise<unknown>;
  placePosition: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    slTriggerPx?: string;
    slippage: typeof PERPS_POSITION_TPSL_SLIPPAGE;
    tpTriggerPx?: string;
  }) => Promise<unknown>;
  refresh: (dex: string) => Promise<unknown> | unknown;
  resolveDex: (coin: string) => string;
}

const finiteDecimal = (value: unknown) => {
  const result = new BigNumber((value as string | number | undefined) ?? NaN);
  return result.isFinite() ? result : null;
};

const normalizePrice = (value: string, pxDecimals: number) => {
  const price = finiteDecimal(value);
  if (!price?.gt(0) || !Number.isSafeInteger(pxDecimals) || pxDecimals < 0) {
    return null;
  }
  const normalized = price
    .decimalPlaces(pxDecimals, BigNumber.ROUND_DOWN)
    .toFixed();
  return new BigNumber(normalized).gt(0) ? normalized : null;
};

const normalizeSize = (value: string, szDecimals: number) => {
  const size = finiteDecimal(value);
  if (!size?.gt(0) || !Number.isSafeInteger(szDecimals) || szDecimals < 0) {
    return null;
  }
  const normalized = size
    .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN)
    .toFixed();
  return new BigNumber(normalized).gt(0) ? normalized : null;
};

const isTriggerValidForMark = ({
  direction,
  kind,
  mark,
  trigger,
}: {
  direction: 'long' | 'short';
  kind: PerpsPositionTpSlCommandKind;
  mark: BigNumber;
  trigger: BigNumber;
}) => {
  const shouldBeAbove =
    (direction === 'long' && kind === 'takeProfit') ||
    (direction === 'short' && kind === 'stopLoss');
  return shouldBeAbove ? trigger.gt(mark) : trigger.lt(mark);
};

export const buildPerpsPositionTpSlCommand = ({
  account,
  coin,
  direction,
  expectedPositionSize,
  legs,
  markPrice,
  pxDecimals,
  scope,
  szDecimals,
}: Omit<PerpsPositionTpSlCommand, 'legs' | 'type'> & {
  legs: readonly {
    kind: PerpsPositionTpSlCommandKind;
    replaceOid?: number | null;
    size?: string | null;
    triggerPrice: string;
  }[];
  pxDecimals: number;
  szDecimals: number;
}): PerpsPositionTpSlCommand => {
  const normalizedCoin = coin.trim();
  const mark = finiteDecimal(markPrice);
  const positionSize = finiteDecimal(expectedPositionSize);
  if (
    !account.address ||
    !normalizedCoin ||
    !mark?.gt(0) ||
    !positionSize?.gt(0) ||
    legs.length === 0 ||
    legs.length > 2
  ) {
    throw new Error('Invalid Position TP/SL context');
  }

  const seenKinds = new Set<PerpsPositionTpSlCommandKind>();
  const normalizedLegs = legs.map(leg => {
    if (seenKinds.has(leg.kind)) {
      throw new Error('Duplicate Position TP/SL side');
    }
    seenKinds.add(leg.kind);
    const triggerPrice = normalizePrice(leg.triggerPrice, pxDecimals);
    if (
      !triggerPrice ||
      !isTriggerValidForMark({
        direction,
        kind: leg.kind,
        mark,
        trigger: new BigNumber(triggerPrice),
      })
    ) {
      throw new Error('Invalid Position TP/SL trigger price');
    }
    const replaceOid = leg.replaceOid ?? null;
    if (
      replaceOid !== null &&
      (!Number.isSafeInteger(replaceOid) || replaceOid < 0)
    ) {
      throw new Error('Invalid Position TP/SL order');
    }
    const size =
      scope === 'partial' ? normalizeSize(leg.size || '', szDecimals) : null;
    if (
      scope === 'partial' &&
      (!size || new BigNumber(size).gt(positionSize))
    ) {
      throw new Error('Invalid partial Position TP/SL amount');
    }
    return Object.freeze({
      kind: leg.kind,
      replaceOid,
      size,
      triggerPrice,
    });
  });

  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    coin: normalizedCoin,
    direction,
    expectedPositionSize: positionSize.toString(),
    legs: Object.freeze(normalizedLegs),
    markPrice: mark.toString(),
    scope,
    type: 'positionTpSl' as const,
  });
};

const getLiveSignedSize = (coin: string) =>
  perpsStore
    .getState()
    .currentClearinghouseState?.assetPositions.find(
      item => item.position.coin === coin,
    )?.position.szi ?? null;

const defaultDependencies: PositionTpSlDependencies = {
  cancelOrder: async (coin, oid) => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
    return exchange.cancelOrder([{ coin, oid }]);
  },
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getLiveMark: coin =>
    perpsStore.getState().marketDataMap[coin]?.markPx ?? null,
  getLiveOpenOrders: () => perpsStore.getState().openOrders,
  getLiveSignedSize,
  placePartial: async params => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
    return exchange.placeTPSlMarketOrder(params);
  },
  placePosition: async params => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
    return exchange.bindTpslByOrderId(params);
  },
  refresh: dex =>
    Promise.all([
      fetchPositionOpenOrdersHttp(dex),
      fetchClearinghouseStateHttp(dex),
    ]),
  resolveDex: coin => getDexByCoin(coin),
};

const getStatuses = (response: unknown): unknown[] => {
  const result = response as {
    response?: { data?: { statuses?: unknown[] } };
    status?: unknown;
  };
  if (result?.status !== 'ok') {
    return [];
  }
  return Array.isArray(result.response?.data?.statuses)
    ? result.response.data.statuses
    : [];
};

const parseAcceptedStatus = (status: unknown) => {
  if (!status || typeof status !== 'object') {
    return { error: 'Missing Hyperliquid order status', oid: undefined };
  }
  const value = status as {
    error?: unknown;
    filled?: { oid?: unknown };
    resting?: { oid?: unknown };
    success?: unknown;
  };
  if (typeof value.error === 'string' && value.error) {
    return { error: value.error, oid: undefined };
  }
  const oid = value.resting?.oid ?? value.filled?.oid;
  if (typeof oid === 'number') {
    return { error: undefined, oid };
  }
  if (value.success === true) {
    return { error: undefined, oid: undefined };
  }
  return { error: 'Hyperliquid rejected TP/SL order', oid: undefined };
};

const isCancelAccepted = (response: unknown) => {
  const status = getStatuses(response)[0];
  return (
    status === 'success' ||
    (!!status &&
      typeof status === 'object' &&
      (status as { success?: unknown }).success === true)
  );
};

const resolveOpenOrderKind = (order: OpenOrder) => {
  const type = String(order.orderType || '').toLowerCase();
  if (type.includes('take profit')) return 'takeProfit';
  if (type.includes('stop')) return 'stopLoss';
  return null;
};

const isExpectedReplaceOrder = (
  command: PerpsPositionTpSlCommand,
  leg: PerpsPositionTpSlCommandLeg,
  orders: readonly OpenOrder[],
) => {
  if (leg.replaceOid === null) {
    return true;
  }
  const order = orders.find(item => item.oid === leg.replaceOid);
  return (
    !!order &&
    order.coin === command.coin &&
    order.reduceOnly &&
    order.isTrigger &&
    resolveOpenOrderKind(order) === leg.kind &&
    (command.scope === 'position'
      ? order.isPositionTpsl
      : !order.isPositionTpsl && new BigNumber(order.sz).gt(0))
  );
};

const hasSafePositionOrderCardinality = (
  command: PerpsPositionTpSlCommand,
  orders: readonly OpenOrder[],
) => {
  if (command.scope !== 'position') {
    return true;
  }
  return command.legs.every(leg => {
    const sameSide = orders.filter(
      order =>
        order.coin === command.coin &&
        order.reduceOnly &&
        order.isTrigger &&
        order.isPositionTpsl &&
        resolveOpenOrderKind(order) === leg.kind,
    );
    return leg.replaceOid === null
      ? sameSide.length === 0
      : sameSide.length === 1 && sameSide[0]?.oid === leg.replaceOid;
  });
};

const getLivePosition = (
  command: PerpsPositionTpSlCommand,
  dependencies: PositionTpSlDependencies,
) => {
  const signed = finiteDecimal(dependencies.getLiveSignedSize(command.coin));
  if (!signed || signed.isZero()) {
    return null;
  }
  const direction = signed.gt(0) ? 'long' : 'short';
  return direction === command.direction ? signed.abs() : null;
};

const hasCurrentContext = (
  command: PerpsPositionTpSlCommand,
  dependencies: PositionTpSlDependencies,
) =>
  isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account) &&
  !!getLivePosition(command, dependencies);

const hasValidLiveTriggers = (
  command: PerpsPositionTpSlCommand,
  dependencies: PositionTpSlDependencies,
) => {
  const mark = finiteDecimal(dependencies.getLiveMark(command.coin));
  return (
    !!mark?.gt(0) &&
    command.legs.every(leg =>
      isTriggerValidForMark({
        direction: command.direction,
        kind: leg.kind,
        mark,
        trigger: new BigNumber(leg.triggerPrice),
      }),
    )
  );
};

const legResult = (
  leg: PerpsPositionTpSlCommandLeg,
): PerpsPositionTpSlLegResult => ({
  cancel: leg.replaceOid === null ? 'notRequired' : 'failed',
  create: 'notAttempted',
  kind: leg.kind,
  replacedOid: leg.replaceOid,
});

const resultKind = (
  legs: readonly PerpsPositionTpSlLegResult[],
): PerpsPositionTpSlResult['kind'] => {
  const successful = legs.filter(leg => leg.create === 'success').length;
  if (successful === legs.length) return 'success';
  const mutated = legs.some(
    leg => leg.cancel === 'success' || leg.create === 'success',
  );
  return mutated ? 'partial' : 'failed';
};

export const executePerpsPositionTpSl = async (
  command: PerpsPositionTpSlCommand,
  dependencies: PositionTpSlDependencies = defaultDependencies,
): Promise<PerpsPositionTpSlResult> => {
  if (
    !hasCurrentContext(command, dependencies) ||
    !hasValidLiveTriggers(command, dependencies)
  ) {
    return { kind: 'staleContext', legs: [] };
  }
  if (
    !hasSafePositionOrderCardinality(
      command,
      dependencies.getLiveOpenOrders(),
    ) ||
    command.legs.some(leg =>
      leg.replaceOid === null
        ? false
        : !isExpectedReplaceOrder(
            command,
            leg,
            dependencies.getLiveOpenOrders(),
          ),
    )
  ) {
    return { kind: 'staleContext', legs: [] };
  }

  const results = command.legs.map(legResult);
  let userCancelled = false;
  let contextChanged = false;
  let mutated = false;
  let createAttempted = false;
  const openOidsBeforeCreate = new Set(
    dependencies.getLiveOpenOrders().map(order => order.oid),
  );

  for (let index = 0; index < command.legs.length; index += 1) {
    const leg = command.legs[index]!;
    const result = results[index]!;
    if (!hasCurrentContext(command, dependencies)) {
      contextChanged = true;
      break;
    }
    if (leg.replaceOid === null) {
      continue;
    }
    try {
      const response = await dependencies.cancelOrder(
        command.coin,
        leg.replaceOid,
      );
      if (!isCancelAccepted(response)) {
        result.error = 'Hyperliquid rejected TP/SL cancellation';
        continue;
      }
      result.cancel = 'success';
      mutated = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      if (isPerpsActionUserCancelled(error)) {
        userCancelled = true;
        break;
      }
    }
  }

  if (
    !hasCurrentContext(command, dependencies) ||
    !hasValidLiveTriggers(command, dependencies)
  ) {
    contextChanged = true;
  }

  const creatableIndexes = command.legs
    .map((leg, index) => ({ index, leg, result: results[index]! }))
    .filter(
      item =>
        !contextChanged &&
        !userCancelled &&
        (item.leg.replaceOid === null || item.result.cancel === 'success'),
    )
    .filter(item => {
      if (command.scope !== 'partial') return true;
      const liveSize = getLivePosition(command, dependencies);
      if (!liveSize || !item.leg.size || liveSize.lt(item.leg.size)) {
        item.result.error = 'Position size changed before TP/SL creation';
        return false;
      }
      return true;
    });

  if (command.scope === 'position' && creatableIndexes.length > 0) {
    createAttempted = true;
    try {
      const tp = creatableIndexes.find(item => item.leg.kind === 'takeProfit');
      const sl = creatableIndexes.find(item => item.leg.kind === 'stopLoss');
      const response = await dependencies.placePosition({
        builder: PERPS_BUILDER_INFO,
        coin: command.coin,
        isBuy: command.direction === 'long',
        slTriggerPx: sl?.leg.triggerPrice,
        slippage: PERPS_POSITION_TPSL_SLIPPAGE,
        tpTriggerPx: tp?.leg.triggerPrice,
      });
      const statuses = getStatuses(response);
      const statusByKind = new Map<PerpsPositionTpSlCommandKind, unknown>();
      let statusIndex = 0;
      if (tp) statusByKind.set('takeProfit', statuses[statusIndex++]);
      if (sl) statusByKind.set('stopLoss', statuses[statusIndex]);
      creatableIndexes.forEach(item => {
        const accepted = parseAcceptedStatus(statusByKind.get(item.leg.kind));
        if (accepted.error) {
          item.result.create = 'failed';
          item.result.error = accepted.error;
        } else {
          item.result.create = 'success';
          item.result.oid = accepted.oid;
          mutated = true;
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      creatableIndexes.forEach(item => {
        item.result.create = 'failed';
        item.result.error = message;
      });
      userCancelled ||= isPerpsActionUserCancelled(error);
    }
  }

  if (command.scope === 'partial') {
    for (const item of creatableIndexes) {
      createAttempted = true;
      try {
        const response = await dependencies.placePartial({
          builder: PERPS_BUILDER_INFO,
          coin: command.coin,
          isBuy: command.direction === 'short',
          reduceOnly: true,
          size: item.leg.size || '',
          slippage: PERPS_POSITION_TPSL_SLIPPAGE,
          tpsl: item.leg.kind === 'takeProfit' ? 'tp' : 'sl',
          triggerPx: item.leg.triggerPrice,
        });
        const accepted = parseAcceptedStatus(getStatuses(response)[0]);
        if (accepted.error) {
          item.result.create = 'failed';
          item.result.error = accepted.error;
        } else {
          item.result.create = 'success';
          item.result.oid = accepted.oid;
          mutated = true;
        }
      } catch (error) {
        item.result.create = 'failed';
        item.result.error =
          error instanceof Error ? error.message : String(error);
        userCancelled ||= isPerpsActionUserCancelled(error);
        if (userCancelled) {
          break;
        }
      }
      if (!hasCurrentContext(command, dependencies)) {
        contextChanged = true;
        break;
      }
    }
  }

  let refreshError: string | undefined;
  if (mutated || createAttempted) {
    try {
      await dependencies.refresh(dependencies.resolveDex(command.coin));
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
  }
  if (command.scope === 'position' && createAttempted && !refreshError) {
    const liveOrders = dependencies.getLiveOpenOrders();
    results.forEach(result => {
      if (result.create !== 'failed') return;
      const leg = command.legs.find(item => item.kind === result.kind);
      if (!leg) return;
      const reconciled = liveOrders.find(
        order =>
          !openOidsBeforeCreate.has(order.oid) &&
          order.coin === command.coin &&
          order.reduceOnly &&
          order.isTrigger &&
          order.isPositionTpsl &&
          resolveOpenOrderKind(order) === leg.kind &&
          finiteDecimal(order.triggerPx)?.eq(leg.triggerPrice),
      );
      if (reconciled) {
        result.create = 'success';
        result.error = undefined;
        result.oid = reconciled.oid;
        mutated = true;
      }
    });
  }
  if (!hasCurrentContext(command, dependencies)) {
    contextChanged = true;
  }

  const kind = resultKind(results);
  return {
    contextChanged: contextChanged || undefined,
    failureReason:
      kind === 'failed' || kind === 'partial'
        ? userCancelled
          ? 'userCancelled'
          : 'requestFailed'
        : undefined,
    kind: contextChanged && !mutated ? 'staleContext' : kind,
    legs: results,
    refreshError,
  };
};
