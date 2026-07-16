import { AssetAvatar } from '@/components';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { FavoriteTag } from '@/components2024/Favorite';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { Text } from '@/components/Typography';
import { PerpsDisplayCoinName } from '../PerpsDisplayCoinName';
import { PerpsRankBadge } from './PerpsRankBadge';
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

const PerpsMarketItemComponent: React.FC<{
  item: MarketData;
  rank?: number;
  onPress?(): void;
}> = ({ item, onPress, rank }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  // markPx/prevDayPx are '' until the first ticker lands (fresh fetch or
  // hydrated cache) — render placeholders instead of $NaN.
  const hasPrice = !!item.markPx && Number.isFinite(Number(item.markPx));
  const hasChange = hasPrice && !!item.prevDayPx && Number(item.prevDayPx) > 0;
  const isUp = Number(item.markPx) - Number(item.prevDayPx) > 0;
  const absPnlUsd = Math.abs(Number(item.markPx) - Number(item.prevDayPx));
  const absPnlPct = Math.abs(absPnlUsd / Number(item.prevDayPx));
  const pnlText = hasChange
    ? `${isUp ? '+' : '-'}${formatPct(absPnlPct)}`
    : '-';

  return (
    <TouchableOpacity onPress={onPress}>
      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <AssetAvatar logo={item.logoUrl} logoStyle={styles.icon} size={40} />
          {rank != null && <PerpsRankBadge rank={rank} />}
        </View>
        <View style={styles.content}>
          <View style={styles.row}>
            <View style={styles.nameContainer}>
              <PerpsDisplayCoinName item={item} />
            </View>
            <Text style={styles.price}>
              {hasPrice ? `$${splitNumberByStep(item.markPx)}` : '-'}
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
                hasChange
                  ? isUp
                    ? null
                    : styles.priceChangeDown
                  : styles.priceChangeMuted,
              ]}>
              {pnlText}
            </Text>
          </View>
        </View>
        {/* {isFavorite && (
          <RcIconFavorite
            width={13}
            height={12}
            style={styles.favoriteTag}
            color={colors2024['orange-default']}
          />
        )} */}
      </View>
    </TouchableOpacity>
  );
};

export const PerpsMarketItem = React.memo(
  PerpsMarketItemComponent,
  (prev, next) => {
    // Only re-render when visible data actually changes
    return (
      prev.item.name === next.item.name &&
      prev.item.markPx === next.item.markPx &&
      prev.item.prevDayPx === next.item.prevDayPx &&
      prev.item.dayNtlVlm === next.item.dayNtlVlm &&
      prev.item.maxLeverage === next.item.maxLeverage &&
      prev.item.logoUrl === next.item.logoUrl &&
      prev.item.quoteAsset === next.item.quoteAsset &&
      prev.rank === next.rank
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoWrap: {
    flexShrink: 0,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 1000,
    backgroundColor: 'white',
    flexShrink: 0,
  },
  content: {
    flex: 1,

    display: 'flex',
    flexDirection: 'column',
    gap: 2,
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
    fontWeight: '700',
    color: '#50D2C1',
  },
  positionContainer: {
    backgroundColor: 'rgba(80, 210, 193, 0.12)',
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  price: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  priceChange: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['green-default'],
  },
  priceChangeDown: {
    color: colors2024['red-default'],
  },
  priceChangeMuted: {
    color: colors2024['neutral-secondary'],
  },
  favoriteTag: {
    position: 'absolute',
    right: 8,
    top: 0,
  },
}));
