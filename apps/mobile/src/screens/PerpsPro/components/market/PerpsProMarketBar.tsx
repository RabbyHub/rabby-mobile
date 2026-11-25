import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import RcCandlestick from '@/assets2024/icons/perps/PerpsProCandlestick.svg';
import RcMarketCaret from '@/assets2024/icons/perps/PerpsProMarketCaret.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { shallow } from 'zustand/shallow';
import {
  calculatePerpsProChange24h,
  type PerpsProMarketDescriptor,
} from '../../model/market';
import { selectPerpsProMarketData } from '../../scene/usePerpsProLiveMarket';
import { formatPerpsProPercent } from '../../utils/format';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
} from '../common/perpsProSemanticTagStyles';

export const PERPS_PRO_MARKET_BAR_HEIGHT = 40;

export const PerpsProMarketBar: React.FC<{
  market: PerpsProMarketDescriptor | null;
  onOpenKline: () => void;
  onPress: () => void;
}> = React.memo(({ market, onOpenKline, onPress }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [markPx, prevDayPx] = useActivityStore(
    perpsStore,
    state => {
      const data = selectPerpsProMarketData(state, market?.canonicalCoin ?? '');
      return [data?.markPx ?? '', data?.prevDayPx ?? ''] as const;
    },
    shallow,
  );
  const change24h = useMemo(
    () => calculatePerpsProChange24h({ markPx, prevDayPx }),
    [markPx, prevDayPx],
  );
  const changeStyle =
    change24h == null ? styles.muted : change24h >= 0 ? styles.up : styles.down;

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
          <View style={styles.source} testID="perps-pro-market-source-tag">
            <Text numberOfLines={1} style={styles.sourceText}>
              {market.sourceTag}
            </Text>
          </View>
        ) : null}
        <Text style={changeStyle}>{formatPerpsProPercent(change24h)}</Text>
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
    minWidth: 0,
  },
  pair: {
    flexShrink: 1,
    minWidth: 0,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  source: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    maxWidth: 52,
    overflow: 'hidden',
  },
  sourceText: {
    ...getPerpsProMetadataTagTextStyle(colors2024),
  },
  up: {
    ...PERPS_PRO_NUMBER_STYLE,
    flexShrink: 1,
    minWidth: 0,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  down: {
    ...PERPS_PRO_NUMBER_STYLE,
    flexShrink: 1,
    minWidth: 0,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  muted: {
    ...PERPS_PRO_NUMBER_STYLE,
    flexShrink: 1,
    minWidth: 0,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
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
