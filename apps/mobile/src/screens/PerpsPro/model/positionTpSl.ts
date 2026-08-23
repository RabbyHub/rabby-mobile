import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

export type PerpsPositionTpSlKind = 'takeProfit' | 'stopLoss';
export type PerpsPositionTpSlScope = 'partial' | 'position';

export interface PerpsPositionTpSlOrderViewModel {
  execution: 'market';
  key: string;
  kind: PerpsPositionTpSlKind;
  oid: number;
  originalSize: string;
  remainingSize: string;
  scope: PerpsPositionTpSlScope;
  side: OpenOrder['side'];
  timestamp: number;
  triggerPrice: string;
}

export interface PerpsPositionTpSlSideSummary {
  duplicatePositionOrders: boolean;
  nearestPartialOrder: PerpsPositionTpSlOrderViewModel | null;
  nearestPositionOrder: PerpsPositionTpSlOrderViewModel | null;
  partialOrders: PerpsPositionTpSlOrderViewModel[];
  positionOrders: PerpsPositionTpSlOrderViewModel[];
}

export interface PerpsPositionTpSlSummary {
  mode: 'mixed' | 'none' | 'partial' | 'position';
  partialCount: number;
  stopLoss: PerpsPositionTpSlSideSummary;
  takeProfit: PerpsPositionTpSlSideSummary;
}

export const resolvePositionTpSlEditTab = (
  orders: readonly PerpsPositionTpSlOrderViewModel[],
): 'partial' | 'position' =>
  orders.some(order => order.scope === 'position') ? 'position' : 'partial';

export interface PerpsPositionTpSlDraftLeg {
  kind: PerpsPositionTpSlKind;
  replaceOid: number | null;
  size: string | null;
  triggerPrice: string;
}

export interface PerpsPositionTpSlDraft {
  legs: PerpsPositionTpSlDraftLeg[];
  mode: 'add' | 'modify' | 'position';
  scope: PerpsPositionTpSlScope;
}

export interface PerpsPositionTpSlMarketSnapshot {
  displayBase: string;
  displayPair: string;
  markPrice: string;
  pxDecimals: number;
  quoteAsset: string;
  sourceTag: string | null;
  szDecimals: number;
}

const finiteDecimal = (value: unknown): BigNumber | null => {
  const result = new BigNumber((value as string | number | undefined) ?? NaN);
  return result.isFinite() ? result : null;
};

const positiveDecimal = (value: unknown): string | null => {
  const result = finiteDecimal(value);
  return result?.gt(0) ? result.toString() : null;
};

const resolveKind = (order: OpenOrder): PerpsPositionTpSlKind | null => {
  const orderType = String(order.orderType || '').toLowerCase();
  if (orderType.includes('take profit')) {
    return 'takeProfit';
  }
  if (orderType.includes('stop')) {
    return 'stopLoss';
  }

  const triggerCondition = String(order.triggerCondition || '').toLowerCase();
  if (triggerCondition.includes('take profit')) {
    return 'takeProfit';
  }
  if (triggerCondition.includes('stop')) {
    return 'stopLoss';
  }
  return null;
};

/**
 * Frontend open orders can contain dormant attached children under an open
 * parent. They are not active position-level protection yet. Once such a
 * child becomes independently active Hyperliquid exposes it as a top-level
 * order, which is intentionally included by this projection.
 */
export const collectActivePositionTpSlOrders = (
  coin: string,
  openOrders: readonly OpenOrder[],
): PerpsPositionTpSlOrderViewModel[] => {
  const seen = new Set<number>();
  const result: PerpsPositionTpSlOrderViewModel[] = [];

  for (const order of openOrders) {
    if (seen.has(order.oid)) {
      continue;
    }
    seen.add(order.oid);
    const kind = resolveKind(order);
    const triggerPrice = positiveDecimal(order.triggerPx);
    if (
      order.coin !== coin ||
      !order.reduceOnly ||
      !order.isTrigger ||
      !kind ||
      !triggerPrice
    ) {
      continue;
    }

    const remainingSize = positiveDecimal(order.sz);
    const scope: PerpsPositionTpSlScope = order.isPositionTpsl
      ? 'position'
      : 'partial';
    if (scope === 'partial' && !remainingSize) {
      continue;
    }

    result.push({
      execution: 'market',
      key: `${scope}:${coin}:${order.oid}`,
      kind,
      oid: order.oid,
      originalSize: positiveDecimal(order.origSz) ?? remainingSize ?? '0',
      remainingSize: remainingSize ?? '0',
      scope,
      side: order.side,
      timestamp: Number.isFinite(order.timestamp) ? order.timestamp : 0,
      triggerPrice,
    });
  }

  return result;
};

const nearestToMark = (
  orders: readonly PerpsPositionTpSlOrderViewModel[],
  markPrice: string | null,
) => {
  const mark = finiteDecimal(markPrice);
  if (!mark?.gt(0)) {
    return null;
  }
  let nearest: PerpsPositionTpSlOrderViewModel | null = null;
  let nearestDistance: BigNumber | null = null;
  for (const order of orders) {
    const distance = new BigNumber(order.triggerPrice).minus(mark).abs();
    if (
      !nearest ||
      !nearestDistance ||
      distance.lt(nearestDistance) ||
      (distance.eq(nearestDistance) &&
        (order.timestamp > nearest.timestamp ||
          (order.timestamp === nearest.timestamp && order.oid < nearest.oid)))
    ) {
      nearest = order;
      nearestDistance = distance;
    }
  }
  return nearest;
};

const buildSideSummary = (
  partialOrders: PerpsPositionTpSlOrderViewModel[],
  positionOrders: PerpsPositionTpSlOrderViewModel[],
  markPrice: string | null,
): PerpsPositionTpSlSideSummary => {
  return {
    duplicatePositionOrders: positionOrders.length > 1,
    nearestPartialOrder: nearestToMark(partialOrders, markPrice),
    nearestPositionOrder: nearestToMark(positionOrders, markPrice),
    partialOrders,
    positionOrders,
  };
};

export const buildPositionTpSlSummary = (
  orders: readonly PerpsPositionTpSlOrderViewModel[],
  markPrice: string | null,
): PerpsPositionTpSlSummary => {
  const takeProfitPartial: PerpsPositionTpSlOrderViewModel[] = [];
  const takeProfitPosition: PerpsPositionTpSlOrderViewModel[] = [];
  const stopLossPartial: PerpsPositionTpSlOrderViewModel[] = [];
  const stopLossPosition: PerpsPositionTpSlOrderViewModel[] = [];
  for (const order of orders) {
    const target =
      order.kind === 'takeProfit'
        ? order.scope === 'partial'
          ? takeProfitPartial
          : takeProfitPosition
        : order.scope === 'partial'
        ? stopLossPartial
        : stopLossPosition;
    target.push(order);
  }
  const takeProfit = buildSideSummary(
    takeProfitPartial,
    takeProfitPosition,
    markPrice,
  );
  const stopLoss = buildSideSummary(
    stopLossPartial,
    stopLossPosition,
    markPrice,
  );
  const partialCount =
    takeProfit.partialOrders.length + stopLoss.partialOrders.length;
  const positionCount =
    takeProfit.positionOrders.length + stopLoss.positionOrders.length;
  return {
    mode:
      partialCount > 0 && positionCount > 0
        ? 'mixed'
        : partialCount > 0
        ? 'partial'
        : positionCount > 0
        ? 'position'
        : 'none',
    partialCount,
    stopLoss,
    takeProfit,
  };
};

export const sortPartialPositionTpSlOrders = (
  orders: readonly PerpsPositionTpSlOrderViewModel[],
  direction: 'long' | 'short',
) =>
  orders
    .filter(order => order.scope === 'partial')
    .slice()
    .sort((left, right) => {
      const leftPrice = new BigNumber(left.triggerPrice);
      const rightPrice = new BigNumber(right.triggerPrice);
      const priceOrder =
        direction === 'long'
          ? rightPrice.comparedTo(leftPrice)
          : leftPrice.comparedTo(rightPrice);
      if (priceOrder !== 0) {
        return priceOrder;
      }
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }
      return left.oid - right.oid;
    });

export const calculatePartialTpSlCoverage = (
  orders: readonly PerpsPositionTpSlOrderViewModel[],
  positionSize: string,
) => {
  const position = finiteDecimal(positionSize);
  if (!position?.gt(0)) {
    return null;
  }
  return orders
    .filter(order => order.scope === 'partial')
    .reduce((total, order) => total.plus(order.remainingSize), new BigNumber(0))
    .dividedBy(position)
    .toString();
};

export const calculatePositionTpSlEstimatedPnl = ({
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
  const entry = finiteDecimal(entryPrice);
  const trigger = finiteDecimal(triggerPrice);
  const amount = finiteDecimal(size);
  if (!entry?.gt(0) || !trigger?.gt(0) || !amount?.gt(0)) {
    return null;
  }
  return (direction === 'long' ? trigger.minus(entry) : entry.minus(trigger))
    .multipliedBy(amount)
    .toString();
};

export const calculatePositionTpSlRoi = ({
  direction,
  entryPrice,
  leverage,
  triggerPrice,
}: {
  direction: 'long' | 'short';
  entryPrice: string | null;
  leverage: number;
  triggerPrice: string;
}) => {
  const entry = finiteDecimal(entryPrice);
  const trigger = finiteDecimal(triggerPrice);
  if (
    !entry?.gt(0) ||
    !trigger?.gt(0) ||
    !Number.isFinite(leverage) ||
    leverage <= 0
  ) {
    return null;
  }
  const directionalDelta =
    direction === 'long' ? trigger.minus(entry) : entry.minus(trigger);
  return directionalDelta
    .dividedBy(entry)
    .multipliedBy(leverage)
    .multipliedBy(100)
    .toString();
};

export const calculatePositionTpSlTriggerFromRoi = ({
  direction,
  entryPrice,
  kind,
  leverage,
  pxDecimals,
  roiPercent,
}: {
  direction: 'long' | 'short';
  entryPrice: string | null;
  kind: PerpsPositionTpSlKind;
  leverage: number;
  pxDecimals: number;
  roiPercent: string;
}) => {
  const entry = finiteDecimal(entryPrice);
  const roi = finiteDecimal(roiPercent);
  if (
    !entry?.gt(0) ||
    !roi?.gt(0) ||
    !Number.isFinite(leverage) ||
    leverage <= 0 ||
    !Number.isSafeInteger(pxDecimals) ||
    pxDecimals < 0
  ) {
    return null;
  }
  const pnlSign = kind === 'takeProfit' ? 1 : -1;
  const directionSign = direction === 'long' ? 1 : -1;
  const factor = roi.dividedBy(leverage).dividedBy(100);
  const trigger = entry.multipliedBy(
    new BigNumber(1).plus(factor.multipliedBy(pnlSign * directionSign)),
  );
  if (!trigger.gt(0)) {
    return null;
  }
  return trigger.decimalPlaces(pxDecimals, BigNumber.ROUND_DOWN).toFixed();
};

export const calculatePositionTpSlTriggerFromPnl = ({
  direction,
  entryPrice,
  kind,
  pnl,
  pxDecimals,
  size,
}: {
  direction: 'long' | 'short';
  entryPrice: string | null;
  kind: PerpsPositionTpSlKind;
  pnl: string;
  pxDecimals: number;
  size: string;
}) => {
  const entry = finiteDecimal(entryPrice);
  const targetPnl = finiteDecimal(pnl);
  const amount = finiteDecimal(size);
  if (
    !entry?.gt(0) ||
    !targetPnl?.gt(0) ||
    !amount?.gt(0) ||
    !Number.isSafeInteger(pxDecimals) ||
    pxDecimals < 0
  ) {
    return null;
  }
  const pnlSign = kind === 'takeProfit' ? 1 : -1;
  const directionSign = direction === 'long' ? 1 : -1;
  const trigger = entry.plus(
    targetPnl.dividedBy(amount).multipliedBy(pnlSign * directionSign),
  );
  if (!trigger.gt(0)) {
    return null;
  }
  return trigger.decimalPlaces(pxDecimals, BigNumber.ROUND_DOWN).toFixed();
};

export type PerpsPositionTpSlTriggerValidation =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'valid'; normalized: string };

export type PerpsPositionTpSlFormTriggerInvalidReason =
  | 'takeProfitAboveMark'
  | 'takeProfitBelowMark'
  | 'stopLossAboveLiquidation'
  | 'stopLossAboveMark'
  | 'stopLossBelowLiquidation'
  | 'stopLossBelowMark'
  | 'takeProfitDerivedInvalid'
  | 'stopLossDerivedInvalid';

export type PerpsPositionTpSlFormTriggerValidation =
  | { kind: 'empty' }
  | {
      kind: 'invalid';
      liquidationPrice?: string;
      reason: PerpsPositionTpSlFormTriggerInvalidReason;
    }
  | { kind: 'valid'; normalized: string };

/**
 * Mirrors Desktop Perps' full-position TP/SL form feedback only. This is a
 * presentation guard: partial TP/SL and the Action/Command boundary keep
 * using validatePositionTpSlTrigger and their existing invariants.
 */
export const validateFullPositionTpSlFormTrigger = ({
  direction,
  inputSource,
  kind,
  liquidationPrice,
  markPrice,
  rawMagnitude,
  triggerPrice,
}: {
  direction: 'long' | 'short';
  inputSource: 'mode' | 'trigger';
  kind: PerpsPositionTpSlKind;
  liquidationPrice: string | null;
  markPrice: string | null;
  rawMagnitude: string;
  triggerPrice: string;
}): PerpsPositionTpSlFormTriggerValidation => {
  const trigger = finiteDecimal(triggerPrice);
  const hasPositiveModeMagnitude =
    inputSource === 'mode' && !!finiteDecimal(rawMagnitude)?.gt(0);
  const liquidation = finiteDecimal(liquidationPrice);
  const validLiquidation = liquidation?.gt(0) ? liquidation : null;

  if (!triggerPrice.trim() || trigger?.isZero()) {
    if (!hasPositiveModeMagnitude) {
      return { kind: 'empty' };
    }
    if (kind === 'stopLoss' && direction === 'long' && validLiquidation) {
      return {
        kind: 'invalid',
        liquidationPrice: validLiquidation.toString(),
        reason: 'stopLossBelowLiquidation',
      };
    }
    return {
      kind: 'invalid',
      reason:
        kind === 'takeProfit'
          ? 'takeProfitDerivedInvalid'
          : 'stopLossDerivedInvalid',
    };
  }

  const mark = finiteDecimal(markPrice);
  if (!trigger?.gt(0) || !mark?.gt(0)) {
    return {
      kind: 'invalid',
      reason:
        kind === 'takeProfit'
          ? 'takeProfitDerivedInvalid'
          : 'stopLossDerivedInvalid',
    };
  }

  if (kind === 'stopLoss' && validLiquidation) {
    if (direction === 'long' && trigger.lte(validLiquidation)) {
      return {
        kind: 'invalid',
        liquidationPrice: validLiquidation.toString(),
        reason: 'stopLossBelowLiquidation',
      };
    }
    if (direction === 'short' && trigger.gte(validLiquidation)) {
      return {
        kind: 'invalid',
        liquidationPrice: validLiquidation.toString(),
        reason: 'stopLossAboveLiquidation',
      };
    }
  }

  if (kind === 'takeProfit') {
    if (direction === 'long' && trigger.lte(mark)) {
      return { kind: 'invalid', reason: 'takeProfitBelowMark' };
    }
    if (direction === 'short' && trigger.gte(mark)) {
      return { kind: 'invalid', reason: 'takeProfitAboveMark' };
    }
  } else {
    if (direction === 'long' && trigger.gte(mark)) {
      return { kind: 'invalid', reason: 'stopLossAboveMark' };
    }
    if (direction === 'short' && trigger.lte(mark)) {
      return { kind: 'invalid', reason: 'stopLossBelowMark' };
    }
  }

  return { kind: 'valid', normalized: trigger.toString() };
};

export const validatePositionTpSlTrigger = ({
  direction,
  kind,
  markPrice,
  triggerPrice,
}: {
  direction: 'long' | 'short';
  kind: PerpsPositionTpSlKind;
  markPrice: string | null;
  triggerPrice: string;
}): PerpsPositionTpSlTriggerValidation => {
  if (!triggerPrice.trim()) {
    return { kind: 'empty' };
  }
  const mark = finiteDecimal(markPrice);
  const trigger = finiteDecimal(triggerPrice);
  if (!mark?.gt(0) || !trigger?.gt(0)) {
    return { kind: 'invalid' };
  }
  const shouldBeAbove =
    (direction === 'long' && kind === 'takeProfit') ||
    (direction === 'short' && kind === 'stopLoss');
  if (shouldBeAbove ? trigger.lte(mark) : trigger.gte(mark)) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', normalized: trigger.toString() };
};

export type PerpsPositionTpSlAmountValidation =
  | { kind: 'invalid' }
  | { kind: 'valid'; normalized: string };

export const validatePartialPositionTpSlAmount = ({
  amount,
  positionSize,
  szDecimals,
}: {
  amount: string;
  positionSize: string;
  szDecimals: number;
}): PerpsPositionTpSlAmountValidation => {
  const requested = finiteDecimal(amount);
  const position = finiteDecimal(positionSize);
  if (
    !Number.isSafeInteger(szDecimals) ||
    szDecimals < 0 ||
    !requested?.gt(0) ||
    !position?.gt(0) ||
    requested.gt(position)
  ) {
    return { kind: 'invalid' };
  }
  const normalized = requested
    .decimalPlaces(szDecimals, BigNumber.ROUND_DOWN)
    .toFixed();
  if (new BigNumber(normalized).lte(0)) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', normalized };
};
