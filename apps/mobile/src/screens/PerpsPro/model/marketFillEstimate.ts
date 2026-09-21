import type { L2Book, WsLevel } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import type { PerpsProTradeAmountUnit, PerpsProTradeSide } from './trade';

export type PerpsProMarketFillEstimateError =
  | 'bookStale'
  | 'bookUnavailable'
  | 'insufficientDepth'
  | 'invalidAmount'
  | 'invalidLevel'
  | 'marketMismatch'
  | 'zeroNormalizedSize';

export type PerpsProMarketFillEstimate = {
  baseSize: string;
  bookTime: number;
  expectedEntryPrice: string;
  levelsUsed: number;
  quoteAmount: string;
  sessionKey: string;
};

export type PerpsProMarketFillEstimateResult =
  | { error: PerpsProMarketFillEstimateError; ok: false }
  | { estimate: PerpsProMarketFillEstimate; ok: true };

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

type ConsumeBaseResult =
  | { error: 'insufficientDepth' | 'invalidLevel' }
  | { filledBase: BigNumber; levelsUsed: number; quoteAmount: BigNumber };

const consumeBase = (
  levels: readonly WsLevel[],
  targetBase: BigNumber,
): ConsumeBaseResult => {
  let remaining = targetBase;
  let filledBase = new BigNumber(0);
  let quoteAmount = new BigNumber(0);
  let levelsUsed = 0;

  for (const level of levels) {
    if (remaining.lte(0)) break;
    const price = positive(level.px);
    const size = positive(level.sz);
    if (!price || !size) return { error: 'invalidLevel' as const };
    const fillSize = BigNumber.min(remaining, size);
    filledBase = filledBase.plus(fillSize);
    quoteAmount = quoteAmount.plus(fillSize.multipliedBy(price));
    remaining = remaining.minus(fillSize);
    levelsUsed += 1;
  }

  return remaining.gt(0)
    ? { error: 'insufficientDepth' as const }
    : { filledBase, levelsUsed, quoteAmount };
};

type ResolveBaseFromQuoteResult =
  | { baseSize: BigNumber }
  | { error: 'insufficientDepth' | 'invalidLevel' };

const resolveBaseFromQuote = (
  levels: readonly WsLevel[],
  targetQuote: BigNumber,
): ResolveBaseFromQuoteResult => {
  let remaining = targetQuote;
  let baseSize = new BigNumber(0);

  for (const level of levels) {
    if (remaining.lte(0)) break;
    const price = positive(level.px);
    const size = positive(level.sz);
    if (!price || !size) return { error: 'invalidLevel' as const };
    const availableQuote = price.multipliedBy(size);
    const consumedQuote = BigNumber.min(remaining, availableQuote);
    baseSize = baseSize.plus(consumedQuote.dividedBy(price));
    remaining = remaining.minus(consumedQuote);
  }

  return remaining.gt(0)
    ? { error: 'insufficientDepth' as const }
    : { baseSize };
};

export const estimatePerpsProMarketFill = ({
  amount,
  amountUnit,
  book,
  coin,
  sessionKey,
  side,
  status,
  szDecimals,
}: {
  amount: string;
  amountUnit: PerpsProTradeAmountUnit;
  book: L2Book | null;
  coin: string;
  sessionKey: string | null;
  side: PerpsProTradeSide;
  status: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  szDecimals: number;
}): PerpsProMarketFillEstimateResult => {
  if (status === 'stale') return { error: 'bookStale', ok: false };
  if (status !== 'ready' || !book || !sessionKey) {
    return { error: 'bookUnavailable', ok: false };
  }
  if (book.coin !== coin || !Number.isFinite(book.time) || book.time <= 0) {
    return { error: 'marketMismatch', ok: false };
  }
  if (!Number.isSafeInteger(szDecimals) || szDecimals < 0) {
    return { error: 'invalidAmount', ok: false };
  }
  const amountValue = positive(amount);
  if (!amountValue) return { error: 'invalidAmount', ok: false };

  const levels = side === 'buy' ? book.levels[1] : book.levels[0];
  if (!Array.isArray(levels) || levels.length === 0) {
    return { error: 'bookUnavailable', ok: false };
  }

  const rawBase =
    amountUnit === 'base'
      ? { baseSize: amountValue }
      : resolveBaseFromQuote(levels, amountValue);
  if ('error' in rawBase) return { error: rawBase.error, ok: false };

  const normalizedBase = rawBase.baseSize.decimalPlaces(
    szDecimals,
    BigNumber.ROUND_DOWN,
  );
  if (normalizedBase.lte(0)) {
    return { error: 'zeroNormalizedSize', ok: false };
  }

  const consumed = consumeBase(levels, normalizedBase);
  if ('error' in consumed) return { error: consumed.error, ok: false };

  return {
    estimate: {
      baseSize: normalizedBase.toFixed(),
      bookTime: book.time,
      expectedEntryPrice: consumed.quoteAmount
        .dividedBy(consumed.filledBase)
        .toFixed(),
      levelsUsed: consumed.levelsUsed,
      quoteAmount: consumed.quoteAmount.toFixed(),
      sessionKey,
    },
    ok: true,
  };
};
