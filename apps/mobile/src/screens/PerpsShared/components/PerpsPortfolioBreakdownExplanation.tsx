import { Text } from '@/components/Typography';
import { usePerpsPortfolioBreakdown } from '@/hooks/perps/usePerpsPortfolioBreakdown';
import { useTheme2024 } from '@/hooks/theme';
import { useHideTipsPopup, useShowTipsPopup } from '@/hooks/useTipsPopup';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useIsFocused } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

const TIPS_OWNER = 'perpsPortfolioBreakdown';

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
  const hideTipsPopup = useHideTipsPopup(TIPS_OWNER);
  const { hasNonPerpsAssets, breakdownMode, getBreakdownValues } =
    usePerpsPortfolioBreakdown();

  // The tips sheet lives on the global navigation layer — it does NOT go
  // away when this screen is popped (e.g. iOS edge-swipe back). Close our
  // own popup (owner-scoped) on blur and on unmount.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) {
      hideTipsPopup();
    }
    return () => hideTipsPopup();
  }, [isFocused, hideTipsPopup]);

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
      owner: TIPS_OWNER,
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
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
    // Light: white card on the sheet's gray bg-0 (Figma). Dark: bg-1 is
    // nearly identical to bg-0 and the card disappears — step up to bg-2.
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
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
