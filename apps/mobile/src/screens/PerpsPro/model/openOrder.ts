import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import {
  buildPerpsOpenOrderTopology,
  type PerpsOpenOrderTopology,
} from './openOrderTopology';

export type PerpsOpenOrderCategory = 'basic' | 'conditional' | 'unsupported';
export type PerpsOpenOrderEditKind = 'basicLimit' | 'partialTpSlMarket';
export type PerpsOpenOrderTriggerKind = 'stopLoss' | 'takeProfit';

export interface PerpsOpenOrderProgress {
  filledRatio: string;
  filledSize: string;
}

export interface PerpsOpenOrderViewModel {
  amountBase: string;
  amountQuote: string;
  category: PerpsOpenOrderCategory;
  coin: string;
  displayAmountQuote: string | null;
  executionPrice: string | null;
  executionPriceKind: 'limit' | 'market';
  editKind: PerpsOpenOrderEditKind | null;
  filledRatio: string;
  filledQuote: string;
  filledSize: string;
  key: string;
  isPositionTpsl: boolean;
  isTopLevel: boolean;
  isTrigger: boolean;
  oid: number;
  orderType: string;
  reduceOnly: boolean;
  remainingSize: string;
  side: 'buy' | 'sell';
  tif: string | null;
  timestamp: number;
  triggerCondition: string | null;
  triggerKind: PerpsOpenOrderTriggerKind | null;
  triggerPrice: string | null;
}

const decimal = (value: unknown): BigNumber => {
  const result = new BigNumber((value as string | number | undefined) ?? 0);
  return result.isFinite() ? result : new BigNumber(0);
};

const positiveDecimalOrNull = (value: unknown): string | null => {
  const result = decimal(value);
  return result.gt(0) ? result.toString() : null;
};

const resolveTriggerKind = (
  order: OpenOrder,
): PerpsOpenOrderTriggerKind | null => {
  const orderType = String(order.orderType || '').toLowerCase();
  if (orderType === 'take profit market') {
    return 'takeProfit';
  }
  if (orderType === 'stop market') {
    return 'stopLoss';
  }
  return null;
};

const resolveEditKind = ({
  category,
  hasChildren,
  isTopLevel,
  order,
}: {
  category: PerpsOpenOrderCategory;
  hasChildren: boolean;
  isTopLevel: boolean;
  order: OpenOrder;
}): PerpsOpenOrderEditKind | null => {
  if (!isTopLevel || hasChildren || !positiveDecimalOrNull(order.sz)) {
    return null;
  }
  if (
    category === 'basic' &&
    order.orderType === 'Limit' &&
    (order.tif === 'Gtc' || order.tif === 'Alo') &&
    !!positiveDecimalOrNull(order.limitPx)
  ) {
    return 'basicLimit';
  }
  if (
    category === 'conditional' &&
    order.isTrigger &&
    !order.isPositionTpsl &&
    order.reduceOnly &&
    !!positiveDecimalOrNull(order.triggerPx) &&
    !!resolveTriggerKind(order)
  ) {
    return 'partialTpSlMarket';
  }
  return null;
};

const calculateDisplayAmountQuote = ({
  amountBase,
  category,
  executionPriceKind,
  limitPrice,
  triggerPrice,
}: {
  amountBase: BigNumber;
  category: PerpsOpenOrderCategory;
  executionPriceKind: 'limit' | 'market';
  limitPrice: string | null;
  triggerPrice: string | null;
}): string | null => {
  if (category !== 'conditional') {
    return limitPrice ? amountBase.multipliedBy(limitPrice).toString() : null;
  }

  const referencePrice =
    executionPriceKind === 'market' ? triggerPrice : limitPrice;
  return referencePrice
    ? amountBase.multipliedBy(referencePrice).toString()
    : null;
};

export const classifyPerpsOpenOrder = (
  order: OpenOrder,
): PerpsOpenOrderCategory => {
  if (order.coin.includes('@')) {
    return 'unsupported';
  }
  if (
    !order.isTrigger &&
    !order.isPositionTpsl &&
    order.orderType === 'Limit'
  ) {
    return 'basic';
  }
  if (order.isTrigger || order.isPositionTpsl) {
    return 'conditional';
  }
  return 'unsupported';
};

export const calculateOpenOrderProgress = ({
  originalSize,
  remainingSize,
}: {
  originalSize: unknown;
  remainingSize: unknown;
}): PerpsOpenOrderProgress => {
  const original = BigNumber.max(decimal(originalSize), 0);
  const remaining = BigNumber.max(decimal(remainingSize), 0);
  const filled = BigNumber.max(original.minus(remaining), 0);
  const ratio = original.gt(0)
    ? BigNumber.min(BigNumber.max(filled.dividedBy(original), 0), 1)
    : new BigNumber(0);
  return {
    filledRatio: ratio.toString(),
    filledSize: filled.toString(),
  };
};

export const buildPerpsOpenOrderViewModel = (
  order: OpenOrder,
  context: { isTopLevel?: boolean } = {},
): PerpsOpenOrderViewModel => {
  const category = classifyPerpsOpenOrder(order);
  const isTopLevel = context.isTopLevel !== false;
  const progress = calculateOpenOrderProgress({
    originalSize: order.origSz,
    remainingSize: order.sz,
  });
  const amountBase = BigNumber.max(decimal(order.origSz), 0);
  const limitPrice = positiveDecimalOrNull(order.limitPx);
  const isMarket = order.orderType.toLowerCase().includes('market');
  const executionPriceKind = isMarket ? 'market' : 'limit';
  const triggerPrice =
    category === 'conditional' ? positiveDecimalOrNull(order.triggerPx) : null;

  return {
    amountBase: amountBase.toString(),
    amountQuote: limitPrice
      ? amountBase.multipliedBy(limitPrice).toString()
      : '0',
    category,
    coin: order.coin,
    displayAmountQuote: calculateDisplayAmountQuote({
      amountBase,
      category,
      executionPriceKind,
      limitPrice,
      triggerPrice,
    }),
    executionPrice: isMarket ? null : limitPrice,
    executionPriceKind,
    editKind: resolveEditKind({
      category,
      hasChildren: !!order.children?.length,
      isTopLevel,
      order,
    }),
    filledRatio: progress.filledRatio,
    filledQuote: limitPrice
      ? decimal(progress.filledSize).multipliedBy(limitPrice).toString()
      : '0',
    filledSize: progress.filledSize,
    key: `${category}:${order.coin}:${order.oid}`,
    isPositionTpsl: order.isPositionTpsl,
    isTopLevel,
    isTrigger: order.isTrigger,
    oid: order.oid,
    orderType: order.orderType,
    reduceOnly: order.reduceOnly,
    remainingSize: BigNumber.max(decimal(order.sz), 0).toString(),
    side: order.side === 'B' ? 'buy' : 'sell',
    tif: order.tif,
    timestamp: order.timestamp,
    triggerCondition:
      category === 'conditional' ? order.triggerCondition || null : null,
    triggerKind: category === 'conditional' ? resolveTriggerKind(order) : null,
    triggerPrice,
  };
};

export const sortPerpsOpenOrders = (
  orders: PerpsOpenOrderViewModel[],
): PerpsOpenOrderViewModel[] =>
  [...orders].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return right.timestamp - left.timestamp;
    }
    const coinOrder = left.coin.localeCompare(right.coin);
    if (coinOrder !== 0) {
      return coinOrder;
    }
    return left.oid - right.oid;
  });

export const buildPerpsOpenOrdersFromTopology = (
  topology: PerpsOpenOrderTopology,
): PerpsOpenOrderViewModel[] =>
  sortPerpsOpenOrders(
    topology.nodes.map(({ isTopLevel, order }) =>
      buildPerpsOpenOrderViewModel(order, { isTopLevel }),
    ),
  );

export const buildPerpsOpenOrders = (
  orders: readonly OpenOrder[],
): PerpsOpenOrderViewModel[] =>
  buildPerpsOpenOrdersFromTopology(buildPerpsOpenOrderTopology(orders));

export const getPerpsOpenOrderCounts = (orders: PerpsOpenOrderViewModel[]) => ({
  basic: orders.filter(order => order.category === 'basic').length,
  conditional: orders.filter(order => order.category === 'conditional').length,
  unsupported: orders.filter(order => order.category === 'unsupported').length,
});

export const filterPerpsOpenOrders = ({
  canonicalCoin,
  category,
  hideOtherSymbols,
  orders,
}: {
  canonicalCoin: string;
  category: Exclude<PerpsOpenOrderCategory, 'unsupported'>;
  hideOtherSymbols: boolean;
  orders: PerpsOpenOrderViewModel[];
}): PerpsOpenOrderViewModel[] =>
  orders.filter(
    order =>
      order.category === category &&
      (!hideOtherSymbols || order.coin === canonicalCoin),
  );
