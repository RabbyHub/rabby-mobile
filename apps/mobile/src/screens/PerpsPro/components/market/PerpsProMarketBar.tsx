import RcCandlestick from '@/assets2024/icons/perps/PerpsProCandlestick.svg';
import RcMarketCaret from '@/assets2024/icons/perps/PerpsProMarketCaret.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProMarket } from '../../model/market';
import { formatPerpsProPercent } from '../../utils/format';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
} from '../common/perpsProSemanticTagStyles';

export const PERPS_PRO_MARKET_BAR_HEIGHT = 40;

export const PerpsProMarketBar: React.FC<{
  market: PerpsProMarket | null;
  onOpenKline: () => void;
  onPress: () => void;
}> = React.memo(({ market, onOpenKline, onPress }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const changeStyle =
    market?.change24h == null
      ? styles.muted
      : market.change24h >= 0
      ? styles.up
      : styles.down;

  return (
    <View style={styles.container} testID="perps-pro-market-bar">
      <Pressable
        accessibilityLabel={t('page.perps.pro.marketSelector.title')}
        accessibilityRole="button"
        disabled={!market}
        onPress={onPress}
        style={styles.marketPressable}
        testID="perps-pro-market-selector-trigger">
        <Text numberOfLines={1} style={styles.pair}>
          {market?.displayPair ?? '-'}
        </Text>
        {market?.sourceTag ? (
          <Text numberOfLines={1} style={styles.source}>
            {market.sourceTag}
          </Text>
        ) : null}
        <Text style={changeStyle}>
          {formatPerpsProPercent(market?.change24h)}
        </Text>
        <RcMarketCaret
          color={colors2024['neutral-title-1']}
          height={18}
          width={18}
        />
      </Pressable>
      <View style={styles.actions} testID="perps-pro-market-actions">
        <Pressable
          accessibilityLabel={t('page.perps.pro.chart.open')}
          accessibilityRole="button"
          accessibilityState={{ disabled: !market }}
          disabled={!market}
          hitSlop={6}
          onPress={onOpenKline}
          style={styles.actionIcon}
          testID="perps-pro-kline-trigger">
          <RcCandlestick
            color={colors2024['neutral-title-1']}
            height={20}
            width={14}
          />
        </Pressable>
      </View>
    </View>
  );
});

PerpsProMarketBar.displayName = 'PerpsProMarketBar';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    flexDirection: 'row',
    height: PERPS_PRO_MARKET_BAR_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  marketPressable: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: '100%',
  },
  pair: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  source: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    ...getPerpsProMetadataTagTextStyle(colors2024),
    maxWidth: 52,
  },
  up: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  down: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  muted: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  actionIcon: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
}));
