import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import type { PerpsProOrderHistoryRow } from '../types';

type PerpsProOrderExecutionPoint = Readonly<{
  cumulativeBase: BigNumber;
  cumulativeQuote: BigNumber;
  time: number;
}>;

export type PerpsProOrderExecutionIndex = ReadonlyMap<
  string,
  readonly PerpsProOrderExecutionPoint[]
>;

export type PerpsProOrderExecution = Readonly<{
  filledQuote: string;
  price: string;
}>;

const getOrderExecutionKey = (coin: string, oid: number) =>
  `${coin.trim().toLowerCase()}:${oid}`;

const positiveDecimalOrNull = (value: unknown) => {
  const decimal = new BigNumber((value as string | number | undefined) ?? 0);
  return decimal.isFinite() && decimal.gt(0) ? decimal : null;
};

export const buildPerpsProOrderExecutionIndex = (
  fills: readonly WsFill[],
): PerpsProOrderExecutionIndex => {
  const grouped = new Map<string, WsFill[]>();
  fills.forEach(fill => {
    if (
      !Number.isFinite(fill.time) ||
      !Number.isFinite(fill.oid) ||
      !positiveDecimalOrNull(fill.px) ||
      !positiveDecimalOrNull(fill.sz)
    ) {
      return;
    }
    const key = getOrderExecutionKey(fill.coin, fill.oid);
    const group = grouped.get(key);
    if (group) {
      group.push(fill);
    } else {
      grouped.set(key, [fill]);
    }
  });

  const index = new Map<string, readonly PerpsProOrderExecutionPoint[]>();
  grouped.forEach((group, key) => {
    let cumulativeBase = new BigNumber(0);
    let cumulativeQuote = new BigNumber(0);
    const points = [...group]
      .sort((left, right) => left.time - right.time || left.tid - right.tid)
      .map(fill => {
        const size = new BigNumber(fill.sz);
        const price = new BigNumber(fill.px);
        cumulativeBase = cumulativeBase.plus(size);
        cumulativeQuote = cumulativeQuote.plus(size.multipliedBy(price));
        return {
          cumulativeBase,
          cumulativeQuote,
          time: fill.time,
        };
      });
    index.set(key, points);
  });
  return index;
};

export const resolvePerpsProOrderExecution = ({
  coin,
  expectedFilledBase,
  index,
  oid,
  statusTimestamp,
}: {
  coin: string;
  expectedFilledBase: string | null;
  index: PerpsProOrderExecutionIndex;
  oid: number;
  statusTimestamp: number;
}): PerpsProOrderExecution | null => {
  const expected = positiveDecimalOrNull(expectedFilledBase);
  const points = index.get(getOrderExecutionKey(coin, oid));
  if (!expected || !points?.length || !Number.isFinite(statusTimestamp)) {
    return null;
  }

  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].time <= statusTimestamp) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const point = points[low - 1];
  if (!point || !point.cumulativeBase.eq(expected)) {
    return null;
  }
  return {
    filledQuote: point.cumulativeQuote.toString(),
    price: point.cumulativeQuote.dividedBy(point.cumulativeBase).toString(),
  };
};

export const applyPerpsProOrderExecution = (
  row: PerpsProOrderHistoryRow,
  index: PerpsProOrderExecutionIndex,
): PerpsProOrderHistoryRow => {
  const execution = resolvePerpsProOrderExecution({
    coin: row.market.coin,
    expectedFilledBase: row.filledBase,
    index,
    oid: row.oid,
    statusTimestamp: row.time,
  });
  const amountBase = positiveDecimalOrNull(row.amountBase);
  const executionPrice = execution ? new BigNumber(execution.price) : null;
  return {
    ...row,
    amountQuote:
      row.priceKind === 'market'
        ? amountBase && executionPrice
          ? amountBase.multipliedBy(executionPrice).toString()
          : null
        : row.amountQuote,
    executionPrice: execution?.price ?? null,
    filledQuote:
      row.priceKind === 'market'
        ? execution?.filledQuote ?? null
        : row.filledQuote,
  };
};
