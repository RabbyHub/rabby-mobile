import { AssetAvatar } from '@/components';
import { MarketData, PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';
import { FavoriteTag } from '@/components2024/Favorite';
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

export const PerpsMarketItem: React.FC<{
  item: MarketData;
  isFavorite?: boolean;
  hasPosition?: boolean;
  onPress?(): void;
}> = ({ item, onPress, hasPosition, isFavorite }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const isUp = Number(item.markPx) - Number(item.prevDayPx) > 0;
  const absPnlUsd = Math.abs(Number(item.markPx) - Number(item.prevDayPx));
  const absPnlPct = Math.abs(absPnlUsd / Number(item.prevDayPx));
  const pnlText = `${isUp ? '+' : '-'}${formatPct(absPnlPct)}`;

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.card}>
        <AssetAvatar logo={item.logoUrl} logoStyle={styles.icon} size={46} />
        <View style={styles.content}>
          <View style={styles.row}>
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{item.name}</Text>
              {hasPosition && (
                <View style={styles.positionContainer}>
                  <Text style={styles.positionText}>1 Position</Text>
                </View>
              )}
            </View>
            <Text style={styles.price}>
              {`$${splitNumberByStep(item.markPx)}`}
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.infoContainer}>
              <View style={styles.leverageContainer}>
                <Text style={styles.leverage}>{item.maxLeverage}x</Text>
              </View>
              <Text style={styles.volText}>
                VOL: {formatUsdValueKMB(item.dayNtlVlm || 0)}
              </Text>
            </View>
            <Text
              style={[
                styles.priceChange,
                isUp ? null : styles.priceChangeDown,
              ]}>
              {pnlText}
            </Text>
          </View>
        </View>
        {isFavorite && <FavoriteTag style={styles.favoriteTag} />}
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 1000,
    flexShrink: 0,
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
  nameContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['brand-default'],
  },
  positionContainer: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  infoContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  volText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  leverageContainer: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
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
  favoriteTag: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
}));
