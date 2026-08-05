import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

export type PerpsOpenOrderCategory = 'basic' | 'conditional' | 'unsupported';

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
  filledRatio: string;
  filledQuote: string;
  filledSize: string;
  key: string;
  oid: number;
  orderType: string;
  reduceOnly: boolean;
  remainingSize: string;
  side: 'buy' | 'sell';
  tif: string | null;
  timestamp: number;
  triggerCondition: string | null;
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
): PerpsOpenOrderViewModel => {
  const category = classifyPerpsOpenOrder(order);
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
    filledRatio: progress.filledRatio,
    filledQuote: limitPrice
      ? decimal(progress.filledSize).multipliedBy(limitPrice).toString()
      : '0',
    filledSize: progress.filledSize,
    key: `${category}:${order.coin}:${order.oid}`,
    oid: order.oid,
    orderType: order.orderType,
    reduceOnly: order.reduceOnly,
    remainingSize: BigNumber.max(decimal(order.sz), 0).toString(),
    side: order.side === 'B' ? 'buy' : 'sell',
    tif: order.tif,
    timestamp: order.timestamp,
    triggerCondition:
      category === 'conditional' ? order.triggerCondition || null : null,
    triggerPrice,
  };
};

const flattenOpenOrders = (
  orders: OpenOrder[],
  seen = new Set<number>(),
): OpenOrder[] => {
  const result: OpenOrder[] = [];
  for (const order of orders) {
    if (seen.has(order.oid)) {
      continue;
    }
    seen.add(order.oid);
    result.push(order);
    if (order.children?.length) {
      result.push(...flattenOpenOrders(order.children, seen));
    }
  }
  return result;
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

export const buildPerpsOpenOrders = (
  orders: OpenOrder[],
): PerpsOpenOrderViewModel[] =>
  sortPerpsOpenOrders(
    flattenOpenOrders(orders).map(buildPerpsOpenOrderViewModel),
  );

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
