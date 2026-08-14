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
  triggerPrice: string;
};

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

export const isMatchingPartialTpSlPosition = (
  order: PerpsOpenOrderViewModel,
  position: PerpsPositionViewModel | null | undefined,
) =>
  !!position &&
  order.editKind === 'partialTpSlMarket' &&
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

export const getOpenOrderEditCoveragePercent = ({
  positionSize,
  size,
}: {
  positionSize: string;
  size: string;
}) => {
  const position = positive(positionSize);
  const amount = positive(size);
  if (!position || !amount) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(100, amount.dividedBy(position).multipliedBy(100).toNumber()),
  );
};
