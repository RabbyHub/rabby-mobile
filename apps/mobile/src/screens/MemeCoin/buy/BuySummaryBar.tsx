import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { MaxPriceImpactSelector } from '../components/MaxPriceImpactSelector';
import type { BuySummary, MaxPriceImpactPct } from '../ui/helpers';

export const BuySummaryBar = ({
  selectedTotalUsd,
  summary,
  maxPriceImpactPct,
  onMaxPriceImpactChange,
  confirmDisabled,
  onConfirm,
}: {
  selectedTotalUsd: number;
  summary: BuySummary;
  maxPriceImpactPct: MaxPriceImpactPct;
  onMaxPriceImpactChange: (value: MaxPriceImpactPct) => void;
  confirmDisabled: boolean;
  onConfirm: () => void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { safeOffBottom } = useSafeSizes();

  const summaryText =
    summary.kind === 'none'
      ? t('page.memeCoin.buy.needed', {
          amount: formatUsdValue(summary.neededUsd),
        })
      : summary.kind === 'short'
      ? t('page.memeCoin.buy.anotherNeeded', {
          amount: formatUsdValue(summary.shortfallUsd),
        })
      : t('page.memeCoin.buy.totalEstPayment', {
          amount: formatUsdValue(summary.totalPaymentUsd),
        });

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: getBottomButtonBottomOffset(safeOffBottom) },
      ]}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {t('page.memeCoin.buy.selectedTotal')}
        </Text>
        <View style={styles.totalRight}>
          <Text style={styles.totalValue}>
            {formatUsdValue(selectedTotalUsd)}
          </Text>
          <Text
            style={
              summary.kind === 'enough' ? styles.summaryOk : styles.summaryWarn
            }>
            {summaryText}
          </Text>
        </View>
      </View>
      <MaxPriceImpactSelector
        value={maxPriceImpactPct}
        onChange={onMaxPriceImpactChange}
      />
      <Button
        title={t('page.memeCoin.buy.confirm')}
        height={BOTTOM_BUTTON_SINGLE_HEIGHT}
        titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
        containerStyle={styles.ctaContainer}
        buttonStyle={styles.ctaButton}
        disabled={confirmDisabled}
        onPress={onConfirm}
        noShadow
        type="primary"
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  bar: {
    flexShrink: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    shadowColor: '#4B4E62',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  totalRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  totalValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  summaryOk: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['green-default'],
  },
  summaryWarn: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['red-default'],
  },
  ctaContainer: {
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
  },
  ctaButton: {
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    borderRadius: 12,
  },
}));
