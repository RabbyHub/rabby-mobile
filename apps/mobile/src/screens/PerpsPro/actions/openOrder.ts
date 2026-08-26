import { PERPS_BUILDER_INFO, PERPS_MINI_USD_VALUE } from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import type { Account } from '@/core/startupServices/preference';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  fetchClearinghouseStateHttp,
  fetchPositionOpenOrdersHttp,
  getDexByCoin,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import BigNumber from 'bignumber.js';

import type { PerpsProOrderReviewFacts } from '../model/orderReview';
import type { PerpsProBboStrategy } from '../model/bbo';
import {
  getPerpsProTradeExecutionPrice,
  inferPerpsProConditionalClassification,
  isPerpsProPriceProtocolValid,
  isPerpsProTradeCombinationSupported,
  resolvePerpsProMinimumOrderAmount,
  resolvePerpsProTradeAmount,
  type PerpsProTradeFormState,
  type PerpsProTradeSide,
} from '../model/trade';

export type PerpsProOpenOrderExecution =
  | { kind: 'market'; slippageReferenceMidPrice: string }
  | { kind: 'limit'; limitPrice: string; tif: 'Alo' | 'Gtc' | 'Ioc' }
  | { kind: 'bboLimit'; strategy: PerpsProBboStrategy }
  | {
      kind: 'conditionalMarket';
      referencePrice: string;
      tpsl: 'sl' | 'tp';
      triggerPrice: string;
    }
  | {
      kind: 'conditionalLimit';
      limitPrice: string;
      referencePrice: string;
      tpsl: 'sl' | 'tp';
      triggerPrice: string;
    };

export interface PerpsProOpenOrderCommand {
  account: Pick<Account, 'address' | 'type'>;
  baseSize: string;
  bboSessionKey?: string;
  coin: string;
  dexId: string;
  execution: PerpsProOpenOrderExecution;
  marketKey: string;
  orderType: PerpsProTradeFormState['orderType'];
  quoteAmount: string;
  reduceOnly: boolean;
  reviewFacts?: PerpsProOrderReviewFacts;
  side: PerpsProTradeSide;
  type: 'openOrder';
}

export interface PerpsProOpenOrderResult {
  error?: string;
  failureReason?: 'regionRestricted' | 'requestFailed' | 'userCancelled';
  kind: 'failed' | 'filled' | 'resting' | 'staleContext' | 'unknownOutcome';
  oid?: number;
  refreshError?: string;
}

const decimal = (value: unknown) => {
  const number = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return number.isFinite() ? number : null;
};

export const finalizePerpsProBboOpenOrderCommand = (
  command: PerpsProOpenOrderCommand,
  limitPrice: string,
): PerpsProOpenOrderCommand => {
  const price = decimal(limitPrice);
  const baseSize = decimal(command.baseSize);
  if (
    command.execution.kind !== 'bboLimit' ||
    !price?.gt(0) ||
    !baseSize?.gt(0)
  ) {
    throw new Error('BBO order price is unavailable');
  }
  return Object.freeze({
    ...command,
    execution: Object.freeze({
      kind: 'limit' as const,
      limitPrice: price.toFixed(),
      tif: 'Gtc' as const,
    }),
    quoteAmount: baseSize.multipliedBy(price).toFixed(),
  });
};

export const buildPerpsProOpenOrderCommand = ({
  account,
  amountReferencePrice,
  bboPrice,
  bboSessionKey,
  coin,
  dexId,
  form,
  marketKey,
  marketPrice,
  maxUsdValueSize,
  reviewFacts,
  side,
  szDecimals,
}: {
  account: Pick<Account, 'address' | 'type'>;
  amountReferencePrice?: string;
  bboPrice: string | null;
  bboSessionKey?: string | null;
  coin: string;
  dexId: string;
  form: PerpsProTradeFormState;
  marketKey: string;
  marketPrice: string;
  maxUsdValueSize?: string;
  reviewFacts?: PerpsProOrderReviewFacts;
  side: PerpsProTradeSide;
  szDecimals: number;
}): PerpsProOpenOrderCommand => {
  const normalizedCoin = coin.trim();
  if (!account.address || !normalizedCoin || !marketKey) {
    throw new Error('Perps account and market are required');
  }
  if (form.attachedTpSl.enabled) {
    throw new Error('Attached TP/SL must use its dedicated executor');
  }
  if (!isPerpsProTradeCombinationSupported(form)) {
    throw new Error('Unsupported Perps order combination');
  }
  const executionPrice = getPerpsProTradeExecutionPrice({
    bboPrice,
    form,
    marketPrice,
  });
  if (!executionPrice) {
    throw new Error('Perps order price is unavailable');
  }
  if (form.orderType === 'limit' && form.bboEnabled && !form.bboStrategy) {
    throw new Error('BBO strategy is unavailable');
  }
  if (form.orderType === 'limit' && form.bboEnabled && !bboSessionKey) {
    throw new Error('BBO order book is unavailable');
  }
  const amountPrice = amountReferencePrice ?? executionPrice;
  const amount = resolvePerpsProTradeAmount({
    amount: form.amount,
    amountUnit: form.amountUnit,
    price: amountPrice,
    szDecimals,
  });
  if (!amount) {
    throw new Error('Invalid Perps order amount');
  }
  if (new BigNumber(amount.quoteAmount).lt(PERPS_MINI_USD_VALUE)) {
    const minimum = resolvePerpsProMinimumOrderAmount({
      minimumQuoteAmount: PERPS_MINI_USD_VALUE,
      price: amountPrice,
      szDecimals,
    });
    throw new Error(
      `Minimum amount is ${
        minimum?.displayQuoteAmount ?? PERPS_MINI_USD_VALUE
      }`,
    );
  }
  const maximum = decimal(maxUsdValueSize);
  if (maximum?.gt(0) && new BigNumber(amount.quoteAmount).gt(maximum)) {
    throw new Error(`Maximum amount is ${maximum.toFixed()}`);
  }
  const isBuy = side === 'buy';
  let execution: PerpsProOpenOrderExecution;
  if (form.orderType === 'market') {
    execution = {
      kind: 'market',
      slippageReferenceMidPrice: marketPrice,
    };
  } else if (form.orderType === 'limit') {
    execution = form.bboEnabled
      ? { kind: 'bboLimit', strategy: form.bboStrategy! }
      : {
          kind: 'limit',
          limitPrice: executionPrice,
          tif: form.tif,
        };
  } else {
    const tpsl = inferPerpsProConditionalClassification({
      isBuy,
      referencePrice: marketPrice,
      triggerPrice: form.triggerPrice,
    });
    if (!tpsl) {
      throw new Error('Trigger price must differ from the current price');
    }
    execution =
      form.conditionalExecution === 'limit'
        ? {
            kind: 'conditionalLimit',
            limitPrice: form.conditionalLimitPrice,
            referencePrice: marketPrice,
            tpsl,
            triggerPrice: form.triggerPrice,
          }
        : {
            kind: 'conditionalMarket',
            referencePrice: marketPrice,
            tpsl,
            triggerPrice: form.triggerPrice,
          };
  }
  const priceValues = [
    execution.kind === 'market' ? execution.slippageReferenceMidPrice : null,
    execution.kind === 'limit' ? execution.limitPrice : null,
    execution.kind === 'conditionalLimit' ? execution.limitPrice : null,
    execution.kind === 'conditionalLimit' ||
    execution.kind === 'conditionalMarket'
      ? execution.triggerPrice
      : null,
  ].filter((value): value is string => value != null);
  const protocolPriceValues = [
    execution.kind === 'limit' ? execution.limitPrice : null,
    execution.kind === 'conditionalLimit' ? execution.limitPrice : null,
    execution.kind === 'conditionalLimit' ||
    execution.kind === 'conditionalMarket'
      ? execution.triggerPrice
      : null,
  ].filter((value): value is string => value != null);
  if (
    priceValues.some(value => !decimal(value)?.gt(0)) ||
    protocolPriceValues.some(
      value => !isPerpsProPriceProtocolValid(value, szDecimals),
    )
  ) {
    throw new Error('Invalid Perps order price');
  }
  return Object.freeze({
    account: Object.freeze({ address: account.address, type: account.type }),
    baseSize: amount.baseSize,
    bboSessionKey:
      form.orderType === 'limit' && form.bboEnabled
        ? bboSessionKey ?? undefined
        : undefined,
    coin: normalizedCoin,
    dexId,
    execution: Object.freeze(execution),
    marketKey,
    orderType: form.orderType,
    quoteAmount: amount.quoteAmount,
    reduceOnly: form.reduceOnly,
    reviewFacts: reviewFacts ? Object.freeze({ ...reviewFacts }) : undefined,
    side,
    type: 'openOrder' as const,
  });
};

export interface PerpsProOpenOrderDependencies {
  conditionalLimit: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    limitPx: string;
    reduceOnly: boolean;
    size: string;
    tpsl: 'sl' | 'tp';
    triggerPx: string;
  }) => Promise<unknown>;
  conditionalMarket: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    reduceOnly: boolean;
    size: string;
    tpsl: 'sl' | 'tp';
    triggerPx: string;
  }) => Promise<unknown>;
  getCurrentAccount: () => Pick<Account, 'address' | 'type'> | null;
  getCurrentDex: (coin: string) => string;
  hasPermission: () => boolean;
  limitOrder: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    limitPx: string;
    reduceOnly: boolean;
    size: string;
    tif: 'Alo' | 'Gtc' | 'Ioc';
  }) => Promise<unknown>;
  marketOrder: (params: {
    builder: typeof PERPS_BUILDER_INFO;
    coin: string;
    isBuy: boolean;
    midPx: string;
    reduceOnly: boolean;
    size: string;
  }) => Promise<unknown>;
  refreshClearinghouse: (dex: string) => Promise<unknown> | unknown;
  refreshOpenOrders: (dex: string) => Promise<unknown> | unknown;
}

const getExchange = () => {
  const exchange = apisPerps.getPerpsSDK().exchange;
  if (!exchange) throw new Error('Hyperliquid exchange client unavailable');
  return exchange;
};

const defaultDependencies: PerpsProOpenOrderDependencies = {
  conditionalLimit: params => getExchange().placeTPSlLimitOrder(params),
  conditionalMarket: params => getExchange().placeTPSlMarketOrder(params),
  getCurrentAccount: () => perpsStore.getState().currentPerpsAccount,
  getCurrentDex: coin => getDexByCoin(coin),
  hasPermission: () => perpsStore.getState().hasPermission,
  limitOrder: params => getExchange().limitOrderOpen(params),
  marketOrder: params => getExchange().marketOrderOpen(params),
  refreshClearinghouse: dex => fetchClearinghouseStateHttp(dex),
  refreshOpenOrders: dex => fetchPositionOpenOrdersHttp(dex),
};

const isContextCurrent = (
  command: PerpsProOpenOrderCommand,
  dependencies: PerpsProOpenOrderDependencies,
  sceneGuard?: () => boolean,
) =>
  (sceneGuard?.() ?? true) &&
  isSamePerpsActionAccount(dependencies.getCurrentAccount(), command.account) &&
  dependencies.getCurrentDex(command.coin) === command.dexId;

const isUnknownOutcomeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network request failed|failed to fetch|connection/i.test(
    message,
  );
};

export const executePerpsProOpenOrder = async (
  command: PerpsProOpenOrderCommand,
  dependencies: PerpsProOpenOrderDependencies = defaultDependencies,
  sceneGuard?: () => boolean,
): Promise<PerpsProOpenOrderResult> => {
  const legacyAttached = command as PerpsProOpenOrderCommand & {
    attached?: unknown;
    parent?: unknown;
    slTriggerPrice?: string;
    tpTriggerPrice?: string;
  };
  if (
    legacyAttached.type !== 'openOrder' ||
    legacyAttached.attached ||
    legacyAttached.parent ||
    legacyAttached.tpTriggerPrice ||
    legacyAttached.slTriggerPrice
  ) {
    return {
      error: 'Attached TP/SL real execution is not enabled',
      failureReason: 'requestFailed',
      kind: 'failed',
    };
  }
  if (!dependencies.hasPermission()) {
    return { failureReason: 'regionRestricted', kind: 'failed' };
  }
  if (command.execution.kind === 'bboLimit') {
    return {
      error: 'BBO price must be finalized immediately before submission',
      failureReason: 'requestFailed',
      kind: 'failed',
    };
  }
  if (!isContextCurrent(command, dependencies, sceneGuard)) {
    return { kind: 'staleContext' };
  }
  try {
    const common = {
      builder: PERPS_BUILDER_INFO,
      coin: command.coin,
      isBuy: command.side === 'buy',
      reduceOnly: command.reduceOnly,
      size: command.baseSize,
    };
    if (!dependencies.hasPermission()) {
      return { failureReason: 'regionRestricted', kind: 'failed' };
    }
    const response =
      command.execution.kind === 'market'
        ? await dependencies.marketOrder({
            ...common,
            midPx: command.execution.slippageReferenceMidPrice,
          })
        : command.execution.kind === 'limit'
        ? await dependencies.limitOrder({
            ...common,
            limitPx: command.execution.limitPrice,
            tif: command.execution.tif,
          })
        : command.execution.kind === 'conditionalMarket'
        ? await dependencies.conditionalMarket({
            ...common,
            tpsl: command.execution.tpsl,
            triggerPx: command.execution.triggerPrice,
          })
        : await dependencies.conditionalLimit({
            ...common,
            limitPx: command.execution.limitPrice,
            tpsl: command.execution.tpsl,
            triggerPx: command.execution.triggerPrice,
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
      throw new Error(status?.error || 'Hyperliquid rejected order');
    }
    if (!isContextCurrent(command, dependencies, sceneGuard)) {
      return { kind: 'staleContext' };
    }
    const kind = status?.filled ? 'filled' : status?.resting ? 'resting' : null;
    if (!kind) throw new Error('Missing Hyperliquid order status');
    let refreshError: string | undefined;
    try {
      await (kind === 'filled'
        ? dependencies.refreshClearinghouse(command.dexId)
        : dependencies.refreshOpenOrders(command.dexId));
    } catch (error) {
      refreshError = error instanceof Error ? error.message : String(error);
    }
    if (!isContextCurrent(command, dependencies, sceneGuard)) {
      return { kind: 'staleContext', refreshError };
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
