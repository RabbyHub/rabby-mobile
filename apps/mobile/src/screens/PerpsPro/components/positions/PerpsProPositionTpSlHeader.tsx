import RcIconBack from '@/assets/icons/header/back-cc.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlMarketSnapshot } from '../../model/positionTpSl';
import { formatPerpsProPrice } from '../../utils/format';
import {
  getPerpsProTintedTagContainerStyle,
  getPerpsProTintedTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import { PerpsProCloseMarketTag } from './PerpsProCloseMarketTag';

export const PerpsProPositionTpSlPageHeader: React.FC<{
  onBack: () => void;
  title: string;
}> = React.memo(({ onBack, title }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.pageHeader}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={styles.backButton}
        testID="perps-pro-position-tpsl-back">
        <RcIconBack
          color={colors2024['neutral-title-1']}
          height={24}
          width={24}
        />
      </Pressable>
      <Text numberOfLines={1} style={styles.pageTitle}>
        {title}
      </Text>
    </View>
  );
});

PerpsProPositionTpSlPageHeader.displayName = 'PerpsProPositionTpSlPageHeader';

export const PerpsProPositionTpSlHeader: React.FC<{
  markPrice: string | null;
  market: PerpsPositionTpSlMarketSnapshot;
  position: PerpsPositionViewModel;
  variant: 'empty' | 'main' | 'summary';
}> = React.memo(({ markPrice, market, position, variant }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isLong = position.direction === 'long';

  return (
    <View
      style={
        variant === 'main'
          ? styles.mainHeader
          : variant === 'empty'
          ? styles.emptyHeader
          : styles.summaryHeader
      }
      testID={`perps-pro-position-tpsl-header-${variant}`}>
      {variant !== 'summary' ? (
        <Text style={styles.mainTitle}>
          {t('page.perps.pro.positions.tpsl')}
        </Text>
      ) : null}
      <View
        style={
          variant === 'summary' ? styles.summaryPairRow : styles.mainPairRow
        }
        testID={`perps-pro-position-tpsl-pair-${variant}`}>
        <Text style={styles.pair}>{market.displayPair}</Text>
        <PerpsProCloseMarketTag sourceTag={market.sourceTag} />
        <View
          style={isLong ? styles.longTag : styles.shortTag}
          testID={`perps-pro-position-tpsl-direction-${variant}`}>
          <Text style={isLong ? styles.longTagText : styles.shortTagText}>
            {t(`page.perps.pro.positions.${position.direction}`)}{' '}
            {position.leverage}x
          </Text>
        </View>
      </View>
      <View
        style={
          variant === 'main'
            ? styles.mainMetrics
            : variant === 'empty'
            ? styles.emptyMetrics
            : styles.summaryMetrics
        }
        testID={`perps-pro-position-tpsl-metrics-${variant}`}>
        <Metric
          label={`${t('page.perps.pro.positions.entry')} (${
            market.quoteAsset
          })`}
          rounded
          value={formatPerpsProPrice(position.entryPrice, market.pxDecimals)}
        />
        <Metric
          label={`${t('page.perps.pro.positions.mark')} (${market.quoteAsset})`}
          value={formatPerpsProPrice(markPrice, market.pxDecimals)}
        />
        <Metric
          label={`${t('page.perps.pro.positionTpsl.estimatedLiquidation')} (${
            market.quoteAsset
          })`}
          value={formatPerpsProPrice(
            position.liquidationPrice,
            market.pxDecimals,
          )}
        />
      </View>
    </View>
  );
});

PerpsProPositionTpSlHeader.displayName = 'PerpsProPositionTpSlHeader';

const Metric: React.FC<{ label: string; rounded?: boolean; value: string }> = ({
  label,
  rounded = false,
  value,
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.metricValue, rounded && styles.roundedMetricValue]}>
        {value}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  pageHeader: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    position: 'relative',
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 8,
    width: 40,
  },
  pageTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    maxWidth: 260,
    textAlign: 'center',
  },
  mainHeader: {
    height: 146,
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  emptyHeader: {
    height: 146,
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  summaryHeader: {
    height: 114,
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  mainTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  mainPairRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 12,
  },
  summaryPairRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  pair: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  longTag: getPerpsProTintedTagContainerStyle(colors2024, 'positive'),
  shortTag: getPerpsProTintedTagContainerStyle(colors2024, 'negative'),
  longTagText: getPerpsProTintedTagTextStyle(colors2024, 'positive'),
  shortTagText: getPerpsProTintedTagTextStyle(colors2024, 'negative'),
  mainMetrics: { gap: 8, marginTop: 16 },
  emptyMetrics: { gap: 8, marginTop: 16 },
  summaryMetrics: { gap: 8, marginTop: 16 },
  metric: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 16,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  metricLabel: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  roundedMetricValue: { fontFamily: 'SF Pro' },
}));
