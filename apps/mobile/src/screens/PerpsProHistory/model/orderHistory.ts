import BigNumber from 'bignumber.js';
import type { SpotMeta } from '@rabby-wallet/hyperliquid-sdk';

import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { calculateOpenOrderProgress } from '@/screens/PerpsPro/model/openOrder';

import type {
  PerpsProHistoryOrderFact,
  PerpsProOrderHistoryRow,
} from '../types';
import { resolvePerpsProHistoryMarket } from './historyModel';
import {
  applyPerpsProOrderExecution,
  type PerpsProOrderExecutionIndex,
} from './orderExecution';

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
  executionIndex: PerpsProOrderExecutionIndex = new Map(),
  spotMeta?: SpotMeta | null,
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

  return applyPerpsProOrderExecution(
    {
      amountBase: originalSize?.toString() ?? null,
      amountQuote:
        price && originalSize
          ? originalSize.multipliedBy(price).toString()
          : null,
      executionPrice: null,
      filledBase: filledSize,
      filledQuote:
        price && filledSize != null
          ? new BigNumber(filledSize).multipliedBy(price).toString()
          : null,
      key: getPerpsProOrderHistoryKey(fact),
      kind: 'orders',
      isTrigger: order.isTrigger,
      market: resolvePerpsProHistoryMarket(order.coin, marketDataMap, spotMeta),
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
    },
    executionIndex,
  );
};
