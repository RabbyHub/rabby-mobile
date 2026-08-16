import BigNumber from 'bignumber.js';

import type { SpotMeta } from '@rabby-wallet/hyperliquid-sdk';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

import type { PerpsProFundingFact, PerpsProFundingHistoryRow } from '../types';
import { resolvePerpsProHistoryMarket } from './historyModel';

const finiteDecimal = (value: unknown) => {
  const result = new BigNumber((value as string | number | undefined) ?? 0);
  return result.isFinite() ? result : new BigNumber(0);
};

const canonicalFundingDecimal = (value: string) => {
  const decimal = new BigNumber(value);
  return decimal.isFinite() ? decimal.toString() : value;
};

export const getPerpsProFundingHistoryKey = (fact: PerpsProFundingFact) => {
  const hash = fact.hash?.trim();
  if (hash && !/^0x0+$/iu.test(hash)) {
    return `hash:${hash.toLowerCase()}`;
  }
  return [
    'funding',
    fact.time,
    fact.coin,
    canonicalFundingDecimal(fact.szi),
    canonicalFundingDecimal(fact.usdc),
    canonicalFundingDecimal(fact.fundingRate),
  ].join(':');
};

export const mapPerpsProFundingHistoryFact = (
  fact: PerpsProFundingFact,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
  spotMeta?: SpotMeta | null,
): PerpsProFundingHistoryRow => {
  const positionSize = finiteDecimal(fact.szi);
  return {
    amount: finiteDecimal(fact.usdc).toString(),
    fundingRate: finiteDecimal(fact.fundingRate).toString(),
    hash: fact.hash || null,
    key: getPerpsProFundingHistoryKey(fact),
    kind: 'funding',
    market: resolvePerpsProHistoryMarket(fact.coin, marketDataMap, spotMeta),
    positionSide: positionSize.gte(0) ? 'long' : 'short',
    positionSize: positionSize.toString(),
    time: fact.time,
  };
};
