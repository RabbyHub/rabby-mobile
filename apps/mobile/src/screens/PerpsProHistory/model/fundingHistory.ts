import BigNumber from 'bignumber.js';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

import type { PerpsProFundingFact, PerpsProFundingHistoryRow } from '../types';
import { resolvePerpsProHistoryMarket } from './historyModel';

const finiteDecimal = (value: unknown) => {
  const result = new BigNumber((value as string | number | undefined) ?? 0);
  return result.isFinite() ? result : new BigNumber(0);
};

export const getPerpsProFundingHistoryKey = (fact: PerpsProFundingFact) =>
  fact.hash ||
  `${fact.time}:${fact.coin}:${fact.szi}:${fact.usdc}:${fact.fundingRate}`;

export const mapPerpsProFundingHistoryFact = (
  fact: PerpsProFundingFact,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
): PerpsProFundingHistoryRow => {
  const positionSize = finiteDecimal(fact.szi);
  return {
    amount: finiteDecimal(fact.usdc).toString(),
    fundingRate: finiteDecimal(fact.fundingRate).toString(),
    hash: fact.hash || null,
    key: getPerpsProFundingHistoryKey(fact),
    kind: 'funding',
    market: resolvePerpsProHistoryMarket(fact.coin, marketDataMap),
    positionSide: positionSize.gte(0) ? 'long' : 'short',
    positionSize: positionSize.toString(),
    time: fact.time,
  };
};
