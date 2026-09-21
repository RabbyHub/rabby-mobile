import type { AssetPosition, L2Book } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import type { PerpsMaintenanceMarginTier } from '@/utils/perpsMargin';
import { calculatePerpsMaintenanceMargin } from '@/utils/perpsMargin';
import { normalizePerpsProCalculatedPrice } from '@/utils/perpsPriceProtocol';

import type { PerpsProTradeSide } from './trade';

type PerpsProPosition = AssetPosition['position'];

export type PerpsProMarketLiquidationRisk = Readonly<{
  clearingPrice: string;
  clearingSource: 'bookMarginal' | 'slippageCap';
  effectiveLeverage: string;
  gap: number;
  initialMarginTierLowerBound: string;
  liquidationPrice: string;
  liquidationTierLowerBound: string;
  liquidationTierUpperBound: string | null;
  maintenance: string;
  maintenanceDeduction: string;
  maintenanceMarginRate: string;
  projectedSize: string;
  riskMargin: string;
  riskNotional: string;
}>;

export type PerpsProMarketLiquidationOutcome =
  | { kind: 'price'; risk: PerpsProMarketLiquidationRisk }
  | { kind: 'noPositivePrice' }
  | { kind: 'notApplicable'; reason: 'flat' }
  | {
      kind: 'unavailable';
      reason:
        | 'book'
        | 'bookIdentity'
        | 'cap'
        | 'crossMargin'
        | 'input'
        | 'isolatedRawUsd'
        | 'level'
        | 'tiers';
    };

const MAX_LIQUIDATION_PRICE = new BigNumber('1000000000000000');
const DEFAULT_MARKET_SLIPPAGE = new BigNumber('0.08');

const decimal = (value: unknown): BigNumber | null => {
  const result = new BigNumber(
    (value as string | number | BigNumber | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() ? result : null;
};

const positive = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result?.gt(0) ? result : null;
};

const nonNegative = (value: unknown): BigNumber | null => {
  const result = decimal(value);
  return result?.gte(0) ? result : null;
};

const sameSign = (left: BigNumber, right: BigNumber) =>
  (left.gt(0) && right.gt(0)) || (left.lt(0) && right.lt(0));

type ValidTier = {
  lowerBound: BigNumber;
  maintenanceDeduction: BigNumber;
  maintenanceMarginRate: BigNumber;
  maxLeverage: BigNumber;
  upperBound: BigNumber | null;
};

const normalizeTiers = (
  tiers: readonly PerpsMaintenanceMarginTier[],
): ValidTier[] | null => {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return null;
  }

  const result: ValidTier[] = [];
  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    const lowerBound = nonNegative(tier?.lowerBound);
    const upperBound =
      index + 1 < tiers.length
        ? nonNegative(tiers[index + 1]?.lowerBound)
        : null;
    const maintenanceDeduction = nonNegative(tier?.maintenanceDeduction);
    const maintenanceMarginRate = positive(tier?.maintenanceMarginRate);
    const maxLeverage = positive(tier?.maxLeverage);
    const previousTier = result[index - 1];
    const maintenanceAtLowerBound =
      lowerBound && maintenanceDeduction && maintenanceMarginRate
        ? lowerBound
            .multipliedBy(maintenanceMarginRate)
            .minus(maintenanceDeduction)
        : null;
    const previousMaintenanceAtLowerBound =
      lowerBound && previousTier
        ? lowerBound
            .multipliedBy(previousTier.maintenanceMarginRate)
            .minus(previousTier.maintenanceDeduction)
        : null;
    if (
      !lowerBound ||
      !maintenanceDeduction ||
      !maintenanceMarginRate ||
      !maxLeverage ||
      !maintenanceMarginRate.lt(1) ||
      (!upperBound && index + 1 < tiers.length) ||
      (upperBound && !upperBound.gt(lowerBound)) ||
      (index === 0 &&
        (!lowerBound.isZero() || !maintenanceDeduction.isZero())) ||
      !maintenanceMarginRate.eq(
        new BigNumber(1).dividedBy(maxLeverage.multipliedBy(2)),
      ) ||
      !maintenanceAtLowerBound?.gte(0) ||
      (previousMaintenanceAtLowerBound &&
        (!maintenanceAtLowerBound ||
          !maintenanceAtLowerBound.eq(previousMaintenanceAtLowerBound)))
    ) {
      return null;
    }
    result.push({
      lowerBound,
      maintenanceDeduction,
      maintenanceMarginRate,
      maxLeverage,
      upperBound,
    });
  }
  return result;
};

const findTier = (tiers: readonly ValidTier[], notional: BigNumber) =>
  tiers.find(
    tier =>
      notional.gte(tier.lowerBound) &&
      (!tier.upperBound || notional.lt(tier.upperBound)),
  ) ?? null;

type ClearingPriceResult =
  | {
      clearingPrice: BigNumber;
      source: 'bookMarginal' | 'slippageCap';
    }
  | { error: 'book' | 'bookIdentity' | 'cap' | 'level' };

/**
 * Hyperliquid's Market liquidation estimator uses the marginal clearing price,
 * not the fill VWAP. Remaining size outside the visible/protected book is
 * valued at the FrontendMarket slippage cap.
 */
export const resolvePerpsProMarketClearingPrice = ({
  baseSize,
  book,
  coin,
  maxSlippage = DEFAULT_MARKET_SLIPPAGE.toFixed(),
  midPrice,
  sessionKey,
  side,
  status,
  szDecimals,
}: {
  baseSize: string;
  book: L2Book | null;
  coin: string;
  maxSlippage?: string;
  midPrice: string;
  sessionKey: string | null;
  side: PerpsProTradeSide;
  status: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  szDecimals: number;
}): ClearingPriceResult => {
  const size = positive(baseSize);
  const mid = positive(midPrice);
  const slippage = nonNegative(maxSlippage);
  if (
    !size ||
    !mid ||
    !slippage ||
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0
  ) {
    return { error: 'cap' };
  }
  if (status !== 'ready' || !book || !sessionKey) {
    return { error: 'book' };
  }
  if (book.coin !== coin || !Number.isFinite(book.time) || book.time <= 0) {
    return { error: 'bookIdentity' };
  }

  const sideFactor = side === 'buy' ? new BigNumber(1) : new BigNumber(-1);
  const capValue = mid.multipliedBy(
    new BigNumber(1).plus(sideFactor.multipliedBy(slippage)),
  );
  const normalizedCap = normalizePerpsProCalculatedPrice(capValue, szDecimals);
  const cap = positive(normalizedCap);
  if (!cap) {
    return { error: 'cap' };
  }

  const levels = side === 'buy' ? book.levels[1] : book.levels[0];
  if (!Array.isArray(levels)) {
    return { error: 'book' };
  }

  let consumed = new BigNumber(0);
  for (const level of levels) {
    const levelPrice = positive(level?.px);
    const levelSize = positive(level?.sz);
    if (!levelPrice || !levelSize) {
      return { error: 'level' };
    }
    if (
      (side === 'buy' && levelPrice.gt(cap)) ||
      (side === 'sell' && levelPrice.lt(cap))
    ) {
      break;
    }
    if (consumed.plus(levelSize).gte(size)) {
      return { clearingPrice: levelPrice, source: 'bookMarginal' };
    }
    consumed = consumed.plus(levelSize);
  }

  return { clearingPrice: cap, source: 'slippageCap' };
};

const resolveIsolatedLiveAccountValue = ({
  currentPosition,
  leverage,
  mark,
  orderSize,
  projectedPosition,
  sideFactor,
}: {
  currentPosition: PerpsProPosition | null | undefined;
  leverage: BigNumber;
  mark: BigNumber;
  orderSize: BigNumber;
  projectedPosition: BigNumber;
  sideFactor: BigNumber;
}): BigNumber | null => {
  let currentSize = decimal(currentPosition?.szi ?? 0);
  if (!currentSize) {
    return null;
  }
  let signedRemainingOrder = sideFactor.multipliedBy(orderSize);
  const hasCurrentPosition = !currentSize.isZero();
  let rawUsd = hasCurrentPosition
    ? decimal(currentPosition?.leverage?.rawUsd)
    : new BigNumber(0);
  if (!rawUsd) {
    return null;
  }

  if (
    !currentSize.isZero() &&
    !signedRemainingOrder.isZero() &&
    !sameSign(signedRemainingOrder, currentSize)
  ) {
    const closeSize = BigNumber.min(
      signedRemainingOrder.abs(),
      currentSize.abs(),
    );
    const signedClose = signedRemainingOrder.lt(0)
      ? closeSize.negated()
      : closeSize;
    const removedRawUsd = rawUsd
      .plus(mark.multipliedBy(currentSize))
      .multipliedBy(closeSize.dividedBy(currentSize.abs()));
    rawUsd = rawUsd.minus(removedRawUsd).minus(mark.multipliedBy(signedClose));
    signedRemainingOrder = signedRemainingOrder.minus(signedClose);
    currentSize = currentSize.plus(signedClose);
  }

  if (
    currentSize.isZero() ||
    (!signedRemainingOrder.isZero() &&
      sameSign(signedRemainingOrder, currentSize))
  ) {
    rawUsd = rawUsd
      .plus(mark.multipliedBy(signedRemainingOrder).abs().dividedBy(leverage))
      .minus(mark.multipliedBy(signedRemainingOrder));
    currentSize = currentSize.plus(signedRemainingOrder);
  }

  if (currentSize.isZero()) {
    rawUsd = new BigNumber(0);
  }
  const liveAccountValue = projectedPosition.multipliedBy(mark).plus(rawUsd);
  return liveAccountValue.isFinite() ? liveAccountValue : null;
};

const solveLiquidationPrice = ({
  absPosition,
  direction,
  mark,
  riskMargin,
  riskNotional,
  tiers,
}: {
  absPosition: BigNumber;
  direction: BigNumber;
  mark: BigNumber;
  riskMargin: BigNumber;
  riskNotional: BigNumber;
  tiers: readonly ValidTier[];
}): {
  liquidation: BigNumber;
  maintenance: BigNumber;
  tier: ValidTier;
} | null => {
  for (const tier of tiers) {
    const denominator = new BigNumber(1).minus(
      direction.multipliedBy(tier.maintenanceMarginRate),
    );
    if (denominator.isZero()) {
      continue;
    }
    const maintenance = riskNotional
      .multipliedBy(tier.maintenanceMarginRate)
      .minus(tier.maintenanceDeduction);
    const candidate = mark.minus(
      direction
        .multipliedBy(riskMargin.minus(maintenance))
        .dividedBy(absPosition)
        .dividedBy(denominator),
    );
    if (
      !candidate.isFinite() ||
      candidate.lte(0) ||
      candidate.gt(MAX_LIQUIDATION_PRICE)
    ) {
      continue;
    }
    const candidateNotional = candidate.multipliedBy(absPosition);
    if (
      candidateNotional.gte(tier.lowerBound) &&
      (!tier.upperBound || candidateNotional.lt(tier.upperBound))
    ) {
      return { liquidation: candidate, maintenance, tier };
    }
  }
  return null;
};

export const resolvePerpsProMarketLiquidationOutcome = ({
  baseSize,
  book,
  coin,
  crossMarginAvailableAfterMaintenance,
  currentPosition,
  leverage,
  maintenanceMarginTiers,
  marginMode,
  markPrice,
  midPrice,
  pxDecimals,
  sessionKey,
  side,
  status,
  szDecimals,
}: {
  baseSize: string;
  book: L2Book | null;
  coin: string;
  crossMarginAvailableAfterMaintenance: string | null;
  currentPosition?: PerpsProPosition | null;
  leverage: number;
  maintenanceMarginTiers: readonly PerpsMaintenanceMarginTier[];
  marginMode: 'cross' | 'isolated';
  markPrice: string;
  midPrice: string;
  pxDecimals: number;
  sessionKey: string | null;
  side: PerpsProTradeSide;
  status: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  szDecimals: number;
}): PerpsProMarketLiquidationOutcome => {
  const orderSize = positive(baseSize);
  const mark = positive(markPrice);
  const leverageValue = positive(leverage);
  const currentSize = decimal(currentPosition?.szi ?? 0);
  if (
    !orderSize ||
    !mark ||
    !leverageValue ||
    !currentSize ||
    !Number.isSafeInteger(pxDecimals) ||
    pxDecimals < 0
  ) {
    return { kind: 'unavailable', reason: 'input' };
  }

  const tiers = normalizeTiers(maintenanceMarginTiers);
  if (!tiers) {
    return { kind: 'unavailable', reason: 'tiers' };
  }

  const clearing = resolvePerpsProMarketClearingPrice({
    baseSize,
    book,
    coin,
    midPrice,
    sessionKey,
    side,
    status,
    szDecimals,
  });
  if ('error' in clearing) {
    return {
      kind: 'unavailable',
      reason:
        clearing.error === 'bookIdentity'
          ? 'bookIdentity'
          : clearing.error === 'level'
          ? 'level'
          : clearing.error === 'cap'
          ? 'cap'
          : 'book',
    };
  }

  const sideFactor = side === 'buy' ? new BigNumber(1) : new BigNumber(-1);
  const projectedPosition = currentSize.plus(
    sideFactor.multipliedBy(orderSize),
  );
  const absPosition = projectedPosition.abs();
  if (absPosition.isZero()) {
    return { kind: 'notApplicable', reason: 'flat' };
  }

  const riskNotional = clearing.clearingPrice.multipliedBy(absPosition);
  const initialTier = findTier(tiers, riskNotional);
  if (!initialTier) {
    return { kind: 'unavailable', reason: 'tiers' };
  }

  let liveAccountValue: BigNumber | null;
  if (marginMode === 'isolated') {
    liveAccountValue = resolveIsolatedLiveAccountValue({
      currentPosition,
      leverage: leverageValue,
      mark,
      orderSize,
      projectedPosition,
      sideFactor,
    });
    if (!liveAccountValue) {
      return { kind: 'unavailable', reason: 'isolatedRawUsd' };
    }
  } else {
    const available = nonNegative(crossMarginAvailableAfterMaintenance);
    if (!available) {
      return { kind: 'unavailable', reason: 'crossMargin' };
    }
    const currentNotional = currentSize.abs().multipliedBy(mark);
    const currentMaintenance = currentSize.isZero()
      ? new BigNumber(0)
      : decimal(
          calculatePerpsMaintenanceMargin({
            positionNotional: currentNotional,
            tiers: maintenanceMarginTiers,
          }),
        );
    if (!currentMaintenance) {
      return { kind: 'unavailable', reason: 'tiers' };
    }
    liveAccountValue = available.plus(currentMaintenance);
  }

  const effectiveLeverage = BigNumber.min(
    leverageValue,
    initialTier.maxLeverage,
  );
  const initialMargin = riskNotional.dividedBy(effectiveLeverage);
  const riskMargin = BigNumber.max(liveAccountValue, initialMargin);
  if (!riskMargin.isFinite()) {
    return { kind: 'unavailable', reason: 'input' };
  }

  const liquidationSolution = solveLiquidationPrice({
    absPosition,
    direction: projectedPosition.gt(0) ? new BigNumber(1) : new BigNumber(-1),
    mark,
    riskMargin,
    riskNotional,
    tiers,
  });
  if (!liquidationSolution) {
    return { kind: 'noPositivePrice' };
  }

  const risk = Object.freeze({
    clearingPrice: clearing.clearingPrice.toFixed(),
    clearingSource: clearing.source,
    effectiveLeverage: effectiveLeverage.toFixed(),
    gap: liquidationSolution.liquidation.minus(mark).dividedBy(mark).toNumber(),
    initialMarginTierLowerBound: initialTier.lowerBound.toFixed(),
    liquidationPrice: liquidationSolution.liquidation.toFixed(pxDecimals),
    liquidationTierLowerBound: liquidationSolution.tier.lowerBound.toFixed(),
    liquidationTierUpperBound:
      liquidationSolution.tier.upperBound?.toFixed() ?? null,
    maintenance: liquidationSolution.maintenance.toFixed(),
    maintenanceDeduction:
      liquidationSolution.tier.maintenanceDeduction.toFixed(),
    maintenanceMarginRate:
      liquidationSolution.tier.maintenanceMarginRate.toFixed(),
    projectedSize: absPosition.toFixed(),
    riskMargin: riskMargin.toFixed(),
    riskNotional: riskNotional.toFixed(),
  });
  return Object.freeze({
    kind: 'price',
    risk,
  });
};

export const resolvePerpsProMarketLiquidationRisk = (
  facts: Parameters<typeof resolvePerpsProMarketLiquidationOutcome>[0],
): PerpsProMarketLiquidationRisk | null => {
  const outcome = resolvePerpsProMarketLiquidationOutcome(facts);
  return outcome.kind === 'price' ? outcome.risk : null;
};
