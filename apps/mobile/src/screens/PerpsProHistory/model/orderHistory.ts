import BigNumber from 'bignumber.js';

import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { calculateOpenOrderProgress } from '@/screens/PerpsPro/model/openOrder';

import type {
  PerpsProHistoryOrderFact,
  PerpsProOrderHistoryRow,
} from '../types';
import { resolvePerpsProHistoryMarket } from './historyModel';

const positiveDecimalOrNull = (value: unknown) => {
  const decimal = new BigNumber((value as string | number | undefined) ?? 0);
  return decimal.isFinite() && decimal.gt(0) ? decimal : null;
};

const nonNegativeDecimalOrNull = (value: unknown) => {
  if (value == null || value === '') {
    return null;
  }
  const decimal = new BigNumber(value as string | number);
  return decimal.isFinite() && decimal.gte(0) ? decimal : null;
};

export const getPerpsProOrderHistoryKey = (fact: PerpsProHistoryOrderFact) =>
  `${fact.order.oid}:${fact.status}:${fact.statusTimestamp}`;

export const mapPerpsProOrderHistoryFact = (
  fact: PerpsProHistoryOrderFact,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
): PerpsProOrderHistoryRow => {
  const { order } = fact;
  const originalSize = nonNegativeDecimalOrNull(order.origSz);
  const remainingSize = nonNegativeDecimalOrNull(order.sz);
  const progress =
    originalSize && remainingSize
      ? calculateOpenOrderProgress({
          originalSize,
          remainingSize,
        })
      : null;
  const isMarket = order.orderType.toLowerCase().includes('market');
  const price = isMarket ? null : positiveDecimalOrNull(order.limitPx);
  const filledSize = progress?.filledSize ?? null;

  return {
    amountBase: originalSize?.toString() ?? null,
    amountQuote:
      price && originalSize
        ? originalSize.multipliedBy(price).toString()
        : null,
    displayAmountUnit: isMarket ? 'base' : 'quote',
    filledBase: filledSize,
    filledQuote:
      price && filledSize != null
        ? new BigNumber(filledSize).multipliedBy(price).toString()
        : null,
    key: getPerpsProOrderHistoryKey(fact),
    kind: 'orders',
    market: resolvePerpsProHistoryMarket(order.coin, marketDataMap),
    oid: order.oid,
    orderType: order.orderType || 'Unknown',
    price: price?.toString() ?? null,
    priceKind: isMarket ? 'market' : 'limit',
    reduceOnly: order.reduceOnly,
    remainingBase: remainingSize?.toString() ?? null,
    side: order.side === 'B' ? 'buy' : 'sell',
    status: fact.status || 'unknown',
    tif: order.tif || null,
    time: fact.statusTimestamp,
  };
};
