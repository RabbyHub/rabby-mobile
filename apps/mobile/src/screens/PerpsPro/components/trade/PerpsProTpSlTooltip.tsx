import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type {
  PerpsProEvaluatedTpSlLeg,
  PerpsProTpSlMode,
} from '../../model/tpsl';
import { formatPerpsProDecimal, formatPerpsProPrice } from '../../utils/format';

const signed = (value: string) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number > 0 ? '+' : ''}${formatPerpsProDecimal(number, 2)}`;
};

export const PerpsProTpSlTooltip: React.FC<{
  buy: PerpsProEvaluatedTpSlLeg;
  mode: PerpsProTpSlMode;
  pxDecimals: number;
  quoteAsset: string;
  sell: PerpsProEvaluatedTpSlLeg;
}> = React.memo(({ buy, mode, pxDecimals, quoteAsset, sell }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const value = (leg: PerpsProEvaluatedTpSlLeg) =>
    mode === 'price'
      ? `${signed(leg.estimatedPnl)} ${quoteAsset} / ${signed(
          leg.estimatedRoi,
        )}%`
      : `${formatPerpsProPrice(leg.triggerPrice, pxDecimals)} ${quoteAsset}`;
  return (
    <View style={styles.tooltip} testID="perps-pro-tpsl-tooltip">
      <View style={styles.row}>
        <Text style={styles.label}>{t('page.perps.pro.trade.buyLong')}</Text>
        <Text numberOfLines={1} style={styles.value}>
          {value(buy)}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{t('page.perps.pro.trade.sellShort')}</Text>
        <Text numberOfLines={1} style={styles.value}>
          {value(sell)}
        </Text>
      </View>
    </View>
  );
});

PerpsProTpSlTooltip.displayName = 'PerpsProTpSlTooltip';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tooltip: {
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 6,
    bottom: 47,
    gap: 3,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: 'absolute',
    right: 0,
    zIndex: 4,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  label: {
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro',
    fontSize: 9,
    lineHeight: 12,
  },
  value: {
    color: colors2024['neutral-bg-1'],
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 12,
    textAlign: 'right',
  },
}));
