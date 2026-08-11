import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import React from 'react';

import type { PerpsProHistoryRow } from '../types';
import { PerpsProFundingHistoryRowView } from './rows/PerpsProFundingHistoryRow';
import { PerpsProOrderHistoryRowView } from './rows/PerpsProOrderHistoryRow';
import { PerpsProTradeHistoryRowView } from './rows/PerpsProTradeHistoryRow';
import { PerpsProTransactionHistoryRowView } from './rows/PerpsProTransactionHistoryRow';

export const PerpsProHistoryRowView: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  row: PerpsProHistoryRow;
}> = React.memo(({ amountUnit, row }) => {
  switch (row.kind) {
    case 'orders':
      return <PerpsProOrderHistoryRowView amountUnit={amountUnit} row={row} />;
    case 'trade':
      return <PerpsProTradeHistoryRowView amountUnit={amountUnit} row={row} />;
    case 'transaction':
      return <PerpsProTransactionHistoryRowView row={row} />;
    case 'funding':
      return <PerpsProFundingHistoryRowView row={row} />;
  }
});

PerpsProHistoryRowView.displayName = 'PerpsProHistoryRowView';
