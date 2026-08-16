import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
} from '@/screens/PerpsPro/utils/format';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PerpsProOrderHistoryRow } from '../../types';
import {
  formatPerpsProHistoryAssetAmount,
  titleCasePerpsProHistoryValue,
} from '../historyRowFormatters';
import { PerpsProHistoryRowLayout } from '../PerpsProHistoryRowPrimitives';

const getOrderTypeLabel = (row: PerpsProOrderHistoryRow) => {
  const type = titleCasePerpsProHistoryValue(row.orderType);
  if (!row.isTrigger) {
    return type;
  }
  return `${row.priceKind === 'market' ? 'Market' : 'Limit'} (Triggered)`;
};

export const PerpsProOrderHistoryRowView: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  row: PerpsProOrderHistoryRow;
}> = ({ amountUnit, row }) => {
  const { t } = useTranslation();
  const isBase = amountUnit === 'base';
  const unit = isBase ? row.market.displayBase : row.market.quoteAsset;
  const amount = isBase ? row.amountBase : row.amountQuote;
  const filled = isBase ? row.filledBase : row.filledQuote;
  const decimals = isBase ? row.market.szDecimals ?? 8 : 2;
  const formatAmount = (value: string | null) =>
    isBase
      ? formatPerpsProHistoryAssetAmount(value, unit, decimals)
      : formatPerpsProDecimal(value, 2);
  const sideLabel =
    row.side === 'buy'
      ? t('page.perps.pro.history.buy')
      : t('page.perps.pro.history.sell');
  const sideTone = row.side === 'buy' ? 'positive' : 'negative';
  const status = titleCasePerpsProHistoryValue(row.status);
  const statusTone =
    row.status.toLowerCase() === 'filled' ? 'positive' : 'info';
  const orderPrice =
    row.priceKind === 'market'
      ? t('page.perps.pro.history.market')
      : formatPerpsProPrice(row.price, row.market.pxDecimals ?? undefined);
  const executionPrice = row.executionPrice
    ? formatPerpsProPrice(
        row.executionPrice,
        row.market.pxDecimals ?? undefined,
      )
    : '--';
  const details = [
    {
      label: `${t('page.perps.pro.history.fields.amount')} (${unit})`,
      value: `${formatAmount(filled)}/${formatAmount(amount)}`,
    },
    {
      label: t('page.perps.pro.history.fields.price'),
      value: `${executionPrice} / ${orderPrice}`,
    },
    ...(row.reduceOnly
      ? [
          {
            label: t('page.perps.pro.history.fields.reduceOnly'),
            value: t('page.perps.pro.history.true'),
          },
        ]
      : []),
    {
      label: t('page.perps.pro.history.fields.status'),
      tone: statusTone as 'info' | 'positive',
      value: status,
    },
  ];

  return (
    <PerpsProHistoryRowLayout
      badges={[
        { label: getOrderTypeLabel(row), tone: sideTone },
        { label: sideLabel, tone: sideTone },
      ]}
      details={details}
      sourceTag={row.market.sourceTag}
      testID={`perps-pro-history-order-${row.key}`}
      time={row.time}
      title={row.market.displayPair}
    />
  );
};
