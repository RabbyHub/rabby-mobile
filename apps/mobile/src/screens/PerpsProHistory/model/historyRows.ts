import type { SpotMeta } from '@rabby-wallet/hyperliquid-sdk';

import type { MarketData } from '@/hooks/perps/usePerpsStore';

import type {
  PerpsProFundingFact,
  PerpsProHistoryRow,
  PerpsProHistoryTab,
  PerpsProLedgerFact,
} from '../types';
import { mapPerpsProFundingHistoryFact } from './fundingHistory';
import { mapPerpsProOrderHistoryFact } from './orderHistory';
import type { PerpsProOrderExecutionIndex } from './orderExecution';
import { mapPerpsProTradeHistoryFact } from './tradeHistory';
import { mapPerpsProTransactionHistoryFact } from './transactionHistory';

export const mapPerpsProHistoryRawRows = (
  tab: PerpsProHistoryTab,
  rawItems: unknown[],
  address: string,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
  orderExecutionIndex: PerpsProOrderExecutionIndex = new Map(),
  spotMeta?: SpotMeta | null,
): PerpsProHistoryRow[] => {
  switch (tab) {
    case 'orders':
      return (
        rawItems as Parameters<typeof mapPerpsProOrderHistoryFact>[0][]
      ).map(item =>
        mapPerpsProOrderHistoryFact(
          item,
          marketDataMap,
          orderExecutionIndex,
          spotMeta,
        ),
      );
    case 'trade':
      return (
        rawItems as Parameters<typeof mapPerpsProTradeHistoryFact>[0][]
      ).map(item => mapPerpsProTradeHistoryFact(item, marketDataMap, spotMeta));
    case 'transaction':
      return (rawItems as PerpsProLedgerFact[]).flatMap(item => {
        const result = mapPerpsProTransactionHistoryFact(item, address);
        return result.row ? [result.row] : [];
      });
    case 'funding':
      return (rawItems as PerpsProFundingFact[]).map(item =>
        mapPerpsProFundingHistoryFact(item, marketDataMap, spotMeta),
      );
  }
};
