import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import React from 'react';

import type { PerpsProHistoryRow } from '../types';
import { PerpsProFundingHistoryRowView } from './rows/PerpsProFundingHistoryRow';
import { PerpsProOrderHistoryRowView } from './rows/PerpsProOrderHistoryRow';
import { PerpsProTradeHistoryRowView } from './rows/PerpsProTradeHistoryRow';
import { PerpsProTransactionHistoryRowView } from './rows/PerpsProTransactionHistoryRow';

export const PerpsProHistoryRowView: React.FC<{
  active?: boolean;
  amountUnit: PerpsProTradeAmountUnit;
  onShowFeeExplanation: (isLiquidation: boolean) => void;
  row: PerpsProHistoryRow;
}> = React.memo(({ active = true, amountUnit, onShowFeeExplanation, row }) => {
  switch (row.kind) {
    case 'orders':
      return <PerpsProOrderHistoryRowView amountUnit={amountUnit} row={row} />;
    case 'trade':
      return (
        <PerpsProTradeHistoryRowView
          amountUnit={amountUnit}
          onShowFeeExplanation={onShowFeeExplanation}
          row={row}
        />
      );
    case 'transaction':
      return <PerpsProTransactionHistoryRowView active={active} row={row} />;
    case 'funding':
      return <PerpsProFundingHistoryRowView row={row} />;
  }
});

PerpsProHistoryRowView.displayName = 'PerpsProHistoryRowView';
