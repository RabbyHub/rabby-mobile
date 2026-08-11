import { formatPerpsProSignedDecimal } from '@/screens/PerpsPro/utils/format';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PerpsProFundingHistoryRow } from '../../types';
import { getPerpsProHistorySignedTone } from '../historyRowFormatters';
import { PerpsProHistoryRowLayout } from '../PerpsProHistoryRowPrimitives';

export const PerpsProFundingHistoryRowView: React.FC<{
  row: PerpsProFundingHistoryRow;
}> = ({ row }) => {
  const { t } = useTranslation();
  const isLong = row.positionSide === 'long';

  return (
    <PerpsProHistoryRowLayout
      badges={[
        {
          label: isLong
            ? t('page.perps.pro.history.long')
            : t('page.perps.pro.history.short'),
          tone: isLong ? 'positive' : 'negative',
        },
      ]}
      details={[
        {
          label: t('page.perps.pro.history.fields.symbol'),
          value: `${row.market.displayPair} ${t(
            'page.perps.pro.history.perpetual',
          )}`,
        },
        {
          label: t('page.perps.pro.history.fields.amount'),
          tone: getPerpsProHistorySignedTone(row.amount),
          value: formatPerpsProSignedDecimal(row.amount, 8),
        },
      ]}
      testID={`perps-pro-history-funding-${row.key}`}
      time={row.time}
      title={row.market.quoteAsset}
    />
  );
};
