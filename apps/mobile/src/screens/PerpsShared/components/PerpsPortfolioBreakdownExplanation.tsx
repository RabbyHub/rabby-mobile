import { Text } from '@/components/Typography';
import { usePerpsPortfolioBreakdown } from '@/hooks/perps/usePerpsPortfolioBreakdown';
import { useTheme2024 } from '@/hooks/theme';
import { useShowTipsPopup } from '@/hooks/useTipsPopup';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export const PerpsPortfolioBreakdownExplanationContent: React.FC<{
  desc: string;
  rows: { label: string; value: number }[];
}> = ({ desc, rows }) => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View
      style={styles.breakdownContainer}
      testID="perps-portfolio-breakdown-content">
      <Text style={styles.breakdownDesc}>{desc}</Text>
      <View style={styles.breakdownCard}>
        {rows.map(row => (
          <View key={row.label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{row.label}</Text>
            <Text style={styles.breakdownValue}>
              {formatUsdValue(row.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const useShowPerpsPortfolioBreakdown = () => {
  const { t } = useTranslation();
  const showTipsPopup = useShowTipsPopup();
  const { hasNonPerpsAssets, breakdownMode, getBreakdownValues } =
    usePerpsPortfolioBreakdown();

  const showPortfolioBreakdown = useMemoizedFn((portfolioValue: number) => {
    const { perpsValue, secondaryValue } = getBreakdownValues(portfolioValue);
    const titleKey = {
      manual: 'page.perps.PerpsCard.manualAccount',
      unified: 'page.perps.PerpsCard.unifiedAccount',
      portfolioMargin: 'page.perps.PerpsCard.portfolioMarginAccount',
    }[breakdownMode];
    const descKey = {
      manual: 'page.perps.PerpsCard.manualAccountDesc',
      unified: 'page.perps.PerpsCard.unifiedAccountDesc',
      portfolioMargin: 'page.perps.PerpsCard.portfolioMarginAccountDesc',
    }[breakdownMode];
    const secondaryLabelKey = {
      manual: 'page.perps.PerpsCard.breakdownSpot',
      unified: 'page.perps.PerpsCard.breakdownOtherAssets',
      portfolioMargin: 'page.perps.PerpsCard.breakdownNetOtherAssets',
    }[breakdownMode];

    showTipsPopup({
      title: t(titleKey),
      bgType: 'bg0',
      desc: (
        <PerpsPortfolioBreakdownExplanationContent
          desc={t(descKey)}
          rows={[
            {
              label: t('page.perps.PerpsCard.breakdownPerps'),
              value: perpsValue,
            },
            { label: t(secondaryLabelKey), value: secondaryValue },
          ]}
        />
      ),
      buttonType: 'hyperliquid',
    });
  });

  return { hasNonPerpsAssets, showPortfolioBreakdown };
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  breakdownContainer: {
    marginTop: 8,
    gap: 16,
  },
  breakdownDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  breakdownCard: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  breakdownLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  breakdownValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
