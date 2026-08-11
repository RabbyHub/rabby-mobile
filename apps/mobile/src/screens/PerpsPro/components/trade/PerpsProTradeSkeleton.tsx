import RcIconAvailableAdd from '@/assets2024/icons/perps/PerpsProAvailableAdd.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PERPS_PRO_MAIN_COLUMN_HEIGHT } from '../../model/layout';
import { PerpsProTradeAmountField } from './PerpsProTradeAmountField';
import { PerpsProTradeAmountSlider } from './PerpsProTradeAmountSlider';
import {
  PerpsProTradeButton,
  PerpsProTradeCheckbox,
  PerpsProTradeSelect,
  PerpsProTradeSummaryRow,
} from './PerpsProTradePrimitives';

export const PerpsProTradeSkeleton: React.FC<{
  leverage?: number;
  marginMode?: 'cross' | 'isolated';
  quoteAsset: string;
}> = React.memo(({ leverage = 1, marginMode = 'isolated', quoteAsset }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('page.perps.pro.trade.disabledFrame')}
      accessibilityState={{ disabled: true }}
      style={styles.container}
      testID="perps-pro-trade-skeleton">
      <View style={styles.inputGroup} testID="perps-pro-trade-input-group">
        <View style={styles.doubleRow}>
          <PerpsProTradeSelect
            label={
              marginMode === 'cross'
                ? t('page.perps.pro.positions.cross')
                : t('page.perps.pro.trade.isolated')
            }
            showCaret={false}
            style={styles.flexItem}
          />
          <PerpsProTradeSelect
            label={`${Math.max(1, leverage)}x`}
            showCaret={false}
            style={styles.flexItem}
          />
        </View>
        <PerpsProTradeSelect label={t('page.perps.pro.trade.market')} />
        <PerpsProTradeAmountField
          label={`${t('page.perps.pro.trade.amount')}(${quoteAsset})`}
          maxDecimals={2}
          unit={quoteAsset}
        />
        <PerpsProTradeAmountSlider />
      </View>
      <View style={styles.optionsGroup} testID="perps-pro-trade-options-group">
        <PerpsProTradeSummaryRow
          label={t('page.perps.pro.trade.available')}
          trailing={
            <RcIconAvailableAdd
              color={colors2024['neutral-title-1']}
              height={16}
              testID="perps-pro-trade-available-add"
              width={16}
            />
          }
          value={`- ${quoteAsset}`}
        />
        <PerpsProTradeCheckbox label="TP/SL" />
        <PerpsProTradeCheckbox label={t('page.perps.pro.trade.reduceOnly')} />
      </View>
      <View style={styles.orderGroups} testID="perps-pro-trade-order-groups">
        <View style={styles.orderGroup}>
          <View style={styles.orderSummary}>
            <PerpsProTradeSummaryRow
              label={t('page.perps.pro.trade.max')}
              value={`- ${quoteAsset}`}
            />
            <PerpsProTradeSummaryRow
              dottedLabel
              label={t('page.perps.pro.trade.cost')}
              value={`- ${quoteAsset}`}
            />
          </View>
          <PerpsProTradeButton
            label={t('page.perps.pro.trade.buyLong')}
            side="buy"
          />
        </View>
        <View style={styles.orderGroup}>
          <View style={styles.orderSummary}>
            <PerpsProTradeSummaryRow
              label={t('page.perps.pro.trade.max')}
              value={`- ${quoteAsset}`}
            />
            <PerpsProTradeSummaryRow
              dottedLabel
              label={t('page.perps.pro.trade.cost')}
              value={`- ${quoteAsset}`}
            />
          </View>
          <PerpsProTradeButton
            label={t('page.perps.pro.trade.sellShort')}
            side="sell"
          />
        </View>
      </View>
    </View>
  );
});

PerpsProTradeSkeleton.displayName = 'PerpsProTradeSkeleton';

const getStyle = createGetStyles2024(() => ({
  container: {
    gap: 16,
    height: PERPS_PRO_MAIN_COLUMN_HEIGHT,
  },
  inputGroup: {
    gap: 8,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flexItem: {
    flex: 1,
    minWidth: 0,
  },
  optionsGroup: {
    gap: 8,
  },
  orderGroups: {
    gap: 16,
  },
  orderGroup: {
    gap: 8,
  },
  orderSummary: {
    gap: 4,
  },
}));
