import BigNumber from 'bignumber.js';

import type { PerpsMarketMarginMode, PerpsQuoteAsset } from '@/constant/perps';
import type { PerpsMaintenanceMarginTier } from '@/utils/perpsMargin';

import {
  calculateLiquidationDistance,
  type PerpsPositionDirection,
} from './position';

const TARGET_DECIMALS = 2;
const WIRE_DECIMALS = 6;
const MINIMUM_MARGIN_BUFFER = new BigNumber('0.1');
const MINIMUM_NOTIONAL_MARGIN_RATIO = new BigNumber('0.1');

const decimal = (value: unknown): BigNumber | null => {
  const result = new BigNumber(
    (value as string | number | BigNumber | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() ? result : null;
};

const nonNegativeDecimal = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result && result.gte(0) ? result : null;
};

const positiveDecimal = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result && result.gt(0) ? result : null;
};

const nonZeroAbsoluteDecimal = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result && !result.isZero() ? result.abs() : null;
};

const trimFixedDecimal = (value: string) =>
  value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export const formatPositionMarginTarget = (
  value: unknown,
  roundingMode: BigNumber.RoundingMode = BigNumber.ROUND_HALF_UP,
): string | null => {
  const result = nonNegativeDecimal(value);
  return result
    ? trimFixedDecimal(result.toFixed(TARGET_DECIMALS, roundingMode))
    : null;
};

export interface PositionMarginAvailableInput {
  accountFactsReady: boolean;
  dexWithdrawable: unknown;
  isSpotStateReady: boolean;
  portfolioAvailableAfterMaintenance: unknown;
  quoteAsset: PerpsQuoteAsset;
  spotQuoteAvailable: unknown;
  userAbstraction: string;
  userAbstractionReady: boolean;
}

/** Resolve the collateral that can be added to this exact DEX/quote account. */
export const resolvePositionMarginAvailable = ({
  accountFactsReady,
  dexWithdrawable,
  isSpotStateReady,
  portfolioAvailableAfterMaintenance,
  quoteAsset,
  spotQuoteAvailable,
  userAbstraction,
  userAbstractionReady,
}: PositionMarginAvailableInput): string | null => {
  if (!accountFactsReady || !userAbstractionReady) {
    return null;
  }
  let source: unknown;
  if (userAbstraction === 'unifiedAccount') {
    source = isSpotStateReady ? spotQuoteAvailable : null;
  } else if (userAbstraction === 'portfolioMargin') {
    source = isSpotStateReady
      ? quoteAsset === 'USDC'
        ? portfolioAvailableAfterMaintenance
        : spotQuoteAvailable
      : null;
  } else {
    source = dexWithdrawable;
  }
  const available = decimal(source);
  if (!available) {
    return null;
  }
  return BigNumber.max(available, 0).toFixed();
};

export interface PositionMarginRange {
  addOnly: boolean;
  current: string;
  displayMin: string;
  hasRepresentableRange: boolean;
  max: string;
  min: string;
  rawMax: string;
  rawMin: string;
}

export const buildPositionMarginRange = ({
  available,
  currentMargin,
  leverage,
  marginModeConstraint,
  markPrice,
  positionSize,
}: {
  available: unknown;
  currentMargin: unknown;
  leverage: unknown;
  marginModeConstraint: PerpsMarketMarginMode | null | undefined;
  markPrice: unknown;
  positionSize: unknown;
}): PositionMarginRange | null => {
  const current = nonNegativeDecimal(currentMargin);
  const free = nonNegativeDecimal(available);
  const mark = positiveDecimal(markPrice);
  const size = nonZeroAbsoluteDecimal(positionSize);
  const leverageValue = positiveDecimal(leverage);
  if (!current || !free || !mark || !size || !leverageValue) {
    return null;
  }

  const notional = size.multipliedBy(mark);
  const protocolFloor = BigNumber.max(
    notional.dividedBy(leverageValue),
    notional.multipliedBy(MINIMUM_NOTIONAL_MARGIN_RATIO),
  );
  const safeFloor = protocolFloor.plus(MINIMUM_MARGIN_BUFFER);
  // noCross forbids cross margin but still permits isolated-margin removal.
  // strictIsolated and missing legacy metadata remain add-only.
  const addOnly =
    marginModeConstraint == null || marginModeConstraint === 'strictIsolated';
  const rawMin = addOnly ? current : BigNumber.min(current, safeFloor);
  const rawMax = current.plus(free);
  const min = rawMin.decimalPlaces(TARGET_DECIMALS, BigNumber.ROUND_CEIL);
  const max = rawMax.decimalPlaces(TARGET_DECIMALS, BigNumber.ROUND_FLOOR);
  const visibleCurrent = current.decimalPlaces(
    TARGET_DECIMALS,
    BigNumber.ROUND_HALF_UP,
  );
  const displayMin = BigNumber.min(min, visibleCurrent);

  return {
    addOnly,
    current: current.toFixed(),
    displayMin: trimFixedDecimal(displayMin.toFixed(TARGET_DECIMALS)),
    hasRepresentableRange: max.gte(min),
    max: trimFixedDecimal(max.toFixed(TARGET_DECIMALS)),
    min: trimFixedDecimal(min.toFixed(TARGET_DECIMALS)),
    rawMax: rawMax.toFixed(),
    rawMin: rawMin.toFixed(),
  };
};

export type PositionMarginTargetState =
  | 'aboveMax'
  | 'belowMin'
  | 'empty'
  | 'invalid'
  | 'noChange'
  | 'unavailable'
  | 'valid';

export const validatePositionMarginTarget = ({
  range,
  target,
}: {
  range: PositionMarginRange | null;
  target: string;
}): PositionMarginTargetState => {
  if (!target) {
    return 'empty';
  }
  const value = decimal(target);
  if (!value || value.isNegative()) {
    return 'invalid';
  }
  if (!range || !range.hasRepresentableRange) {
    return 'unavailable';
  }
  const visibleCurrent = formatPositionMarginTarget(range.current);
  if (visibleCurrent != null && value.eq(visibleCurrent)) {
    return 'noChange';
  }
  if (value.lt(range.min)) {
    return 'belowMin';
  }
  if (value.gt(range.max)) {
    return 'aboveMax';
  }
  return 'valid';
};

export const calculatePositionMarginDelta = ({
  currentMargin,
  targetMargin,
}: {
  currentMargin: unknown;
  targetMargin: unknown;
}): string | null => {
  const current = nonNegativeDecimal(currentMargin);
  const target = nonNegativeDecimal(targetMargin);
  if (!current || !target) {
    return null;
  }
  const delta = target.minus(current);
  if (delta.isZero()) {
    return '0';
  }
  return trimFixedDecimal(
    delta.toFixed(WIRE_DECIMALS, BigNumber.ROUND_HALF_UP),
  );
};

export const projectPositionLiquidationPrice = ({
  direction,
  margin,
  markPrice,
  positionSize,
  tiers,
}: {
  direction: PerpsPositionDirection;
  margin: unknown;
  markPrice: unknown;
  positionSize: unknown;
  tiers: readonly PerpsMaintenanceMarginTier[];
}): string | null => {
  const mark = positiveDecimal(markPrice);
  const size = nonZeroAbsoluteDecimal(positionSize);
  const targetMargin = nonNegativeDecimal(margin);
  if (!mark || !size || !targetMargin || !Array.isArray(tiers)) {
    return null;
  }
  const side = direction === 'long' ? new BigNumber(1) : new BigNumber(-1);

  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    const lowerBound = nonNegativeDecimal(tier?.lowerBound);
    const nextLowerBound =
      index + 1 < tiers.length
        ? nonNegativeDecimal(tiers[index + 1]?.lowerBound)
        : null;
    const rate = positiveDecimal(tier?.maintenanceMarginRate);
    const deduction = nonNegativeDecimal(tier?.maintenanceDeduction);
    if (
      !lowerBound ||
      !rate ||
      !deduction ||
      (index + 1 < tiers.length && !nextLowerBound)
    ) {
      return null;
    }
    const denominator = new BigNumber(1).minus(rate.multipliedBy(side));
    if (denominator.isZero()) {
      return null;
    }
    const currentMaintenance = size
      .multipliedBy(mark)
      .multipliedBy(rate)
      .minus(deduction);
    const candidate = mark.minus(
      side
        .multipliedBy(targetMargin.minus(currentMaintenance))
        .dividedBy(size)
        .dividedBy(denominator),
    );
    if (!candidate.isFinite()) {
      continue;
    }
    if (candidate.lte(0)) {
      if (direction === 'long' && lowerBound.isZero()) {
        return '0';
      }
      continue;
    }
    const candidateNotional = size.multipliedBy(candidate);
    if (
      candidateNotional.gte(lowerBound) &&
      (!nextLowerBound || candidateNotional.lt(nextLowerBound))
    ) {
      return candidate.toFixed();
    }
  }
  return null;
};

export const buildPositionMarginRiskProjection = ({
  direction,
  margin,
  markPrice,
  positionSize,
  tiers,
}: {
  direction: PerpsPositionDirection;
  margin: unknown;
  markPrice: unknown;
  positionSize: unknown;
  tiers: readonly PerpsMaintenanceMarginTier[];
}): { liquidationDistance: string; liquidationPrice: string } | null => {
  const liquidationPrice = projectPositionLiquidationPrice({
    direction,
    margin,
    markPrice,
    positionSize,
    tiers,
  });
  if (!liquidationPrice) {
    return null;
  }
  if (liquidationPrice === '0') {
    return { liquidationDistance: '1', liquidationPrice };
  }
  const liquidationDistance = calculateLiquidationDistance({
    direction,
    liquidationPrice,
    markPrice: decimal(markPrice)?.toFixed() ?? null,
  });
  const distance = nonNegativeDecimal(liquidationDistance);
  return distance
    ? { liquidationDistance: distance.toFixed(), liquidationPrice }
    : null;
};
