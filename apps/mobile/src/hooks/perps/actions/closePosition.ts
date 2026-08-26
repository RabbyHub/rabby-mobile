import {
  PERPS_BUILDER_INFO,
  PERPS_LIMIT_TIF_DEFAULT,
  PERPS_MINI_USD_VALUE,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import {
  fetchClearinghouseStateHttp,
  fetchPositionOpenOrdersHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import BigNumber from 'bignumber.js';

import { isPerpsProPriceProtocolValid } from '@/utils/perpsPriceProtocol';

import { isSamePerpsActionAccount } from './accountGuard';
import { isPerpsActionUserCancelled } from './actionError';

export type PerpsCloseOrderType = 'limit' | 'market';

export interface PerpsClosePositionCommand {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  direction: 'long' | 'short';
  expectedPositionSize: string;
  limitPrice: string | null;
  midPrice: string;
  orderType: PerpsCloseOrderType;
  size: string;
  type: 'closePosition';
}

export interface PerpsClosePositionResult {
  error?: string;
  failureReason?: 'minimumNotional' | 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'filled' | 'resting' | 'staleContext';
  oid?: number;
  refreshError?: string;
}

export interface ClosePositionDependencies {
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getLiveSignedSize: (coin: string) => string | null;
  limitClose: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    limitPx: string;
    reduceOnly: true;
    size: string;
    tif: typeof PERPS_LIMIT_TIF_DEFAULT;
  }) => Promise<unknown>;
  marketClose: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    midPx: string;
    reduceOnly: true;
    size: string;
  }) => Promise<unknown>;
  refreshClearinghouse: (dex: string) => Promise<unknown> | unknown;
  refreshOpenOrders: (dex: string) => Promise<unknown> | unknown;
  resolveDex: (coin: string) => string;
}

const decimal = (value: unknown) => {
  const result = new BigNumber((value as string | number | undefined) ?? NaN);
  return result.isFinite() ? result : null;
};

export const PERPS_CLOSE_MINIMUM_NOTIONAL_ERROR =
  'Perps close amount is below minimum notional';

export type PerpsCloseAmountValidation =
  | {
      isFullClose: boolean;
      kind: 'valid';
      notional: string;
    }
  | {
      kind: 'invalid';
      reason: 'belowMinimumNotional' | 'invalidAmount';
    };

export const validatePerpsCloseAmount = ({
  expectedPositionSize,
  referencePrice,
  size,
}: {
  expectedPositionSize: string;
  referencePrice: string;
  size: string;
}): PerpsCloseAmountValidation => {
  const expected = decimal(expectedPositionSize);
  const requested = decimal(size);
  const price = decimal(referencePrice);
  if (
    !expected ||
    expected.lte(0) ||
    !requested ||
    requested.lte(0) ||
    requested.gt(expected) ||
    !price ||
    price.lte(0)
  ) {
    return { kind: 'invalid', reason: 'invalidAmount' };
  }
  const isFullClose = requested.eq(expected);
  const notional = requested.multipliedBy(price);
  if (!isFullClose && notional.lt(PERPS_MINI_USD_VALUE)) {
    return { kind: 'invalid', reason: 'belowMinimumNotional' };
  }
  return {
    isFullClose,
    kind: 'valid',
    notional: notional.toFixed(),
  };
};

export const isPerpsCloseMinimumNotionalError = (error: string) =>
  error === PERPS_CLOSE_MINIMUM_NOTIONAL_ERROR ||
  /order must have minimum value of \$10\.?/i.test(error);

export const buildPerpsClosePositionCommand = ({
  account,
  coin,
  direction,
  expectedPositionSize,
  limitPrice,
  midPrice,
  orderType,
  size,
  szDecimals,
}: Omit<PerpsClosePositionCommand, 'size' | 'type'> & {
  size: string;
  pxDecimals: number;
  szDecimals: number;
}): PerpsClosePositionCommand => {
  const normalizedCoin = coin.trim();
  const expected = decimal(expectedPositionSize);
  const requested = decimal(size);
  const mid = decimal(midPrice);
  if (!account.address || !normalizedCoin) {
    throw new Error('Perps account and coin are required');
  }
  if (
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0 ||
    !expected ||
    expected.lte(0) ||
    !requested ||
    requested.lte(0) ||
    requested.gt(expected) ||
    !mid ||
    mid.lte(0)
  ) {
    throw new Error('Invalid Perps close amount');
  }
  const normalizedSize = requested
    .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN)
    .toFixed();
  if (new BigNumber(normalizedSize).lte(0)) {
    throw new Error('Perps close amount is below size precision');
  }
  const normalizedLimitPrice =
    orderType === 'limit' &&
    limitPrice &&
    isPerpsProPriceProtocolValid(limitPrice, szDecimals)
      ? limitPrice
      : null;
  if (orderType === 'limit' && !normalizedLimitPrice) {
    throw new Error('Invalid Perps limit price');
  }
  const amountValidation = validatePerpsCloseAmount({
    expectedPositionSize: expected.toFixed(),
    referencePrice:
      orderType === 'limit' ? normalizedLimitPrice || '' : mid.toFixed(),
    size: normalizedSize,
  });
  if (amountValidation.kind === 'invalid') {
    throw new Error(
      amountValidation.reason === 'belowMinimumNotional'
        ? PERPS_CLOSE_MINIMUM_NOTIONAL_ERROR
        : 'Invalid Perps close amount',
    );
  }
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    coin: normalizedCoin,
    direction,
    expectedPositionSize: expected.toFixed(),
    limitPrice: orderType === 'limit' ? normalizedLimitPrice ?? null : null,
    midPrice: mid.toFixed(),
    orderType,
    size: normalizedSize,
    type: 'closePosition' as const,
  });
};

const getLiveSignedSize = (coin: string) => {
  const position = perpsStore
    .getState()
    .currentClearinghouseState?.assetPositions.find(
      item => item.position.coin === coin,
    );
  return position?.position.szi ?? null;
};

const defaultDependencies: ClosePositionDependencies = {
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getLiveSignedSize,
  limitClose: async params => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
    return exchange.limitOrderOpen(params);
  },
  marketClose: async params => {
    const exchange = apisPerps.getPerpsSDK().exchange;
    if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
    return exchange.marketOrderClose(params);
  },
  refreshClearinghouse: dex => fetchClearinghouseStateHttp(dex),
  refreshOpenOrders: dex => fetchPositionOpenOrdersHttp(dex),
  resolveDex: coin => getDexByCoin(coin),
};

const isPositionSnapshotCurrent = (
  command: PerpsClosePositionCommand,
  signedSize: string | null,
) => {
  const live = decimal(signedSize);
  if (!live || live.isZero()) return false;
  const direction = live.gt(0) ? 'long' : 'short';
  return (
    direction === command.direction &&
    live.abs().eq(command.expectedPositionSize)
  );
};

export const executePerpsClosePosition = async (
  command: PerpsClosePositionCommand,
  dependencies: ClosePositionDependencies = defaultDependencies,
): Promise<PerpsClosePositionResult> => {
  if (
    !isSamePerpsActionAccount(
      dependencies.getCurrentAccount(),
      command.account,
    ) ||
    !isPositionSnapshotCurrent(
      command,
      dependencies.getLiveSignedSize(command.coin),
    )
  ) {
    return { kind: 'staleContext' };
  }
  try {
    const isBuy = command.direction === 'short';
    const response =
      command.orderType === 'limit'
        ? await dependencies.limitClose({
            builder: PERPS_BUILDER_INFO,
            coin: command.coin,
            isBuy,
            limitPx: command.limitPrice || '',
            reduceOnly: true,
            size: command.size,
            tif: PERPS_LIMIT_TIF_DEFAULT,
          })
        : await dependencies.marketClose({
            builder: PERPS_BUILDER_INFO,
            coin: command.coin,
            isBuy,
            midPx: command.midPrice,
            reduceOnly: true,
            size: command.size,
          });
    const status = (
      response as {
        response?: { data?: { statuses?: unknown[] } };
        status?: unknown;
      }
    )?.response?.data?.statuses?.[0] as
      | {
          error?: string;
          filled?: { oid?: number };
          resting?: { oid?: number };
        }
      | undefined;
    if ((response as { status?: unknown })?.status !== 'ok' || status?.error) {
      throw new Error(status?.error || 'Hyperliquid rejected close order');
    }
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return { kind: 'staleContext' };
    }
    const kind = status?.filled ? 'filled' : status?.resting ? 'resting' : null;
    if (!kind) throw new Error('Missing Hyperliquid close order status');
    let refreshError: string | undefined;
    try {
      const dex = dependencies.resolveDex(command.coin);
      await (kind === 'filled'
        ? dependencies.refreshClearinghouse(dex)
        : Promise.all([
            dependencies.refreshClearinghouse(dex),
            dependencies.refreshOpenOrders(dex),
          ]));
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return { kind: 'staleContext', refreshError };
    }
    return {
      kind,
      oid: status?.[kind]?.oid,
      refreshError,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: message,
      failureReason: isPerpsActionUserCancelled(error)
        ? 'userCancelled'
        : isPerpsCloseMinimumNotionalError(message)
        ? 'minimumNotional'
        : 'requestFailed',
      kind: 'failed',
    };
  }
};
