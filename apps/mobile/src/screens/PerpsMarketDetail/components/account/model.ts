import BigNumber from 'bignumber.js';
import { simplePriceText } from '../chart/model';

type PriceInput = string | number | null | undefined;
const finiteDecimal = (value: PriceInput): BigNumber | null => {
  if (value == null || (typeof value === 'string' && !value.trim()))
    return null;
  const number = new BigNumber(value);
  return number.isFinite() ? number : null;
};

/** Simple display rule: a finite nonpositive liquidation price is the zero boundary. */
export function simpleLiquidationGap(
  liquidation: PriceInput,
  mark: PriceInput,
) {
  const liq = finiteDecimal(liquidation);
  const price = finiteDecimal(mark);
  if (!liq || !price?.gt(0)) return '--';
  const gap = BigNumber.maximum(liq, 0).minus(price).div(price).times(100);
  if (!gap.isFinite()) return '--';
  const rounded = gap.decimalPlaces(2);
  return `${rounded.gt(0) ? '+' : ''}${
    rounded.isZero() ? '0.00' : rounded.toFixed(2)
  }%`;
}

export function hasPositivePrice(value: PriceInput) {
  return finiteDecimal(value)?.gt(0) ?? false;
}

/** Shared display text for the position card and chart; never a trading input. */
export function simpleLiquidationPriceText(
  liquidation: PriceInput,
  decimals: number | null | undefined,
) {
  const price = finiteDecimal(liquidation);
  if (!price?.gt(0)) {
    return '--';
  }
  return price
    .decimalPlaces(decimals ?? 2, BigNumber.ROUND_HALF_UP)
    .toFormat({ decimalSeparator: '.', groupSeparator: ',', groupSize: 3 });
}

/** Mirrors the existing submit precision, without feeding display values into the order. */
export function closeQuantitySummary(
  size: string,
  percent: number,
  decimals: number,
  mark: number,
) {
  const quantity =
    percent === 100
      ? Number(size).toString()
      : ((Number(size) * percent) / 100).toFixed(decimals);
  return { quantity, notional: new BigNumber(quantity).times(mark).toFixed(2) };
}

export type AccountHeaderQuote = {
  price: string;
};
export const EMPTY_ACCOUNT_QUOTE: AccountHeaderQuote = {
  price: '—',
};
export function accountHeaderQuote(
  mark: number,
  decimals: number,
): AccountHeaderQuote {
  const price = Number.isFinite(mark) && mark > 0 ? mark : null;
  return {
    price: price === null ? '—' : `$${simplePriceText(price, decimals)}`,
  };
}

export function isAccountHeaderCompact(
  scrollY: number,
  priceBottom: number | null,
) {
  return (
    priceBottom !== null &&
    Number.isFinite(priceBottom) &&
    priceBottom > 0 &&
    scrollY >= priceBottom
  );
}

export type AccountHeaderSnapshot = {
  compact: boolean;
  quote: AccountHeaderQuote;
};
export type AccountHeaderHandle = {
  update: (snapshot: AccountHeaderSnapshot) => void;
};
export const sameAccountHeader = (
  a: AccountHeaderSnapshot,
  b: AccountHeaderSnapshot,
) => a.compact === b.compact && a.quote.price === b.quote.price;

/** One page-owned UI snapshot; no subscriptions or business data ownership. */
export function createAccountHeaderPresentation(
  publish: (snapshot: AccountHeaderSnapshot) => void,
) {
  const snapshot = {
    current: { compact: false, quote: EMPTY_ACCOUNT_QUOTE },
  } as { current: AccountHeaderSnapshot };
  let active = false;
  let scrollY = 0;
  let priceBottom: number | null = null;
  let published = snapshot.current;
  const flush = () => {
    snapshot.current = {
      ...snapshot.current,
      compact: isAccountHeaderCompact(scrollY, priceBottom),
    };
    if (!active || sameAccountHeader(published, snapshot.current)) return;
    // Quotes are not rendered in the normal header. Keep only the latest snapshot.
    if (!snapshot.current.compact && !published.compact) return;
    published = snapshot.current;
    publish(published);
  };
  return {
    snapshot,
    scroll: (offset: number) => {
      scrollY = offset;
      if (
        isAccountHeaderCompact(scrollY, priceBottom) !==
        snapshot.current.compact
      )
        flush();
    },
    layout: (bottom: number) => {
      priceBottom = bottom;
      flush();
    },
    quote: (quote: AccountHeaderQuote, isActive: boolean) => {
      active = isActive;
      snapshot.current = { ...snapshot.current, quote };
      flush();
    },
    reset: () => {
      active = false;
      priceBottom = null;
      snapshot.current = { compact: false, quote: EMPTY_ACCOUNT_QUOTE };
      published = snapshot.current;
      publish(published);
    },
  };
}
