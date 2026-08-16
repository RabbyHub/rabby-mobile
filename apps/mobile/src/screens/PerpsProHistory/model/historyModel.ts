import type { SpotMeta } from '@rabby-wallet/hyperliquid-sdk';

import {
  COLLATERAL_TOKEN_TO_QUOTE,
  STABLE_COIN_INDEX_ID_MAP,
} from '@/constant/perps';
import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { buildPerpsProMarketDescriptor } from '@/screens/PerpsPro/model/market';

import type { PerpsProHistoryMarket, PerpsProHistoryRow } from '../types';

const fallbackDisplayBase = (coin: string) => {
  if (!coin.includes(':')) {
    return coin;
  }
  return coin.split(':')[1] || coin;
};

type SpotUniversePair = SpotMeta['universe'][number];

type HistorySpotMarketIndex = Readonly<{
  pairByIndex: ReadonlyMap<number, SpotUniversePair>;
  tokenByIndex: ReadonlyMap<number, SpotMeta['tokens'][number]>;
}>;

const historySpotMarketIndexCache = new WeakMap<
  SpotMeta,
  HistorySpotMarketIndex
>();

const getHistorySpotMarketIndex = (
  spotMeta: SpotMeta,
): HistorySpotMarketIndex => {
  const cached = historySpotMarketIndexCache.get(spotMeta);
  if (cached) {
    return cached;
  }
  const index = {
    pairByIndex: new Map(spotMeta.universe.map(pair => [pair.index, pair])),
    tokenByIndex: new Map(spotMeta.tokens.map(token => [token.index, token])),
  };
  historySpotMarketIndexCache.set(spotMeta, index);
  return index;
};

const stableSpotBaseByPairIndex = new Map<number, string>(
  Object.entries(STABLE_COIN_INDEX_ID_MAP)
    .filter(([asset]) => asset !== 'USDC')
    .map(([asset, index]) => [index, asset]),
);

const getSpotTokenDisplayName = (
  token: SpotMeta['tokens'][number] | undefined,
  tokenIndex: number,
) => COLLATERAL_TOKEN_TO_QUOTE[tokenIndex] ?? token?.name?.trim() ?? null;

const resolveSpotHistoryMarket = (
  coin: string,
  spotMeta: SpotMeta | null | undefined,
): PerpsProHistoryMarket | null => {
  const match = /^@(\d+)$/u.exec(coin);
  if (!match) {
    return null;
  }
  const pairIndex = Number(match[1]);
  if (!Number.isSafeInteger(pairIndex)) {
    return null;
  }

  if (spotMeta) {
    const index = getHistorySpotMarketIndex(spotMeta);
    const pair = index.pairByIndex.get(pairIndex);
    if (pair) {
      const baseTokenIndex = pair.tokens[0];
      const quoteTokenIndex = pair.tokens[1];
      const baseToken = index.tokenByIndex.get(baseTokenIndex);
      const quoteToken = index.tokenByIndex.get(quoteTokenIndex);
      const displayBase = getSpotTokenDisplayName(baseToken, baseTokenIndex);
      const quoteAsset = getSpotTokenDisplayName(quoteToken, quoteTokenIndex);
      if (displayBase && quoteAsset) {
        return {
          coin,
          displayBase,
          displayPair: `${displayBase}${quoteAsset}`,
          logoUrl: null,
          pxDecimals: null,
          quoteAsset,
          sourceTag: null,
          szDecimals: baseToken?.szDecimals ?? null,
        };
      }
    }
  }

  const stableBase = stableSpotBaseByPairIndex.get(pairIndex);
  if (!stableBase) {
    return null;
  }
  return {
    coin,
    displayBase: stableBase,
    displayPair: `${stableBase}USDC`,
    logoUrl: null,
    pxDecimals: null,
    quoteAsset: 'USDC',
    sourceTag: null,
    szDecimals: null,
  };
};

export const resolvePerpsProHistoryMarket = (
  coin: string,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
  spotMeta?: SpotMeta | null,
): PerpsProHistoryMarket => {
  const marketData = marketDataMap[coin];
  if (!marketData) {
    const spotMarket = resolveSpotHistoryMarket(coin, spotMeta);
    if (spotMarket) {
      return spotMarket;
    }
    const displayBase = fallbackDisplayBase(coin);
    const unresolvedSpotPair = /^@\d+$/u.test(coin);
    return {
      coin,
      displayBase,
      displayPair: unresolvedSpotPair ? coin : `${displayBase}USDC`,
      logoUrl: null,
      pxDecimals: null,
      quoteAsset: 'USDC',
      sourceTag: coin.includes(':') ? coin.split(':')[0] || null : null,
      szDecimals: null,
    };
  }

  const descriptor = buildPerpsProMarketDescriptor(marketData);
  return {
    coin,
    displayBase: descriptor.displayBase,
    displayPair: descriptor.displayPair,
    logoUrl: marketData.logoUrl || null,
    pxDecimals: marketData.pxDecimals,
    quoteAsset: descriptor.quoteAsset,
    sourceTag: descriptor.sourceTag,
    szDecimals: marketData.szDecimals,
  };
};

export const sortPerpsProHistoryRows = <Row extends PerpsProHistoryRow>(
  rows: readonly Row[],
): Row[] =>
  [...rows].sort(
    (left, right) =>
      right.time - left.time || left.key.localeCompare(right.key),
  );

export const mergePerpsProHistoryRows = <Row extends PerpsProHistoryRow>(
  incoming: readonly Row[],
  existing: readonly Row[],
  limit: number,
): Row[] => {
  const rowsByKey = new Map<string, Row>();
  existing.forEach(row => rowsByKey.set(row.key, row));
  incoming.forEach(row => rowsByKey.set(row.key, row));
  return sortPerpsProHistoryRows([...rowsByKey.values()]).slice(0, limit);
};
