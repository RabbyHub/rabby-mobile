import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import {
  formatPerpsProDecimal,
  formatPerpsProPrice,
  isPerpsProStableAsset,
} from '@/screens/PerpsPro/utils/format';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PerpsProTradeHistoryRow } from '../../types';
import { formatPerpsProHistoryAssetAmount } from '../historyRowFormatters';
import { PerpsProHistoryRowLayout } from '../PerpsProHistoryRowPrimitives';

export const PerpsProTradeHistoryRowView: React.FC<{
  amountUnit: PerpsProTradeAmountUnit;
  onShowFeeExplanation: (isLiquidation: boolean) => void;
  row: PerpsProTradeHistoryRow;
}> = ({ amountUnit, onShowFeeExplanation, row }) => {
  const { t } = useTranslation();
  const isBase = amountUnit === 'base';
  const unit = isBase ? row.market.displayBase : row.market.quoteAsset;
  const filled = isBase ? row.filledBase : row.filledQuote;
  const decimals = isBase ? row.market.szDecimals ?? 8 : 2;
  const filledValue = isBase
    ? formatPerpsProHistoryAssetAmount(filled, unit, decimals)
    : formatPerpsProDecimal(filled, 2);
  const sideAccessibilityLabel =
    row.side === 'buy'
      ? t('page.perps.pro.history.buy')
      : t('page.perps.pro.history.sell');

  return (
    <PerpsProHistoryRowLayout
      details={[
        {
          label: t('page.perps.pro.history.fields.price'),
          value: formatPerpsProPrice(
            row.price,
            row.market.pxDecimals ?? undefined,
          ),
        },
        {
          label: `${t('page.perps.pro.history.fields.filled')} (${unit})`,
          value: filledValue,
        },
        {
          label: `${t('page.perps.pro.history.fields.fee')} (${row.feeToken})`,
          labelAccessibilityLabel: t('page.perps.historyDetail.feeTitle'),
          onLabelPress: () => onShowFeeExplanation(row.isLiquidation),
          value: formatPerpsProDecimal(
            row.fee,
            isPerpsProStableAsset(row.feeToken) ? 2 : 8,
          ),
        },
        {
          label: `${t('page.perps.pro.history.fields.realizedPnl')} (${
            row.market.quoteAsset
          })`,
          value: formatPerpsProDecimal(
            row.netRealizedPnl,
            isPerpsProStableAsset(row.market.quoteAsset) ? 2 : 8,
          ),
        },
      ]}
      side={row.side}
      sideAccessibilityLabel={sideAccessibilityLabel}
      sourceTag={row.market.sourceTag}
      testID={`perps-pro-history-trade-${row.key}`}
      time={row.time}
      title={row.market.displayPair}
    />
  );
};
