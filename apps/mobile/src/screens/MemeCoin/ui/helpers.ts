import BigNumber from 'bignumber.js';
import type { MemeHolding } from '../data/types';
import { AMOUNT_EPSILON } from '../engine/constants';
import type { SellHolding } from '../engine/execLegs';
import { tokenKey } from '../engine/keys';
import { computeMemeTargets } from '../engine/planner';
import type {
  AllocationMode,
  MemeTarget,
  PlanResult,
  TokenRef,
} from '../engine/types';
import type { MemeTradeTaskStatus } from '../hooks/useMemeTradeTask';

export const MAX_PRICE_IMPACT_OPTIONS = [1, 5, 20] as const;
export type MaxPriceImpactPct = (typeof MAX_PRICE_IMPACT_OPTIONS)[number];
export const DEFAULT_MAX_PRICE_IMPACT_PCT: MaxPriceImpactPct = 5;

const BUY_AMOUNT_PATTERN = /^(\d+\.?\d{0,2}|\.\d{1,2})$/;

/** ',' counts as the decimal separator; valid amounts are > 0 with at most 2 decimals. */
export const parseBuyAmount = (text: string): number | null => {
  const normalized = text.trim().replace(',', '.');
  if (!BUY_AMOUNT_PATTERN.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return value > 0 ? value : null;
};

/** whole dollars with thousands separators, never abbreviated: $132,262,615 */
export const formatMarketCapUsd = (usd: number) =>
  `$${new BigNumber(usd).toFormat(0)}`;

export type BuySummary =
  | { kind: 'none'; neededUsd: number }
  | { kind: 'short'; shortfallUsd: number }
  | { kind: 'enough'; totalPaymentUsd: number };

export const getBuySummary = ({
  amountUsd,
  selectedCount,
  plan,
}: {
  amountUsd: number;
  selectedCount: number;
  plan: PlanResult;
}): BuySummary => {
  if (selectedCount === 0) {
    return { kind: 'none', neededUsd: amountUsd };
  }
  if (plan.shortfallUsd > AMOUNT_EPSILON) {
    return { kind: 'short', shortfallUsd: plan.shortfallUsd };
  }
  return {
    kind: 'enough',
    totalPaymentUsd: Object.values(plan.paymentBySource).reduce(
      (sum, v) => sum + v,
      0,
    ),
  };
};

export const canConfirmBuy = ({
  amountUsd,
  plan,
}: {
  amountUsd: number | null;
  plan: PlanResult;
}) =>
  amountUsd !== null &&
  plan.legs.length > 0 &&
  plan.shortfallUsd <= AMOUNT_EPSILON;

export type ExecuteButtonState =
  | { kind: 'start' }
  | { kind: 'executing'; done: number; total: number }
  | { kind: 'retry' }
  | { kind: 'done' };

export const getExecuteButtonState = (
  status: MemeTradeTaskStatus,
  done: number,
  total: number,
  canRetry: boolean,
): ExecuteButtonState => {
  if (status === 'idle') {
    return { kind: 'start' };
  }
  if (status === 'running') {
    return { kind: 'executing', done, total };
  }
  return canRetry ? { kind: 'retry' } : { kind: 'done' };
};

export const toSellHoldings = (
  holdings: MemeHolding[],
  getNativeToken: (chainServerId: string) => TokenRef | null,
): SellHolding[] =>
  holdings.flatMap(({ meme, valueUsd }) => {
    const native = getNativeToken(meme.chain);
    return native
      ? [
          {
            meme: { id: meme.id, chain: meme.chain, symbol: meme.symbol },
            valueUsd,
            nativeToken: {
              id: native.id,
              chain: native.chain,
              symbol: native.symbol,
            },
          },
        ]
      : [];
  });

export const pickTokenLogos = (
  tokens: Array<Pick<TokenRef, 'chain' | 'id'>>,
  logoByKey: ReadonlyMap<string, string>,
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const token of tokens) {
    const key = tokenKey(token);
    const logo = logoByKey.get(key);
    if (logo) {
      result[key] = logo;
    }
  }
  return result;
};

export const getMemeAllocations = <T extends MemeTarget>(
  amountUsd: number,
  memes: T[],
  mode: AllocationMode,
) =>
  computeMemeTargets(1, memes, mode)
    .map(({ meme, amountUsd: ratio }) => ({
      meme,
      ratio,
      amountUsd: amountUsd * ratio,
    }))
    .sort((a, b) => b.ratio - a.ratio);

/** whole percent, so two items fit on one row at 360dp: 60%, <1% */
export const formatAllocationPct = (ratio: number) => {
  const pct = new BigNumber(ratio).times(100);
  return pct.gt(0) && pct.lt(1)
    ? '<1%'
    : `${pct.decimalPlaces(0).toString(10)}%`;
};
