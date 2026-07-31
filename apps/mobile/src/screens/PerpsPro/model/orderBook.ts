import type { L2Book, WsLevel } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import type { PerpsBookPrecision } from '@/hooks/perps/subscriptions/perpsBookTypes';

export type PerpsTickOption = PerpsBookPrecision & {
  displayPrice: number;
  priceDecimals: number;
};

export type PerpsOrderBookMode = 'both' | 'asks' | 'bids';
export type PerpsOrderBookModeIconTone = 'neutral' | 'ask' | 'bid';
export type PerpsOrderBookRealtimeStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'stale'
  | 'error';
export type PerpsOrderBookDisplayState = 'content' | 'skeleton' | 'unavailable';

const PERPS_ORDER_BOOK_MODE_ORDER: PerpsOrderBookMode[] = [
  'both',
  'bids',
  'asks',
];

export const getNextPerpsOrderBookMode = (mode: PerpsOrderBookMode) =>
  PERPS_ORDER_BOOK_MODE_ORDER[
    (PERPS_ORDER_BOOK_MODE_ORDER.indexOf(mode) + 1) %
      PERPS_ORDER_BOOK_MODE_ORDER.length
  ] ?? 'both';

export const getPerpsOrderBookModeIconTones = (
  mode: PerpsOrderBookMode,
): {
  left: readonly [
    PerpsOrderBookModeIconTone,
    PerpsOrderBookModeIconTone,
    PerpsOrderBookModeIconTone,
  ];
  right: readonly [PerpsOrderBookModeIconTone, PerpsOrderBookModeIconTone];
} => {
  // Product decision D-043 intentionally overrides the older single-side
  // Figma color treatment while retaining its three-left/two-right geometry.
  const leftTone =
    mode === 'asks' ? 'ask' : mode === 'bids' ? 'bid' : 'neutral';
  return {
    left: [leftTone, leftTone, leftTone],
    right: mode === 'both' ? ['ask', 'bid'] : ['neutral', 'neutral'],
  };
};

export const getPerpsOrderBookDisplayState = ({
  hasSnapshot,
  status,
}: {
  hasSnapshot: boolean;
  status: PerpsOrderBookRealtimeStatus;
}): PerpsOrderBookDisplayState => {
  if (hasSnapshot) {
    return 'content';
  }
  if (status === 'idle' || status === 'loading' || status === 'stale') {
    return 'skeleton';
  }
  return 'unavailable';
};

export type PerpsOrderBookLevel = {
  price: string;
  priceNumber: number;
  size: number;
  total: number;
  totalUsd: number;
  usdSize: number;
};

export type ProcessedPerpsOrderBook = {
  asks: PerpsOrderBookLevel[];
  bids: PerpsOrderBookLevel[];
  serverTime: number | null;
};

const cleanTickValue = (value: number) =>
  Number.parseFloat(value.toPrecision(10));

const getDecimalPlaces = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  const valueText = value.toString().toLowerCase();
  if (valueText.includes('e-')) {
    return Number(valueText.split('e-')[1]) || 0;
  }
  return valueText.includes('.') ? valueText.split('.')[1]?.length ?? 0 : 0;
};

export const getPerpTickOptions = (
  currentPrice: number,
  szDecimals: number,
): PerpsTickOption[] => {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return [];
  }
  const maxAllowedDecimals = Math.max(0, 6 - Number(szDecimals || 0));
  const magnitude = Math.floor(Math.log10(currentPrice));
  const options: PerpsTickOption[] = [];

  for (let nSigFigs = 5; nSigFigs >= 2; nSigFigs -= 1) {
    const exponent = magnitude - nSigFigs + 1;
    if (-exponent > maxAllowedDecimals) {
      continue;
    }
    const baseTick = 10 ** exponent;
    const append = (multiple: 1 | 2 | 5, mantissa: 2 | 5 | null) => {
      const displayPrice = cleanTickValue(baseTick * multiple);
      options.push({
        displayPrice,
        mantissa,
        nSigFigs: nSigFigs as PerpsBookPrecision['nSigFigs'],
        priceDecimals: getDecimalPlaces(displayPrice),
      });
    };
    if (nSigFigs === 5) {
      append(1, null);
      append(2, 2);
      append(5, 5);
    } else {
      append(1, null);
    }
  }
  return options;
};

export const isMatchingTickOption = (
  option: PerpsTickOption,
  precision: PerpsBookPrecision | null,
) =>
  !!precision &&
  option.nSigFigs === precision.nSigFigs &&
  option.mantissa === precision.mantissa;

export const resolvePerpsTickOption = (
  options: PerpsTickOption[],
  preferred: PerpsBookPrecision | null,
) =>
  options.find(option => isMatchingTickOption(option, preferred)) ??
  options[0] ??
  null;

const processSide = (levels: WsLevel[] | undefined) => {
  const processed: PerpsOrderBookLevel[] = [];
  let total = new BigNumber(0);
  let totalUsd = new BigNumber(0);

  (levels ?? []).forEach(level => {
    try {
      const price = new BigNumber(level.px);
      const size = new BigNumber(level.sz);
      if (
        !price.isFinite() ||
        !size.isFinite() ||
        !price.isGreaterThan(0) ||
        !size.isGreaterThan(0)
      ) {
        return;
      }
      const usdSize = price.multipliedBy(size);
      const nextTotal = total.plus(size);
      const nextTotalUsd = totalUsd.plus(usdSize);
      const numericValues = [
        price.toNumber(),
        size.toNumber(),
        usdSize.toNumber(),
        nextTotal.toNumber(),
        nextTotalUsd.toNumber(),
      ];
      if (numericValues.some(value => !Number.isFinite(value))) {
        return;
      }
      total = nextTotal;
      totalUsd = nextTotalUsd;
      processed.push({
        price: level.px,
        priceNumber: numericValues[0]!,
        size: numericValues[1]!,
        usdSize: numericValues[2]!,
        total: numericValues[3]!,
        totalUsd: numericValues[4]!,
      });
    } catch {
      return;
    }
  });
  return processed;
};

export const processPerpsOrderBook = (
  book: L2Book | null | undefined,
): ProcessedPerpsOrderBook => ({
  bids: processSide(book?.levels?.[0]),
  asks: processSide(book?.levels?.[1]),
  serverTime:
    book && Number.isFinite(Number(book.time)) ? Number(book.time) : null,
});

export const getPerpsOrderBookRowCount = ({
  containerHeight,
  middleHeight = 58,
  mode,
  rowHeight = 20,
}: {
  containerHeight: number;
  middleHeight?: number;
  mode: PerpsOrderBookMode;
  rowHeight?: number;
}) => {
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return mode === 'both' ? 6 : 15;
  }
  if (mode === 'both') {
    return Math.max(
      1,
      Math.floor(Math.floor((containerHeight - middleHeight) / rowHeight) / 2),
    );
  }
  return Math.max(1, Math.floor(containerHeight / rowHeight));
};

export const selectVisiblePerpsOrderBookRows = ({
  book,
  mode,
  rowCount,
}: {
  book: ProcessedPerpsOrderBook;
  mode: PerpsOrderBookMode;
  rowCount: number;
}) => ({
  asks:
    mode === 'bids' ? [] : book.asks.slice(0, Math.max(1, rowCount)).reverse(),
  bids: mode === 'asks' ? [] : book.bids.slice(0, Math.max(1, rowCount)),
});

export const getVisiblePerpsOrderBookMaxTotal = ({
  asks,
  bids,
}: {
  asks: PerpsOrderBookLevel[];
  bids: PerpsOrderBookLevel[];
}) =>
  Math.max(
    0,
    ...asks.map(level => level.total),
    ...bids.map(level => level.total),
  );

export const getPerpsOrderBookDepthPercent = (
  level: PerpsOrderBookLevel,
  maxTotal: number,
) => {
  if (!Number.isFinite(maxTotal) || maxTotal <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (level.total / maxTotal) * 100));
};

export const calculatePerpsBuyRatio = (
  book: ProcessedPerpsOrderBook,
): { buy: number; sell: number } => {
  const bidQuote = book.bids.reduce(
    (sum, level) => sum.plus(level.usdSize),
    new BigNumber(0),
  );
  const askQuote = book.asks.reduce(
    (sum, level) => sum.plus(level.usdSize),
    new BigNumber(0),
  );
  const total = bidQuote.plus(askQuote);
  if (!total.isFinite() || total.isLessThanOrEqualTo(0)) {
    return { buy: 0, sell: 0 };
  }
  const buy = bidQuote.dividedBy(total).multipliedBy(100).decimalPlaces(2);
  const sell = new BigNumber(100).minus(buy).decimalPlaces(2);
  return { buy: buy.toNumber(), sell: sell.toNumber() };
};
