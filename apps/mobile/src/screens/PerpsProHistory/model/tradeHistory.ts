import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';

import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { getFillKey } from '@/hooks/perps/userFills';

import type { PerpsProTradeHistoryRow } from '../types';
import { resolvePerpsProHistoryMarket } from './historyModel';

const finiteDecimal = (value: unknown) => {
  const result = new BigNumber((value as string | number | undefined) ?? 0);
  return result.isFinite() ? result : new BigNumber(0);
};

export const mapPerpsProTradeHistoryFact = (
  fill: WsFill,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
): PerpsProTradeHistoryRow => {
  const price = finiteDecimal(fill.px);
  const size = BigNumber.max(finiteDecimal(fill.sz), 0);
  const fee = finiteDecimal(fill.fee);
  const closedPnl = finiteDecimal(fill.closedPnl);
  const feeToken = (fill as WsFill & { feeToken?: string }).feeToken;

  return {
    direction: fill.dir || (fill.side === 'B' ? 'Buy' : 'Sell'),
    fee: fee.toString(),
    feeToken: feeToken || 'USDC',
    filledBase: size.toString(),
    filledQuote: price.multipliedBy(size).toString(),
    hash: fill.hash,
    isLiquidation: Boolean(fill.liquidation),
    key: getFillKey(fill),
    kind: 'trade',
    market: resolvePerpsProHistoryMarket(fill.coin, marketDataMap),
    netRealizedPnl: closedPnl.minus(fee).toString(),
    oid: fill.oid,
    price: price.toString(),
    side: fill.side === 'B' ? 'buy' : 'sell',
    tid: fill.tid,
    time: fill.time,
  };
};
