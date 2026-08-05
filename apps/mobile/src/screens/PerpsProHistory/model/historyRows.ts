import type { MarketData } from '@/hooks/perps/usePerpsStore';

import type {
  PerpsProFundingFact,
  PerpsProHistoryRow,
  PerpsProHistoryTab,
  PerpsProLedgerFact,
} from '../types';
import { mapPerpsProFundingHistoryFact } from './fundingHistory';
import { mapPerpsProOrderHistoryFact } from './orderHistory';
import { mapPerpsProTradeHistoryFact } from './tradeHistory';
import { mapPerpsProTransactionHistoryFact } from './transactionHistory';

export const mapPerpsProHistoryRawRows = (
  tab: PerpsProHistoryTab,
  rawItems: unknown[],
  address: string,
  marketDataMap: Readonly<Record<string, MarketData | undefined>>,
): PerpsProHistoryRow[] => {
  switch (tab) {
    case 'orders':
      return (
        rawItems as Parameters<typeof mapPerpsProOrderHistoryFact>[0][]
      ).map(item => mapPerpsProOrderHistoryFact(item, marketDataMap));
    case 'trade':
      return (
        rawItems as Parameters<typeof mapPerpsProTradeHistoryFact>[0][]
      ).map(item => mapPerpsProTradeHistoryFact(item, marketDataMap));
    case 'transaction':
      return (rawItems as PerpsProLedgerFact[]).flatMap(item => {
        const result = mapPerpsProTransactionHistoryFact(item, address);
        return result.row ? [result.row] : [];
      });
    case 'funding':
      return (rawItems as PerpsProFundingFact[]).map(item =>
        mapPerpsProFundingHistoryFact(item, marketDataMap),
      );
  }
};
