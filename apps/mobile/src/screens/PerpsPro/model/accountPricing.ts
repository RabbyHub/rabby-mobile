import type { FFastAssetCtx, SpotMeta } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import { COLLATERAL_TOKEN_TO_QUOTE } from '@/constant/perps';
import type { RawSpotBalance } from '@/utils/perps';

export const ACCOUNT_ZERO = new BigNumber(0);
export const SETTLEMENT_TOKEN_IDS = new Set(
  Object.keys(COLLATERAL_TOKEN_TO_QUOTE).map(Number),
);

export const accountDecimal = (value: unknown): BigNumber => {
  const result = new BigNumber((value as string | number | undefined) ?? 0);
  return result.isFinite() ? result : ACCOUNT_ZERO;
};

type SpotUniversePair = SpotMeta['universe'][number];

interface SpotPriceIndex {
  anyPairByBase: Map<number, SpotUniversePair>;
  tokenIndexByName: Map<string, number>;
  tokenNameByIndex: Map<number, string>;
  usdcPairByBase: Map<number, SpotUniversePair>;
  usdcIndex: number;
}

const spotPriceIndexCache = new WeakMap<SpotMeta, SpotPriceIndex>();

const getSpotPriceIndex = (spotMeta: SpotMeta): SpotPriceIndex => {
  const cached = spotPriceIndexCache.get(spotMeta);
  if (cached) {
    return cached;
  }

  const tokenIndexByName = new Map<string, number>();
  const tokenNameByIndex = new Map<number, string>();
  for (const token of spotMeta.tokens) {
    tokenIndexByName.set(token.name, token.index);
    tokenNameByIndex.set(token.index, token.name);
  }
  const usdcIndex = tokenIndexByName.get('USDC') ?? 0;
  const anyPairByBase = new Map<number, SpotUniversePair>();
  const usdcPairByBase = new Map<number, SpotUniversePair>();
  for (const pair of spotMeta.universe) {
    const base = pair.tokens[0];
    if (!anyPairByBase.has(base)) {
      anyPairByBase.set(base, pair);
    }
    if (pair.tokens[1] === usdcIndex && !usdcPairByBase.has(base)) {
      usdcPairByBase.set(base, pair);
    }
  }

  const index = {
    anyPairByBase,
    tokenIndexByName,
    tokenNameByIndex,
    usdcPairByBase,
    usdcIndex,
  };
  spotPriceIndexCache.set(spotMeta, index);
  return index;
};

const readPairMark = (
  pair: SpotUniversePair,
  spotAssetCtxs: Record<string, FFastAssetCtx>,
): BigNumber | null => {
  const raw =
    spotAssetCtxs[`@${pair.index}`]?.markPx ?? spotAssetCtxs[pair.name]?.markPx;
  const price = accountDecimal(raw);
  return price.gt(0) ? price : null;
};

const addSpotPriceDependencyKeys = (
  tokenName: string,
  index: SpotPriceIndex,
  keys: Set<string>,
  visited: Set<string>,
): void => {
  if (!tokenName || tokenName === 'USDC' || visited.has(tokenName)) {
    return;
  }
  visited.add(tokenName);
  if (tokenName.startsWith('+')) {
    keys.add(`#${tokenName.slice(1)}`);
    return;
  }

  const tokenIndex = index.tokenIndexByName.get(tokenName);
  if (tokenIndex == null) {
    return;
  }
  const directPair = index.usdcPairByBase.get(tokenIndex);
  const pair = directPair ?? index.anyPairByBase.get(tokenIndex);
  if (!pair) {
    return;
  }
  keys.add(`@${pair.index}`);
  keys.add(pair.name);
  if (directPair) {
    return;
  }

  const quoteName = index.tokenNameByIndex.get(pair.tokens[1]);
  if (quoteName && quoteName !== tokenName) {
    addSpotPriceDependencyKeys(quoteName, index, keys, visited);
  }
};

export const getSpotPriceDependencyKeys = (
  tokenNames: string[],
  spotMeta: SpotMeta | null | undefined,
): string[] => {
  const keys = new Set<string>();
  if (!spotMeta) {
    for (const tokenName of tokenNames) {
      if (tokenName.startsWith('+')) {
        keys.add(`#${tokenName.slice(1)}`);
      }
    }
    return [...keys].sort();
  }
  const index = getSpotPriceIndex(spotMeta);

  for (const tokenName of tokenNames) {
    addSpotPriceDependencyKeys(tokenName, index, keys, new Set<string>());
  }

  return [...keys].sort();
};

const resolveSpotUsdcPriceDecimal = (
  tokenName: string,
  spotAssetCtxs: Record<string, FFastAssetCtx>,
  index: SpotPriceIndex,
  visited: Set<string>,
): BigNumber | null => {
  if (!tokenName || visited.has(tokenName)) {
    return null;
  }
  if (tokenName === 'USDC') {
    return new BigNumber(1);
  }
  if (tokenName.startsWith('+')) {
    const price = accountDecimal(
      spotAssetCtxs[`#${tokenName.slice(1)}`]?.markPx,
    );
    return price.gt(0) ? price : null;
  }

  const tokenIndex = index.tokenIndexByName.get(tokenName);
  if (tokenIndex == null) {
    return null;
  }
  visited.add(tokenName);

  const directPair = index.usdcPairByBase.get(tokenIndex);
  if (directPair) {
    return readPairMark(directPair, spotAssetCtxs);
  }

  const pair = index.anyPairByBase.get(tokenIndex);
  if (!pair) {
    return null;
  }
  const pairPrice = readPairMark(pair, spotAssetCtxs);
  const quoteName = index.tokenNameByIndex.get(pair.tokens[1]);
  if (!pairPrice || !quoteName || quoteName === tokenName) {
    return null;
  }
  const quotePrice = resolveSpotUsdcPriceDecimal(
    quoteName,
    spotAssetCtxs,
    index,
    visited,
  );
  return quotePrice ? pairPrice.multipliedBy(quotePrice) : null;
};

export const resolveSpotUsdcPrice = (
  tokenName: string,
  spotAssetCtxs: Record<string, FFastAssetCtx>,
  spotMeta: SpotMeta | null | undefined,
): string | null => {
  if (!tokenName) {
    return null;
  }
  if (!spotMeta) {
    if (tokenName === 'USDC') {
      return '1';
    }
    if (tokenName.startsWith('+')) {
      const price = accountDecimal(
        spotAssetCtxs[`#${tokenName.slice(1)}`]?.markPx,
      );
      return price.gt(0) ? price.toString() : null;
    }
    return null;
  }

  const index = getSpotPriceIndex(spotMeta);
  const price = resolveSpotUsdcPriceDecimal(
    tokenName,
    spotAssetCtxs,
    index,
    new Set<string>(),
  );
  return price?.isFinite() && price.gt(0) ? price.toString() : null;
};

const computeSpotValue = ({
  balances,
  include,
  spotAssetCtxs,
  spotMeta,
}: {
  balances: RawSpotBalance[];
  include?: (balance: RawSpotBalance) => boolean;
  spotAssetCtxs: Record<string, FFastAssetCtx>;
  spotMeta: SpotMeta | null;
}) => {
  let value = ACCOUNT_ZERO;
  const unpricedNonZeroAssets: string[] = [];
  for (const balance of balances) {
    if (include && !include(balance)) {
      continue;
    }
    const amount = accountDecimal(balance.total);
    if (amount.isZero()) {
      continue;
    }
    const price = resolveSpotUsdcPrice(balance.coin, spotAssetCtxs, spotMeta);
    if (!price) {
      unpricedNonZeroAssets.push(balance.coin);
      continue;
    }
    value = value.plus(amount.multipliedBy(price));
  }
  return { unpricedNonZeroAssets, value: value.toString() };
};

export const computeSpotPortfolioValue = (
  balances: RawSpotBalance[],
  spotAssetCtxs: Record<string, FFastAssetCtx>,
  spotMeta: SpotMeta | null,
) => computeSpotValue({ balances, spotAssetCtxs, spotMeta });

export const computePerpsPortfolioValue = ({
  balances,
  includePerpsAccountValue,
  perpsAccountValue,
  spotAssetCtxs,
  spotMeta,
}: {
  balances: RawSpotBalance[];
  includePerpsAccountValue: boolean;
  perpsAccountValue: unknown;
  spotAssetCtxs: Record<string, FFastAssetCtx>;
  spotMeta: SpotMeta | null;
}) => {
  const spotPortfolio = computeSpotPortfolioValue(
    balances,
    spotAssetCtxs,
    spotMeta,
  );

  return {
    unpricedNonZeroAssets: spotPortfolio.unpricedNonZeroAssets,
    value: includePerpsAccountValue
      ? accountDecimal(spotPortfolio.value)
          .plus(accountDecimal(perpsAccountValue))
          .toString()
      : spotPortfolio.value,
  };
};

export const computeTotalCollateralBalance = (
  balances: RawSpotBalance[],
  spotAssetCtxs: Record<string, FFastAssetCtx>,
  spotMeta: SpotMeta | null,
) =>
  computeSpotValue({
    balances,
    include: balance => SETTLEMENT_TOKEN_IDS.has(balance.token),
    spotAssetCtxs,
    spotMeta,
  });

export const computeLtvAdjustedPortfolioValue = (
  balances: RawSpotBalance[],
  spotAssetCtxs: Record<string, FFastAssetCtx>,
  spotMeta: SpotMeta | null,
) => {
  let value = ACCOUNT_ZERO;
  const unpricedNonZeroAssets: string[] = [];
  for (const balance of balances) {
    const weight = SETTLEMENT_TOKEN_IDS.has(balance.token)
      ? new BigNumber(1)
      : BigNumber.max(accountDecimal(balance.ltv), 0);
    const amount = accountDecimal(balance.total);
    if (weight.isZero() || amount.isZero()) {
      continue;
    }
    const price = resolveSpotUsdcPrice(balance.coin, spotAssetCtxs, spotMeta);
    if (!price) {
      unpricedNonZeroAssets.push(balance.coin);
      continue;
    }
    value = value.plus(amount.multipliedBy(price).multipliedBy(weight));
  }
  return { unpricedNonZeroAssets, value: value.toString() };
};
