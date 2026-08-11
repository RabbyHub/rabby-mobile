import { formatPerpsProSignedDecimal } from '@/screens/PerpsPro/utils/format';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PerpsProTransactionHistoryRow } from '../../types';
import { PerpsProHistoryRowLayout } from '../PerpsProHistoryRowPrimitives';

export const PerpsProTransactionHistoryRowView: React.FC<{
  row: PerpsProTransactionHistoryRow;
}> = ({ row }) => {
  const { t } = useTranslation();
  const isDeposit = row.direction === 'deposit';
  const type = isDeposit
    ? t('page.perps.pro.history.deposit')
    : t('page.perps.pro.history.withdraw');
  const signedAmount = isDeposit ? row.amount : `-${row.amount}`;

  return (
    <PerpsProHistoryRowLayout
      details={[
        {
          label: t('page.perps.pro.history.fields.type'),
          value: type,
        },
        {
          label: t('page.perps.pro.history.fields.amount'),
          tone: isDeposit ? 'positive' : 'negative',
          value: formatPerpsProSignedDecimal(signedAmount, 8),
        },
      ]}
      testID={`perps-pro-history-transaction-${row.key}`}
      time={row.time}
      title={row.asset}
    />
  );
};
