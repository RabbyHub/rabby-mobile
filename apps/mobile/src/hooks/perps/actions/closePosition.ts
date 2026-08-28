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
import type { PerpsConfirmedOrder } from './confirmedOrder';

export type PerpsCloseOrderType = 'limit' | 'market';

export interface PerpsClosePositionCommand {
  account: Pick<Account, 'address' | 'type'>;
  coin: string;
  direction: 'long' | 'short';
  expectedPositionSize: string;
  limitPrice: string | null;
  midPrice: string;
  orderType: PerpsCloseOrderType;
  reportingFacts: Readonly<{
    leverage: number;
    marginMode: 'cross' | 'isolated';
  }>;
  size: string;
  type: 'closePosition';
}

export interface PerpsClosePositionResult {
  confirmed?: PerpsConfirmedOrder;
  error?: string;
  failureReason?: 'minimumNotional' | 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'filled' | 'resting' | 'staleContext' | 'unknownOutcome';
  oid?: number;
  refreshError?: string;
}

export interface ClosePositionDependencies {
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getLiveMidPrice: (coin: string) => string | null;
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
  reportingFacts,
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
    reportingFacts: Object.freeze({ ...reportingFacts }),
    size: normalizedSize,
    type: 'closePosition' as const,
  });
};

export const finalizePerpsMarketClosePositionCommand = (
  command: PerpsClosePositionCommand,
  midPrice: string,
): PerpsClosePositionCommand => {
  const mid = decimal(midPrice);
  if (command.orderType !== 'market' || !mid?.gt(0)) {
    throw new Error('Market Mid price is unavailable');
  }
  const amountValidation = validatePerpsCloseAmount({
    expectedPositionSize: command.expectedPositionSize,
    referencePrice: mid.toFixed(),
    size: command.size,
  });
  if (amountValidation.kind === 'invalid') {
    throw new Error(
      amountValidation.reason === 'belowMinimumNotional'
        ? PERPS_CLOSE_MINIMUM_NOTIONAL_ERROR
        : 'Invalid Perps close amount',
    );
  }
  return Object.freeze({
    ...command,
    midPrice: mid.toFixed(),
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
  getLiveMidPrice: coin =>
    perpsStore.getState().marketDataMap[coin]?.midPx ?? null,
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

const isUnknownOutcomeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network request failed|failed to fetch|connection/i.test(
    message,
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
  let executableCommand = command;
  if (command.orderType === 'market') {
    const liveMidPrice = dependencies.getLiveMidPrice(command.coin);
    if (!decimal(liveMidPrice)?.gt(0)) {
      return { kind: 'staleContext' };
    }
    try {
      executableCommand = finalizePerpsMarketClosePositionCommand(
        command,
        liveMidPrice ?? '',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: message,
        failureReason: isPerpsCloseMinimumNotionalError(message)
          ? 'minimumNotional'
          : 'requestFailed',
        kind: 'failed',
      };
    }
  }
  try {
    const isBuy = executableCommand.direction === 'short';
    const response =
      executableCommand.orderType === 'limit'
        ? await dependencies.limitClose({
            builder: PERPS_BUILDER_INFO,
            coin: executableCommand.coin,
            isBuy,
            limitPx: executableCommand.limitPrice || '',
            reduceOnly: true,
            size: executableCommand.size,
            tif: PERPS_LIMIT_TIF_DEFAULT,
          })
        : await dependencies.marketClose({
            builder: PERPS_BUILDER_INFO,
            coin: executableCommand.coin,
            isBuy,
            midPx: executableCommand.midPrice,
            reduceOnly: true,
            size: executableCommand.size,
          });
    const status = (
      response as {
        response?: { data?: { statuses?: unknown[] } };
        status?: unknown;
      }
    )?.response?.data?.statuses?.[0] as
      | {
          error?: string;
          filled?: {
            avgPx?: string;
            oid?: number;
            totalSz?: string;
          };
          resting?: { oid?: number };
        }
      | undefined;
    if ((response as { status?: unknown })?.status !== 'ok' || status?.error) {
      throw new Error(status?.error || 'Hyperliquid rejected close order');
    }
    const confirmed: PerpsConfirmedOrder | undefined = status?.filled
      ? Object.freeze({
          acceptance: 'filled' as const,
          oid: status.filled.oid,
          price: status.filled.avgPx ?? '',
          size: status.filled.totalSz ?? '',
        })
      : status?.resting
      ? Object.freeze({
          acceptance: 'resting' as const,
          oid: status.resting.oid,
          price:
            executableCommand.orderType === 'limit'
              ? executableCommand.limitPrice ?? ''
              : executableCommand.midPrice,
          size: executableCommand.size,
        })
      : undefined;
    if (
      !isSamePerpsActionAccount(
        dependencies.getCurrentAccount(),
        command.account,
      )
    ) {
      return { confirmed, kind: 'staleContext' };
    }
    if (!confirmed) throw new Error('Missing Hyperliquid close order status');
    const kind = confirmed.acceptance;
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
      return { confirmed, kind: 'staleContext', refreshError };
    }
    return {
      confirmed,
      kind,
      oid: confirmed.oid,
      refreshError,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isPerpsActionUserCancelled(error)) {
      return {
        error: message,
        failureReason: 'userCancelled',
        kind: 'failed',
      };
    }
    if (isUnknownOutcomeError(error)) {
      let refreshError: string | undefined;
      try {
        const dex = dependencies.resolveDex(command.coin);
        await Promise.all([
          dependencies.refreshClearinghouse(dex),
          dependencies.refreshOpenOrders(dex),
        ]);
      } catch (refreshFailure) {
        refreshError =
          refreshFailure instanceof Error
            ? refreshFailure.message
            : String(refreshFailure);
      }
      return {
        error: message,
        kind: 'unknownOutcome',
        refreshError,
      };
    }
    return {
      error: message,
      failureReason: isPerpsCloseMinimumNotionalError(message)
        ? 'minimumNotional'
        : 'requestFailed',
      kind: 'failed',
    };
  }
};
