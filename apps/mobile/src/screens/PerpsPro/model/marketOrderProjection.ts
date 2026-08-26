import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import {
  estimatePerpsProMarketFill,
  type PerpsProMarketFillEstimateError,
} from './marketFillEstimate';
import type { PerpsProTradeSide } from './trade';

export type PerpsProMarketOrderProjection =
  | {
      baseSize: string;
      bookTime: number;
      estimatedEntryPrice: string;
      estimatedQuoteAmount: string;
      levelsUsed: number;
      sessionKey: string;
      slippageReferenceMidPrice: string | null;
      source: 'fullL2';
    }
  | {
      baseSize: string;
      estimatedEntryPrice: null;
      estimatedQuoteAmount: string | null;
      fillError: PerpsProMarketFillEstimateError;
      slippageReferenceMidPrice: string | null;
      source: 'midFallback';
    };

/**
 * Risk displays follow the executable projection when the book can fill the
 * whole order, and otherwise use the same Mid anchor already frozen for the
 * Market command. The fallback stays explicitly tagged as `midFallback`; it
 * is never presented as a VWAP estimate.
 */
export const resolvePerpsProMarketRiskEntryPrice = (
  projection: PerpsProMarketOrderProjection | null | undefined,
): string | null => {
  if (!projection) {
    return null;
  }
  return projection.source === 'fullL2'
    ? projection.estimatedEntryPrice
    : projection.slippageReferenceMidPrice;
};

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

/**
 * Separates the two prices used by a Market order:
 * - full-L2 VWAP estimates the directional fill for UI risk/cost projection;
 * - Mid remains the SDK slippage-protection anchor.
 *
 * The canonical base size is supplied by the existing Amount path so this
 * projection cannot silently rewrite the user's frozen order size.
 */
export const resolvePerpsProMarketOrderProjection = ({
  baseSize,
  book,
  coin,
  midPrice,
  sessionKey,
  side,
  status,
  szDecimals,
}: {
  baseSize: string;
  book: L2Book | null;
  coin: string;
  midPrice: string;
  sessionKey: string | null;
  side: PerpsProTradeSide;
  status: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  szDecimals: number;
}): PerpsProMarketOrderProjection | null => {
  const normalizedBase = positive(baseSize);
  if (!normalizedBase) return null;

  const mid = positive(midPrice);
  const estimate = estimatePerpsProMarketFill({
    amount: normalizedBase.toFixed(),
    amountUnit: 'base',
    book,
    coin,
    sessionKey,
    side,
    status,
    szDecimals,
  });
  if (estimate.ok) {
    return {
      baseSize: estimate.estimate.baseSize,
      bookTime: estimate.estimate.bookTime,
      estimatedEntryPrice: estimate.estimate.expectedEntryPrice,
      estimatedQuoteAmount: estimate.estimate.quoteAmount,
      levelsUsed: estimate.estimate.levelsUsed,
      sessionKey: estimate.estimate.sessionKey,
      slippageReferenceMidPrice: mid?.toFixed() ?? null,
      source: 'fullL2',
    };
  }

  return {
    baseSize: normalizedBase.toFixed(),
    estimatedEntryPrice: null,
    estimatedQuoteAmount: mid
      ? normalizedBase.multipliedBy(mid).toFixed()
      : null,
    fillError: estimate.error,
    slippageReferenceMidPrice: mid?.toFixed() ?? null,
    source: 'midFallback',
  };
};
