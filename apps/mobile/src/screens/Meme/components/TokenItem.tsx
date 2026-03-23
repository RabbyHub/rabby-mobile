import React, { useMemo } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { TokenMarketTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { marketRealtimePriceAtom } from '@/screens/Market/atom';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { ellipsisOverflowedText } from '@/utils/text';
import { formatUsdValueKMB } from '../../Home/utils/price';
import { formatPrice } from '@/utils/number';
import LinearGradient from 'react-native-linear-gradient';
import { Skeleton } from '@rneui/themed';
import { Text } from '@/components/Typography';
import { PercentChangeBadge } from '@/screens/Watchlist/components/TokenItem';
import { isNumber } from 'lodash';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

export const formatPercentageKMB = (x: number) => {
  if (Math.abs(x) < 0.00001) {
    return '0%';
  }
  const percentageValue = x * 100;
  const absPercentage = Math.abs(percentageValue);
  let formattedValue: string;

  if (absPercentage >= 1e9) {
    formattedValue = `${(absPercentage / 1e9).toFixed(1)}B`;
  } else if (absPercentage >= 1e6) {
    formattedValue = `${(absPercentage / 1e6).toFixed(1)}M`;
  } else if (absPercentage >= 1e3) {
    formattedValue = `${(absPercentage / 1e3).toFixed(1)}K`;
  } else if (absPercentage >= 10) {
    formattedValue = absPercentage.toFixed(1);
  } else {
    formattedValue = absPercentage.toFixed(2);
  }

  const sign = x >= 0 ? '+' : '-';
  return `${sign}${formattedValue}%`;
};

interface TokenListItemProps {
  item: TokenMarketTokenItem;
  onPress: (item: TokenMarketTokenItem) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showChainLogo?: boolean;
}

const TokenListItemComponent = ({
  item,
  onPress,
  leftSlot,
  rightSlot,
  showChainLogo = false,
}: TokenListItemProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const uuid = `${item.chain}:${item.id}`;
  const realtimePrice = useAtomValue(
    React.useMemo(
      () => selectAtom(marketRealtimePriceAtom, state => state[uuid]),
      [uuid],
    ),
  );
  const displayPrice = useMemo(
    () => realtimePrice?.price ?? item.price,
    [realtimePrice, item.price],
  );
  const displayPriceChange = useMemo(
    () => realtimePrice?.price_24h_change ?? item.price_24h_change,
    [realtimePrice, item.price_24h_change],
  );

  return (
    <TouchableOpacity style={styles.tokenItem} onPress={() => onPress(item)}>
      {/* 左slot */}
      {leftSlot && <View style={styles.leftSlot}>{leftSlot}</View>}
      <View style={styles.tokenLeftSection}>
        <View style={styles.tokenInfoContainer}>
          {/* Token Chain Logo */}
          <AssetAvatar
            logo={item.logo_url}
            size={46}
            chain={item.chain}
            chainSize={showChainLogo ? 18 : 0}
            innerChainStyle={styles.chainLogo}
          />
          <View style={styles.tokenInfo}>
            {/* symbol */}
            <View style={styles.tokenNameContainer}>
              <Text style={styles.tokenName}>
                {ellipsisOverflowedText(getTokenSymbol(item), 12)}
              </Text>
              {item.launchpad?.logo ? (
                <Image
                  source={{ uri: item.launchpad?.logo }}
                  style={styles.fourMemeIcon}
                  width={18}
                  height={18}
                />
              ) : null}
            </View>
            {item.asset ? (
              <View style={styles.tokenAssetContainer}>
                {item.asset?.logo ? (
                  <Image
                    source={{ uri: item.asset?.logo }}
                    style={styles.fourMemeIcon}
                    width={16}
                    height={16}
                  />
                ) : null}
                <Text style={styles.tokenFdv}>{item.asset?.name}</Text>
              </View>
            ) : item?.fdv ? (
              <Text style={styles.tokenFdv}>
                <Text>{formatUsdValueKMB(item.volume_24h)}</Text>
                <Text style={styles.tokenFdvSeparator}> | </Text>
                <Text>{formatUsdValueKMB(item.fdv)}</Text>
              </Text>
            ) : null}
            {/* Chain Logo */}
          </View>
        </View>
      </View>
      <View style={styles.tokenRightSection}>
        {/* 价格 */}
        <Text style={styles.priceText}>${formatPrice(displayPrice)}</Text>
        {/* 24小时价格变化 */}
        {isNumber(displayPriceChange) && (
          <PercentChangeBadge percent={displayPriceChange} />
        )}
      </View>
      {/* 右slot */}
      {rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
    </TouchableOpacity>
  );
};

export const TokenListItem = React.memo(TokenListItemComponent);

export const TokenItemSkeleton = () => {
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });
  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-5'], 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.skeletonContainer}>
      <Skeleton style={styles.skeletonItem} height={74} />
    </LinearGradient>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  tokenItem: {
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    gap: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
  },
  tokenLeftSection: {
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  tokenInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    marginLeft: 8,
  },
  tokenNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tokenFdv: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
  tokenFdvSeparator: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['neutral-line'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  fourMemeIcon: {
    width: 14,
    height: 14,
  },
  chainLogo: {
    borderWidth: 1.5,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  tokenRightSection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    justifyContent: 'center',
  },
  priceText: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  changeText: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    width: 60,
  },
  changeTextPositive: {
    color: colors2024['red-default'],
  },
  trendChartContainer: {
    display: 'flex',
    flexDirection: 'column',
    //paddingHorizontal: 6.5,
    paddingVertical: 6,
    borderRadius: 6,
    width: 60,
    alignItems: 'flex-end',
  },
  leftSlot: {
    width: 24,
    marginRight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  rightSlot: {
    width: 24,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  skeletonContainer: {
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
  skeletonItem: {
    backgroundColor: 'transparent',
  },
  trendChartWrapper: {
    height: 30,
    marginTop: -10,
    marginBottom: 10,
  },
  lpTokenIconContainer: {
    marginLeft: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  tokenAssetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
}));
