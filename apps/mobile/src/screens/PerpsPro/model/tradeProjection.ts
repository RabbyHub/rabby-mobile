import BigNumber from 'bignumber.js';

import {
  resolvePerpsProTradeAmount,
  type PerpsProResolvedTradeAmount,
  type PerpsProTradeAmountUnit,
  type PerpsProTradeFormState,
  type PerpsProTradeSide,
} from './trade';

const positive = (value: unknown) => {
  const number = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return number.isFinite() && number.gt(0) ? number : null;
};

const nonNegative = (value: unknown) => {
  const number = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return number.isFinite() ? BigNumber.max(number, 0) : null;
};

export const PERPS_PRO_LIMIT_MARGIN_SAFETY_RATIO = 0.99;

const normalizeBaseSize = (value: BigNumber, szDecimals: number) =>
  value.decimalPlaces(Math.max(0, szDecimals), BigNumber.ROUND_DOWN);

export const resolvePerpsProLimitCapacityPrice = ({
  limitPrice,
  markPrice,
  side,
}: {
  limitPrice: string;
  markPrice: string;
  side: PerpsProTradeSide;
}) => {
  const limit = positive(limitPrice);
  const mark = positive(markPrice);
  if (!limit) return mark?.toFixed() ?? null;
  if (!mark) return limit.toFixed();

  const restsAwayFromMark = side === 'buy' ? limit.lt(mark) : limit.gte(mark);
  return restsAwayFromMark ? limit.toFixed() : mark.toFixed();
};

export const resolvePerpsProMaxBaseCapacity = ({
  availableQuote,
  conditionalExecution,
  currentPositionSize,
  leverage,
  markPrice,
  orderType,
  referencePrice,
  serverMaxBase,
  side,
  szDecimals,
}: {
  availableQuote: string;
  conditionalExecution?: PerpsProTradeFormState['conditionalExecution'];
  currentPositionSize?: string | null;
  leverage: number;
  markPrice: string;
  orderType: PerpsProTradeFormState['orderType'];
  referencePrice: string;
  serverMaxBase: string;
  side: PerpsProTradeSide;
  szDecimals: number;
}) => {
  const serverMaximum = positive(serverMaxBase) ?? new BigNumber(0);
  const normalizedServerMaximum = normalizeBaseSize(serverMaximum, szDecimals);
  const isLimitExecution =
    orderType === 'limit' ||
    (orderType === 'conditional' && conditionalExecution === 'limit');
  if (!isLimitExecution || !serverMaximum.gt(0)) {
    return normalizedServerMaximum.toFixed();
  }
  const balance = nonNegative(availableQuote);
  const mark = positive(markPrice);
  const policyPrice = positive(referencePrice) ?? mark;
  const capacityPrice = positive(
    resolvePerpsProLimitCapacityPrice({
      limitPrice: referencePrice,
      markPrice,
      side,
    }),
  );
  // Active Asset maxTradeSzs is mark-priced. Hyperliquid's web client rebases
  // that capacity for a resting Limit whose execution price is more favorable
  // than Mark; marketable Limits keep the Mark-priced capacity.
  const adjustedServerMaximum =
    mark && capacityPrice && !capacityPrice.eq(mark)
      ? serverMaximum.multipliedBy(mark).dividedBy(capacityPrice)
      : serverMaximum;
  const normalizedAdjustedServerMaximum = normalizeBaseSize(
    adjustedServerMaximum,
    szDecimals,
  );
  if (!balance || !policyPrice || !Number.isFinite(leverage) || leverage <= 0) {
    return normalizedAdjustedServerMaximum.toFixed();
  }
  const position = new BigNumber(currentPositionSize ?? 0);
  const closable =
    position.isFinite() &&
    ((side === 'buy' && position.lt(0)) || (side === 'sell' && position.gt(0)))
      ? position.abs()
      : new BigNumber(0);
  const policyMaximum = balance
    .multipliedBy(leverage)
    .multipliedBy(PERPS_PRO_LIMIT_MARGIN_SAFETY_RATIO)
    // Rabby Desktop's 0.99 balance policy is priced at the user's actual
    // Limit. It is intentionally separate from the server-capacity price.
    .dividedBy(policyPrice)
    .decimalPlaces(Math.max(0, szDecimals), BigNumber.ROUND_DOWN)
    .plus(closable);
  return normalizeBaseSize(
    BigNumber.min(adjustedServerMaximum, policyMaximum),
    szDecimals,
  ).toFixed();
};

export const getPerpsProTradeDisplayReferencePrice = ({
  form,
  marketPrice,
}: {
  form: PerpsProTradeFormState;
  marketPrice: string;
}) => {
  if (form.orderType === 'market') return marketPrice;
  if (form.orderType === 'limit') {
    return form.bboEnabled ? marketPrice : form.limitPrice;
  }
  return form.conditionalExecution === 'limit'
    ? form.conditionalLimitPrice
    : marketPrice;
};

export const getPerpsProMaxDisplayReferencePrice = ({
  form,
  marketPrice,
}: {
  form: PerpsProTradeFormState;
  marketPrice: string;
}) => {
  if (form.orderType === 'market') {
    return marketPrice;
  }
  if (form.orderType === 'limit') {
    if (form.bboEnabled) {
      return marketPrice;
    }
    return positive(form.limitPrice)?.toFixed() ?? marketPrice;
  }
  if (form.conditionalExecution === 'market') {
    return marketPrice;
  }
  return positive(form.conditionalLimitPrice)?.toFixed() ?? marketPrice;
};

export const getPerpsProNetNewBaseSize = ({
  baseSize,
  currentPositionSize,
  reduceOnly,
  side,
}: {
  baseSize: string;
  currentPositionSize?: string | null;
  reduceOnly: boolean;
  side: PerpsProTradeSide;
}) => {
  const size = positive(baseSize);
  if (!size || reduceOnly) return '0';
  const position = new BigNumber(currentPositionSize ?? 0);
  if (!position.isFinite() || position.isZero()) return size.toFixed();
  const isOpposite =
    (side === 'buy' && position.lt(0)) || (side === 'sell' && position.gt(0));
  return isOpposite
    ? BigNumber.max(size.minus(position.abs()), 0).toFixed()
    : size.toFixed();
};

export const resolvePerpsProSliderAmount = ({
  maxBase,
  percentage,
  price,
  szDecimals,
}: {
  maxBase: string;
  percentage: number;
  price: string;
  szDecimals: number;
}): PerpsProResolvedTradeAmount | null => {
  const maximum = positive(maxBase);
  const referencePrice = positive(price);
  if (
    !maximum ||
    !referencePrice ||
    !Number.isFinite(percentage) ||
    percentage <= 0
  ) {
    return null;
  }
  const normalizedMaximum = normalizeBaseSize(maximum, szDecimals);
  const base =
    percentage >= 100
      ? normalizedMaximum
      : normalizedMaximum
          .multipliedBy(percentage)
          .dividedBy(100)
          .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
  return base.gt(0)
    ? {
        baseSize: base.toFixed(),
        quoteAmount: base.multipliedBy(referencePrice).toFixed(),
      }
    : null;
};

export interface PerpsProTradeProjection {
  baseSize: string;
  costQuote: string;
  displayAmount: string;
  displayQuoteAmount: string;
  executionQuoteAmount: string;
  netNewBaseSize: string;
}

export const resolvePerpsProTradeProjection = ({
  amount,
  amountSource,
  amountUnit,
  currentPositionSize,
  displayPrice,
  executionPrice,
  leverage,
  maxBase,
  percentage,
  reduceOnly,
  side,
  szDecimals,
}: {
  amount: string;
  amountSource: 'manual' | 'slider';
  amountUnit: PerpsProTradeAmountUnit;
  currentPositionSize?: string | null;
  displayPrice: string;
  executionPrice: string | null;
  leverage: number;
  maxBase: string;
  percentage: number;
  reduceOnly: boolean;
  side: PerpsProTradeSide;
  szDecimals: number;
}): PerpsProTradeProjection | null => {
  const displayed =
    amountSource === 'slider'
      ? resolvePerpsProSliderAmount({
          maxBase,
          percentage,
          price: displayPrice,
          szDecimals,
        })
      : resolvePerpsProTradeAmount({
          amount,
          amountUnit,
          price: displayPrice,
          szDecimals,
        });
  const execution = positive(executionPrice);
  if (!displayed || !execution) return null;
  const netNewBaseSize = getPerpsProNetNewBaseSize({
    baseSize: displayed.baseSize,
    currentPositionSize,
    reduceOnly,
    side,
  });
  const cost = positive(netNewBaseSize);
  const normalizedLeverage = Math.max(1, leverage);
  return {
    baseSize: displayed.baseSize,
    costQuote: cost
      ? cost.multipliedBy(execution).dividedBy(normalizedLeverage).toFixed(2)
      : '0',
    displayAmount:
      amountUnit === 'base' ? displayed.baseSize : displayed.quoteAmount,
    displayQuoteAmount: displayed.quoteAmount,
    executionQuoteAmount: new BigNumber(displayed.baseSize)
      .multipliedBy(execution)
      .toFixed(),
    netNewBaseSize,
  };
};

export const getPerpsProMaxDisplayAmount = ({
  amountUnit,
  maxBase,
  referencePrice,
}: {
  amountUnit: PerpsProTradeAmountUnit;
  maxBase: string;
  referencePrice: string | null;
}) => {
  const maximum = positive(maxBase);
  if (!maximum) return '0';
  if (amountUnit === 'base') return maximum.toFixed();
  const price = positive(referencePrice);
  return price ? maximum.multipliedBy(price).toFixed(2) : '0';
};
