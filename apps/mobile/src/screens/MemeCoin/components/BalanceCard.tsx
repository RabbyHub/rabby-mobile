import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import RcBalanceGlow from '@/assets2024/memecoin/balance-glow.svg';
import RcBalanceGlowDark from '@/assets2024/memecoin/balance-glow-dark.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import type { MemePnl, MemePnlPeriod } from '../data/types';
import {
  formatMemeBalanceUsd,
  formatMemePnlUsd,
  isFlatMemePnl,
} from '../ui/formatBalance';
import { MEME_PNL_CURVE_WIDTH, MemePnlCurve } from './MemePnlCurve';

const GRADIENT_END_LIGHT = '#FEFAED';
const GRADIENT_END_DARK = '#1F1D17';
const TAB_WIDTH = 40;
const TABS_PADDING = 2;
const TABS_WIDTH = TAB_WIDTH * 2 + TABS_PADDING * 2;
const CARD_INSET = 16;
// the total shrinks to stay this far from the tabs
const VALUE_TABS_GAP = 16;
const VALUE_MIN_FONT_SCALE = 0.5;

const PERIOD_LABEL_KEYS: Record<MemePnlPeriod, string> = {
  '24h': 'page.memeCoin.pnlPeriod24h',
  all: 'page.memeCoin.pnlPeriodAll',
};
const PERIODS: MemePnlPeriod[] = ['24h', 'all'];

export const BalanceCard = React.memo(function BalanceCard({
  totalUsd,
  loading,
  pnl,
}: {
  /** null when holdings could not be loaded */
  totalUsd: number | null;
  loading: boolean;
  /** undefined until the P&L has loaded */
  pnl?: MemePnl;
}) {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const [period, setPeriod] = useState<MemePnlPeriod>('24h');

  const current = pnl?.periods[period];
  const isLoss = !!current && current.totalUsd < 0;
  const isFlat = !!current && isFlatMemePnl(current.totalUsd);

  return (
    <View style={styles.card}>
      {/* Keep border and padding off the legacy gradient: under Fabric it
          forwards them to both its interop wrapper and its inset Paper view. */}
      <View pointerEvents="none" style={styles.background}>
        <LinearGradient
          colors={
            isLight
              ? [colors2024['neutral-card-1'], GRADIENT_END_LIGHT]
              : [colors2024['neutral-bg-2'], GRADIENT_END_DARK]
          }
          locations={[0.4, 0.98]}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        {isLight ? (
          <RcBalanceGlow style={styles.glow} />
        ) : (
          <RcBalanceGlowDark style={styles.glow} />
        )}
      </View>
      {loading ? (
        <Skeleton width={140} height={36} style={styles.valueSkeleton} />
      ) : (
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={VALUE_MIN_FONT_SCALE}>
          {totalUsd === null ? '--' : formatMemeBalanceUsd(totalUsd)}
        </Text>
      )}
      <View style={styles.pnlRow}>
        <Text
          numberOfLines={1}
          style={[
            styles.pnlValue,
            !current || isFlat
              ? styles.pnlNone
              : isLoss
              ? styles.pnlDown
              : styles.pnlUp,
          ]}>
          {!current
            ? '--'
            : isFlat
            ? '$0.00'
            : formatMemePnlUsd(current.totalUsd)}
        </Text>
        <Text style={styles.pnlLabel}>{t(PERIOD_LABEL_KEYS[period])}</Text>
      </View>
      <View style={styles.tabs}>
        {PERIODS.map(item => (
          <TouchableOpacity
            key={item}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => setPeriod(item)}
            style={[styles.tab, item === period && styles.tabActive]}>
            <Text
              style={[styles.tabText, item === period && styles.tabTextActive]}>
              {t(PERIOD_LABEL_KEYS[item])}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* after the tabs, so the cursor tooltip paints over them */}
      {current ? (
        <View style={styles.curve}>
          <MemePnlCurve
            key={period}
            points={current.points}
            color={colors2024[isLoss ? 'red-default' : 'green-default']}
          />
        </View>
      ) : null}
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    height: 120,
    // padding includes the background layer's 2px border
    paddingTop: 20,
    paddingHorizontal: CARD_INSET,
    shadowColor: isLight ? '#777B98' : '#6F759F',
    shadowOpacity: isLight ? 0.06 : 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    left: -63,
    top: 30,
  },
  curve: {
    position: 'absolute',
    top: 52,
    right: CARD_INSET,
  },
  value: {
    marginRight: TABS_WIDTH + VALUE_TABS_GAP,
    fontFamily: 'SF Pro Rounded',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  valueSkeleton: {
    borderRadius: 8,
  },
  pnlRow: {
    marginTop: 10,
    marginRight: MEME_PNL_CURVE_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pnlValue: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  pnlUp: {
    color: colors2024['green-default'],
  },
  pnlDown: {
    color: colors2024['red-default'],
  },
  pnlNone: {
    color: colors2024['neutral-secondary'],
  },
  pnlLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  tabs: {
    position: 'absolute',
    top: 16,
    right: CARD_INSET,
    flexDirection: 'row',
    padding: TABS_PADDING,
    borderRadius: 6,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  tab: {
    width: TAB_WIDTH,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: isLight ? '#2F3135' : '#E0E5EC',
  },
  tabText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
  },
  tabTextActive: {
    color: isLight ? '#F7FAFC' : '#192945',
  },
}));
