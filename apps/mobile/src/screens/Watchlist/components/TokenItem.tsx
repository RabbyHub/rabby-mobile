import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { getTokenSymbol } from '@/utils/token';
import { ellipsisOverflowedText } from '@/utils/text';
import { formatUsdValueKMB } from '../../Home/utils/price';
import { formatPrice } from '@/utils/number';
import LinearGradient from 'react-native-linear-gradient';
import { Skeleton } from '@rneui/themed';
import { isLpToken } from '@/utils/lpToken';
import LpTokenIcon from '@/screens/Home/components/LpTokenIcon';

export const formatPercentage = (x: number) => {
  if (Math.abs(x) < 0.00001) {
    return '0%';
  }
  const percentage = (x * 100).toFixed(2);
  return `${x >= 0 ? '+' : ''}${percentage}%`;
};

const TrendChartComponent = ({
  isPositive,
  data,
  width,
}: {
  isPositive: boolean;
  data: { time_at: number; price: number }[];
  width: number;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle: getStyles });

  const chartData = React.useMemo(() => {
    if (!data.length || data.length < 2) {
      return [
        {
          timestamp: 0,
          value: 0,
        },
        {
          timestamp: 1,
          value: 0,
        },
      ];
    }

    return data.map(point => ({
      timestamp: point.time_at * 1000, // Convert to milliseconds
      value: point.price,
    }));
  }, [data]);

  const pathColor = isPositive
    ? colors2024['green-default']
    : colors2024['red-default'];

  return (
    <View style={[styles.trendChartWrapper, { width: width }]}>
      <LineChart.Provider data={chartData}>
        <LineChart height={50} width={width} shape={d3Shape.curveCatmullRom}>
          <LineChart.Path showInactivePath={false} color={pathColor} width={1}>
            <LineChart.Gradient color={pathColor} />
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
    </View>
  );
};

interface TokenListItemProps {
  item: TokenDetailWithPriceCurve;
  onPress: (item: TokenDetailWithPriceCurve) => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const TrendChart = React.memo(TrendChartComponent);

const TokenListItemComponent = ({
  item,
  onPress,
  leftSlot,
  rightSlot,
}: TokenListItemProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const isPositive = (item.price_24h_change || 0) >= 0;
  const hasSlot = !!leftSlot || !!rightSlot;
  const trendChartWidth = hasSlot ? 58 : 78;

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
        <Text style={styles.priceText}>${formatPrice(item.price)}</Text>
        {/* 24小时价格曲线 */}
        <View style={styles.trendChartContainer}>
          <TrendChart
            isPositive={isPositive}
            data={item.price_curve_24h || []}
            width={trendChartWidth}
          />
          {/* 24小时价格百分比 */}
          {typeof item.price_24h_change === 'number' && (
            <Text
              style={StyleSheet.flatten([
                styles.changeText,
                !isPositive && styles.changeTextPositive,
              ])}>
              {formatPercentage(Number(item.price_24h_change) || 0)}
            </Text>
          )}
        </View>
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
    paddingVertical: 14,
    paddingHorizontal: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11.6,
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
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginTop: -4,
  },
  changeTextPositive: {
    color: colors2024['red-default'],
  },
  trendChartContainer: {
    display: 'flex',
    flexDirection: 'column',
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
