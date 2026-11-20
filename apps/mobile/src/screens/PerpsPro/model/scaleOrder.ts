import BigNumber from 'bignumber.js';
import { PERPS_MINI_USD_VALUE } from '@/constant/perps';
import {
  isPerpsProPriceProtocolValid,
  roundPerpsProTpSlPrice,
} from '@/utils/perpsPriceProtocol';
import type { PerpsProTradeSide } from './trade';

export type PerpsProScaleDistribution = 'flat' | 'ascending' | 'descending';
export type PerpsProScaleLeg = Readonly<{ price: string; size: string }>;
export type PerpsProScalePlan = Readonly<{
  orders: readonly PerpsProScaleLeg[];
  totalSize: string;
  notional: string;
  averagePrice: string;
  distribution: PerpsProScaleDistribution;
}>;
export const PERPS_PRO_SCALE_MIN_COUNT = 2;
export const PERPS_PRO_SCALE_MAX_COUNT = 100;

export class PerpsProScaleError extends Error {
  constructor(
    public readonly code:
      | 'range'
      | 'count'
      | 'size'
      | 'duplicatePrice'
      | 'minimum'
      | 'maximum'
      | 'invalidCapacity'
      | 'capacity'
      | 'reduceOnly',
  ) {
    super(code);
  }
}

const positive = (value: string) => {
  const number = new BigNumber(value);
  return number.isFinite() && number.gt(0) ? number : null;
};

/** Weights follow ascending prices; reversing a sell preview keeps pairs intact. */
export const buildPerpsProScalePlan = ({
  lowerPrice,
  upperPrice,
  size,
  count,
  distribution,
  side,
  szDecimals,
}: {
  lowerPrice: string;
  upperPrice: string;
  size: string;
  count: string;
  distribution: PerpsProScaleDistribution;
  side: PerpsProTradeSide;
  szDecimals: number;
}): PerpsProScalePlan => {
  const lower = positive(lowerPrice);
  const upper = positive(upperPrice);
  if (
    !lower ||
    !upper ||
    !upper.gt(lower) ||
    !isPerpsProPriceProtocolValid(lowerPrice, szDecimals) ||
    !isPerpsProPriceProtocolValid(upperPrice, szDecimals)
  )
    throw new PerpsProScaleError('range');
  const n = Number(count);
  if (
    !/^\d+$/.test(count) ||
    !Number.isSafeInteger(n) ||
    n < PERPS_PRO_SCALE_MIN_COUNT ||
    n > PERPS_PRO_SCALE_MAX_COUNT
  )
    throw new PerpsProScaleError('count');
  const total = positive(size);
  if (
    !total ||
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0 ||
    total.decimalPlaces()! > szDecimals ||
    !['flat', 'ascending', 'descending'].includes(distribution)
  )
    throw new PerpsProScaleError('size');
  const weightSum = distribution === 'flat' ? n : (n * (n + 1)) / 2;
  const orders: PerpsProScaleLeg[] = [];
  const prices = new Set<string>();
  let actualSize = new BigNumber(0);
  let notional = new BigNumber(0);
  for (let i = 0; i < n; i++) {
    const price = roundPerpsProTpSlPrice(
      lower
        .plus(
          upper
            .minus(lower)
            .times(i)
            .div(n - 1),
        )
        .toFixed(),
      szDecimals,
    );
    if (!price || prices.has(price))
      throw new PerpsProScaleError('duplicatePrice');
    prices.add(price);
    const weight =
      distribution === 'flat'
        ? 1
        : distribution === 'ascending'
        ? i + 1
        : n - i;
    // Each child is floored independently, as on Hyperliquid. No remainder leg.
    const amount = total
      .times(weight)
      .div(weightSum)
      .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN);
    const value = amount.times(price);
    if (!amount.gt(0) || value.lt(PERPS_MINI_USD_VALUE))
      throw new PerpsProScaleError('minimum');
    actualSize = actualSize.plus(amount);
    notional = notional.plus(value);
    orders.push(Object.freeze({ price, size: amount.toFixed() }));
  }
  if (side === 'sell') orders.reverse();
  return Object.freeze({
    orders: Object.freeze(orders),
    totalSize: actualSize.toFixed(),
    notional: notional.toFixed(),
    averagePrice: notional.div(actualSize).toFixed(),
    distribution,
  });
};

export type PerpsProScaleCapacity = {
  availableQuote: string;
  leverage: number;
  markPrice: string;
  maxTradeSize: string;
  positionSize: string;
  maxUsdValueSize?: string;
};

const getClosableSize = (position: BigNumber, side: PerpsProTradeSide) =>
  (side === 'buy' ? position.lt(0) : position.gt(0))
    ? position.abs()
    : new BigNumber(0);

const getAddedNotional = (plan: PerpsProScalePlan, closable: BigNumber) =>
  BigNumber.maximum(new BigNumber(plan.totalSize).minus(closable), 0).times(
    plan.averagePrice,
  );

export function estimatePerpsProScaleCost(
  plan: PerpsProScalePlan,
  side: PerpsProTradeSide,
  reduceOnly: boolean,
  positionSize: string | null,
  leverage: number,
) {
  if (positionSize === null || !Number.isSafeInteger(leverage) || leverage <= 0)
    return null;
  const position = new BigNumber(positionSize);
  if (!position.isFinite()) return null;
  return reduceOnly
    ? '0'
    : getAddedNotional(plan, getClosableSize(position, side))
        .div(leverage)
        .toFixed();
}

/** Account/market facts are refreshed at confirmation; planned orders never move. */
export const validatePerpsProScaleCapacity = ({
  plan,
  facts,
  checkServerMax = true,
  reduceOnly,
  side,
}: {
  plan: PerpsProScalePlan;
  facts: PerpsProScaleCapacity;
  checkServerMax?: boolean;
  reduceOnly: boolean;
  side: PerpsProTradeSide;
}): string => {
  const total = new BigNumber(plan.totalSize);
  const position = new BigNumber(facts.positionSize);
  const mark = positive(facts.markPrice);
  const serverMax = new BigNumber(facts.maxTradeSize);
  const available = new BigNumber(facts.availableQuote);
  if (
    !position.isFinite() ||
    !mark ||
    !serverMax.isFinite() ||
    serverMax.lt(0) ||
    !available.isFinite() ||
    available.lt(0) ||
    !Number.isSafeInteger(facts.leverage) ||
    facts.leverage <= 0
  )
    throw new PerpsProScaleError('invalidCapacity');
  const closable = getClosableSize(position, side);
  if (reduceOnly && (closable.isZero() || total.gt(closable)))
    throw new PerpsProScaleError('reduceOnly');
  const maximum = facts.maxUsdValueSize
    ? positive(facts.maxUsdValueSize)
    : null;
  if (maximum && new BigNumber(plan.notional).gt(maximum))
    throw new PerpsProScaleError('maximum');
  const addedNotional = getAddedNotional(plan, closable);
  const capacityNotional = plan.orders.reduce(
    (sum, leg) =>
      sum.plus(
        new BigNumber(leg.size).times(
          side === 'buy'
            ? BigNumber.minimum(leg.price, mark)
            : BigNumber.maximum(leg.price, mark),
        ),
      ),
    new BigNumber(0),
  );
  if (
    (checkServerMax && capacityNotional.gt(serverMax.times(mark))) ||
    (!reduceOnly &&
      addedNotional.gt(available.times(facts.leverage).times('0.99')))
  )
    throw new PerpsProScaleError('capacity');
  return reduceOnly ? '0' : addedNotional.div(facts.leverage).toFixed();
};

export const getPerpsProScaleBarWidth = (
  size: string,
  maximum: string,
  distribution: PerpsProScaleDistribution,
) =>
  distribution === 'flat'
    ? 50
    : new BigNumber(size).div(maximum).times(70).toNumber();
