import { RcIconLong, RcIconShort } from '@/assets2024/icons/perps';
import { MarketData, PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

export const PerpsPositionItem: React.FC<{
  item: PositionAndOpenOrder['position'];
  marketData: MarketData;
  onPress?(): void;
}> = ({ item, marketData, onPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const {
    coin,
    szi,
    leverage,
    positionValue,
    marginUsed,
    unrealizedPnl,
    returnOnEquity,
    liquidationPx,
    entryPx,
  } = item;
  const isUp = Number(unrealizedPnl) >= 0;

  const sign = isUp ? '+' : '-';
  const side =
    Number(liquidationPx || 0) < Number(entryPx || 0) ? 'Long' : 'Short';
  const absPnlUsd = Math.abs(Number(unrealizedPnl));
  const absPnlPct = Math.abs(Number(returnOnEquity));
  const pnlText = `${sign}${formatUsdValue(absPnlUsd)} (${sign}${formatPct(
    absPnlPct,
  )})`;
  const logoUrl = marketData?.logoUrl || '';
  const leverageText = `${leverage.value}x`;

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <FastImage source={{ uri: logoUrl }} style={styles.icon} />
          {side === 'Long' ? (
            <RcIconLong
              style={styles.directionIcon}
              bgColor={colors2024['neutral-bg-1']}
              color={colors2024['neutral-title-1']}
            />
          ) : side === 'Short' ? (
            <RcIconShort
              style={styles.directionIcon}
              bgColor={colors2024['neutral-bg-1']}
              color={colors2024['neutral-title-1']}
            />
          ) : null}
        </View>
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.name}> {coin} - USD</Text>
            <Text style={styles.price}>
              ${splitNumberByStep(Number(marginUsed).toFixed(2))}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.leverage}>
              {side} {leverageText}
            </Text>
            <Text
              style={[
                styles.priceChange,
                isUp ? null : styles.priceChangeDown,
              ]}>
              {pnlText}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  directionIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 1000,
  },
  content: {
    flex: 1,

    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  leverage: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  priceChange: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['green-default'],
  },
  priceChangeDown: {
    color: colors2024['red-default'],
  },
}));
