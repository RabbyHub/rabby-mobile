import type { OpenOrder, SpotMeta } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

// Hyperliquid spot pairs are addressed as asset id 10000 + universe index. The
// pair's market key (mids, l2Book, open orders) is its universe `name`: the
// canonical PURR pair is 'PURR/USDC', every other pair is '@<index>'.
export const SPOT_ASSET_ID_OFFSET = 10000;
// Hyperliquid rejects spot orders below 10 units of the quote token.
export const SPOT_MIN_ORDER_NOTIONAL = 10;
// Spot prices allow at most 8 - szDecimals decimals and 5 significant figures.
export const SPOT_MAX_PRICE_DECIMALS = 8;
export const SPOT_MAX_SIG_FIGS = 5;
// Market orders are sent as IOC limit orders crossing the mid by this ratio.
export const SPOT_MARKET_SLIPPAGE = 0.05;

export type SpotMarket = {
  pairIndex: number;
  /** Market key used by mids, l2Book and open orders ('PURR/USDC' | '@107'). */
  coin: string;
  baseName: string;
  quoteName: string;
  baseTokenIndex: number;
  quoteTokenIndex: number;
  /** Size precision of the base token. */
  szDecimals: number;
  isCanonical: boolean;
  midPx: string | null;
};

export type SpotOrderSide = 'buy' | 'sell';
export type SpotOrderType = 'market' | 'limit';

export const getSpotMarketDisplayName = (
  market: Pick<SpotMarket, 'baseName' | 'quoteName'>,
) => `${market.baseName}/${market.quoteName}`;

export const buildSpotMarkets = (
  spotMeta: SpotMeta | null | undefined,
  mids: Record<string, string> | null | undefined,
): SpotMarket[] => {
  if (!spotMeta?.tokens || !spotMeta.universe) {
    return [];
  }
  const tokensByIndex = new Map(
    spotMeta.tokens.map(token => [token.index, token]),
  );
  const markets: SpotMarket[] = [];
  for (const pair of spotMeta.universe) {
    const base = tokensByIndex.get(pair.tokens[0]);
    const quote = tokensByIndex.get(pair.tokens[1]);
    if (!base || !quote) {
      continue;
    }
    markets.push({
      pairIndex: pair.index,
      coin: pair.name,
      baseName: base.name,
      quoteName: quote.name,
      baseTokenIndex: base.index,
      quoteTokenIndex: quote.index,
      szDecimals: base.szDecimals ?? 0,
      isCanonical: !!pair.isCanonical,
      midPx: mids?.[pair.name] ?? null,
    });
  }
  return markets;
};

/**
 * Markets that can be traded from the UI: priced pairs, canonical first, then
 * by base name. Unpriced pairs have no liquidity and are dropped.
 */
export const sortSpotMarkets = (markets: SpotMarket[]): SpotMarket[] =>
  markets
    .filter(market => Number(market.midPx) > 0)
    .sort((a, b) => {
      if (a.isCanonical !== b.isCanonical) {
        return a.isCanonical ? -1 : 1;
      }
      return a.baseName.localeCompare(b.baseName);
    });

export const filterSpotMarkets = (
  markets: SpotMarket[],
  query: string,
): SpotMarket[] => {
  const q = query.trim().toUpperCase();
  if (!q) {
    return markets;
  }
  return markets.filter(
    market =>
      market.baseName.toUpperCase().includes(q) ||
      getSpotMarketDisplayName(market).toUpperCase().includes(q),
  );
};

/** Round a size down to the base token precision. */
export const formatSpotSize = (
  size: BigNumber.Value,
  szDecimals: number,
): string => {
  const bn = new BigNumber(size);
  if (!bn.isFinite() || bn.lte(0)) {
    return '0';
  }
  return bn.decimalPlaces(szDecimals, BigNumber.ROUND_DOWN).toFixed();
};

/**
 * Round a price to Hyperliquid spot rules: integers are always valid,
 * otherwise at most 5 significant figures and 8 - szDecimals decimals.
 */
export const formatSpotPrice = (
  price: BigNumber.Value,
  szDecimals: number,
  roundingMode: BigNumber.RoundingMode = BigNumber.ROUND_HALF_UP,
): string => {
  const bn = new BigNumber(price);
  if (!bn.isFinite() || bn.lte(0)) {
    return '0';
  }
  const maxDecimals = Math.max(SPOT_MAX_PRICE_DECIMALS - szDecimals, 0);
  const integerDigits = bn.integerValue(BigNumber.ROUND_DOWN).toFixed().length;
  if (bn.gte(1) && integerDigits >= SPOT_MAX_SIG_FIGS) {
    return bn.integerValue(roundingMode).toFixed();
  }
  const sigRounded = bn.precision(SPOT_MAX_SIG_FIGS, roundingMode);
  return sigRounded.decimalPlaces(maxDecimals, roundingMode).toFixed();
};

/** Round a user limit price toward the passive side of the book. */
export const formatSpotLimitPrice = (
  price: BigNumber.Value,
  side: SpotOrderSide,
  szDecimals: number,
) =>
  formatSpotPrice(
    price,
    szDecimals,
    side === 'buy' ? BigNumber.ROUND_DOWN : BigNumber.ROUND_UP,
  );

/** Limit price used to send a market order as an aggressive IOC. */
export const getSpotMarketOrderPrice = (
  midPx: BigNumber.Value,
  side: SpotOrderSide,
  szDecimals: number,
  slippage = SPOT_MARKET_SLIPPAGE,
): string => {
  const mid = new BigNumber(midPx);
  const raw =
    side === 'buy' ? mid.times(1 + slippage) : mid.times(1 - slippage);
  return formatSpotPrice(
    raw,
    szDecimals,
    side === 'buy' ? BigNumber.ROUND_DOWN : BigNumber.ROUND_UP,
  );
};

export type SpotOrderValidationError =
  | 'invalidSize'
  | 'invalidPrice'
  | 'belowMinNotional'
  | 'insufficientBalance'
  | 'priceFarFromMarket'
  | 'stalePrice';

// Market orders are refused when the last mid is older than this.
export const SPOT_PRICE_MAX_AGE_MS = 15_000;

export type SpotOrderDraft = {
  side: SpotOrderSide;
  size: string;
  /** Price used for notional and balance checks (mid for market orders). */
  price: string;
  szDecimals: number;
  baseAvailable: BigNumber.Value;
  quoteAvailable: BigNumber.Value;
  /** Current mid; when set, limits crossing it by more than the market
   * slippage are refused and market prices must cross it. */
  midPx?: BigNumber.Value | null;
  orderType?: SpotOrderType;
};

export const validateSpotOrder = (
  draft: SpotOrderDraft,
): SpotOrderValidationError | null => {
  const size = new BigNumber(formatSpotSize(draft.size, draft.szDecimals));
  if (!size.isFinite() || size.lte(0)) {
    return 'invalidSize';
  }
  const price = new BigNumber(draft.price);
  if (!price.isFinite() || price.lte(0)) {
    return 'invalidPrice';
  }
  const mid = new BigNumber(draft.midPx ?? NaN);
  if (mid.isFinite() && mid.gt(0)) {
    const isBuy = draft.side === 'buy';
    if (draft.orderType === 'market') {
      // Rounding can push the IOC price back across the mid on very small
      // tick sizes; such an order could never fill.
      if (isBuy ? price.lte(mid) : price.gte(mid)) {
        return 'invalidPrice';
      }
    } else {
      // A limit that crosses the book this far behaves like an uncapped
      // market order on thin spot pairs.
      const bound = mid.times(
        isBuy ? 1 + SPOT_MARKET_SLIPPAGE : 1 - SPOT_MARKET_SLIPPAGE,
      );
      if (isBuy ? price.gt(bound) : price.lt(bound)) {
        return 'priceFarFromMarket';
      }
    }
  }
  const notional = size.times(price);
  if (notional.lt(SPOT_MIN_ORDER_NOTIONAL)) {
    return 'belowMinNotional';
  }
  const available =
    draft.side === 'buy'
      ? new BigNumber(draft.quoteAvailable)
      : new BigNumber(draft.baseAvailable);
  const required = draft.side === 'buy' ? notional : size;
  if (!available.isFinite() || available.lt(required)) {
    return 'insufficientBalance';
  }
  return null;
};

/** Largest size the available balance covers at `price`. */
export const getSpotMaxSize = ({
  side,
  price,
  szDecimals,
  baseAvailable,
  quoteAvailable,
}: Omit<SpotOrderDraft, 'size' | 'midPx' | 'orderType'>): string => {
  if (side === 'sell') {
    return formatSpotSize(baseAvailable, szDecimals);
  }
  const px = new BigNumber(price);
  if (!px.isFinite() || px.lte(0)) {
    return '0';
  }
  return formatSpotSize(new BigNumber(quoteAvailable).div(px), szDecimals);
};

export const isSpotOpenOrder = (order: Pick<OpenOrder, 'coin'>) =>
  order.coin.startsWith('@') || order.coin.includes('/');

export type SpotOpenOrderItem = {
  order: OpenOrder;
  market: SpotMarket;
};

/**
 * Open spot orders across all pairs, newest first. Orders whose pair is not
 * in the market list are dropped: without its pair index they can't be
 * cancelled from the app.
 */
export const buildSpotOpenOrderItems = (
  orders: OpenOrder[] | null | undefined,
  markets: SpotMarket[],
): SpotOpenOrderItem[] => {
  if (!orders?.length) {
    return [];
  }
  const marketsByCoin = new Map(markets.map(market => [market.coin, market]));
  const items: SpotOpenOrderItem[] = [];
  for (const order of orders) {
    const market = marketsByCoin.get(order.coin);
    if (market) {
      items.push({ order, market });
    }
  }
  return items.sort((a, b) => b.order.timestamp - a.order.timestamp);
};
