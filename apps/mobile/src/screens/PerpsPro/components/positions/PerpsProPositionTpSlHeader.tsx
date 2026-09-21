import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
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
import {
  PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
  resolvePerpsProDialogCardBackground,
} from '../common/perpsProDialogVisual';

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
  title?: string;
}> = React.memo(({ markPrice, market, position, variant, title }) => {
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
          {title ?? t('page.perps.pro.positions.tpsl')}
        </Text>
      ) : null}
      <View style={styles.card} testID="perps-pro-position-tpsl-header-card">
        <View
          style={styles.pairRow}
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
          style={styles.metrics}
          testID={`perps-pro-position-tpsl-metrics-${variant}`}>
          <Metric
            label={`${t('page.perps.pro.positions.entry')} (${
              market.quoteAsset
            })`}
            value={formatPerpsProPrice(position.entryPrice, market.pxDecimals)}
          />
          <Metric
            label={`${t('page.perps.pro.positions.mark')} (${
              market.quoteAsset
            })`}
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
    </View>
  );
});

PerpsProPositionTpSlHeader.displayName = 'PerpsProPositionTpSlHeader';

const Metric: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  pageHeader: {
    alignItems: 'center',
    height: 56,
    paddingBottom: 16,
    justifyContent: 'center',
    position: 'relative',
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: 40,
  },
  pageTitle: {
    ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    maxWidth: 260,
    textAlign: 'center',
  },
  mainHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  summaryHeader: { paddingHorizontal: 16 },
  mainTitle: {
    ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: resolvePerpsProDialogCardBackground(colors2024, isLight),
    borderRadius: 12,
    padding: 16,
  },
  pairRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 4 },
  pair: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  longTag: getPerpsProTintedTagContainerStyle(colors2024, 'positive'),
  shortTag: getPerpsProTintedTagContainerStyle(colors2024, 'negative'),
  longTagText: getPerpsProTintedTagTextStyle(colors2024, 'positive'),
  shortTagText: getPerpsProTintedTagTextStyle(colors2024, 'negative'),
  metrics: { gap: 10, marginTop: 10 },
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
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
}));
