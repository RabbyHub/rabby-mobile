import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
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
import { isLpToken } from '@/utils/lpToken';
import LpTokenIcon from '@/screens/Home/components/LpTokenIcon';
import { Text } from '@/components/Typography';
import { formatPercentageKMB } from '@/screens/Meme/components/TokenItem';
import { isNumber } from 'lodash';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

export const PercentChangeBadge = ({ percent }: { percent?: number }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const isZeroChange = useMemo(() => {
    return percent === 0;
  }, [percent]);
  const isPositive = useMemo(() => {
    return (percent || 0) > 0;
  }, [percent]);
  const percentStr = useMemo(() => {
    return formatPercentageKMB(Number(percent) || 0);
  }, [percent]);
  return (
    <View
      style={[
        styles.trendContainer,
        {
          backgroundColor: isZeroChange
            ? colors2024['neutral-bg-5']
            : isPositive
            ? colors2024['green-default']
            : colors2024['red-default'],
        },
      ]}>
      <Text
        style={StyleSheet.flatten([
          styles.changeText,
          {
            fontSize: getPercentSize(percentStr),
            color: isZeroChange
              ? colors2024['neutral-secondary']
              : colors2024['neutral-InvertHighlight'],
          },
        ])}>
        {percentStr}
      </Text>
    </View>
  );
};
const getPercentSize = (per: string) => {
  if (per.length > 4) {
    return 13;
  }
  return 14;
};
interface TokenListItemProps {
  item: TokenDetailWithPriceCurve;
  onPress: (item: TokenDetailWithPriceCurve) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const TokenListItemComponent = ({
  item,
  onPress,
  leftSlot,
  rightSlot,
}: TokenListItemProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const uuid = `${item.chain}:${item.id}`;
  const realtimePrice = useAtomValue(
    React.useMemo(
      () => selectAtom(marketRealtimePriceAtom, state => state[uuid]),
      [uuid],
    ),
  );
  const displayPrice = realtimePrice?.price ?? item.price;
  const displayPriceChange =
    realtimePrice?.price_24h_change ?? item.price_24h_change;

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
            chainSize={18}
            innerChainStyle={styles.chainLogo}
          />
          <View style={styles.tokenInfo}>
            {/* symbol */}
            <View style={styles.tokenNameContainer}>
              <Text style={styles.tokenName}>
                {ellipsisOverflowedText(getTokenSymbol(item), 12)}
              </Text>
              {isLpToken(item) && (
                <View style={styles.lpTokenIconContainer}>
                  <LpTokenIcon protocolId={item.protocol_id || ''} />
                </View>
              )}
            </View>
            {/* FDV */}
            {!!item.identity?.fdv && (
              <Text style={styles.tokenFdv}>
                {formatUsdValueKMB(item.identity.fdv)}
              </Text>
            )}
            {/* Chain Logo */}
          </View>
        </View>
      </View>
      <View style={styles.tokenRightSection}>
        {/* 价格 */}
        <Text style={styles.priceText}>${formatPrice(displayPrice)}</Text>
        {/* 24小时价格百分比 */}
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
    alignContent: 'center',
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
  tokenName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
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
    width: '100%',
  },
  changeTextPositive: {
    color: colors2024['red-default'],
  },
  trendContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    width: 68,
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
}));
