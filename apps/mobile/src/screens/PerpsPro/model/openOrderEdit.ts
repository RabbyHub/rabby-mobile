import BigNumber from 'bignumber.js';

import type { PerpsOpenOrderViewModel } from './openOrder';
import type { PerpsPositionViewModel } from './position';
import {
  resolvePerpsProDisplayAmount,
  resolvePerpsProTradeAmount,
  type PerpsProTradeAmountUnit,
} from './trade';

export type PerpsProOpenOrderEditCategory = 'basic' | 'conditional';

export type PerpsProOpenOrderEditMarketSnapshot = {
  dexId: string;
  displayBase: string;
  displayPair: string;
  markPrice: string;
  marketKey: string;
  pxDecimals: number;
  quoteAsset: string;
  sourceTag: string | null;
  szDecimals: number;
};

export type PerpsProBasicOrderEditDraft = {
  amount: string;
  amountTouched: boolean;
  price: string;
};

export type PerpsProConditionalOrderEditDraft = {
  baseSize: string;
  limitPrice: string | null;
  triggerPrice: string;
};

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

export const isRelevantOpenOrderEditPosition = (
  order: PerpsOpenOrderViewModel,
  position: PerpsPositionViewModel | null | undefined,
) =>
  !!position &&
  order.category === 'conditional' &&
  (order.reduceOnly || order.isPositionTpsl) &&
  order.coin === position.coin &&
  ((position.direction === 'long' && order.side === 'sell') ||
    (position.direction === 'short' && order.side === 'buy'));

export const getOpenOrderEditDisplayAmount = ({
  amountUnit,
  baseSize,
  referencePrice,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  baseSize: string;
  referencePrice: string | null;
}) =>
  resolvePerpsProDisplayAmount({
    amountUnit,
    baseAmount: baseSize,
    price: referencePrice,
  });

export const resolveBasicOrderEditBaseSize = ({
  amountUnit,
  draft,
  remainingSize,
  szDecimals,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  draft: PerpsProBasicOrderEditDraft;
  remainingSize: string;
  szDecimals: number;
}) => {
  if (!draft.amountTouched) {
    const remaining = positive(remainingSize);
    return (
      remaining?.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN).toFixed() ??
      null
    );
  }
  return (
    resolvePerpsProTradeAmount({
      amount: draft.amount,
      amountUnit,
      price: draft.price,
      szDecimals,
    })?.baseSize ?? null
  );
};

export const calculateOpenOrderEditEstimatedPnl = ({
  direction,
  entryPrice,
  size,
  triggerPrice,
}: {
  direction: 'long' | 'short';
  entryPrice: string | null;
  size: string;
  triggerPrice: string;
}) => {
  const entry = positive(entryPrice);
  const trigger = positive(triggerPrice);
  const amount = positive(size);
  if (!entry || !trigger || !amount) {
    return null;
  }
  return (direction === 'long' ? trigger.minus(entry) : entry.minus(trigger))
    .multipliedBy(amount)
    .toString();
};
