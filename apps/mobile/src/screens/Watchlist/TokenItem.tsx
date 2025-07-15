import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { CopyTradeTokenItemV2 } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { getTokenSymbol } from '@/utils/token';
import { ellipsisOverflowedText } from '@/utils/text';
import { formatUsdValueKMB } from '../Home/utils/price';
import { formatPrice } from '@/utils/number';

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
}: {
  isPositive: boolean;
  data: { time_at: number; price: number }[];
}) => {
  const { colors2024 } = useTheme2024({ getStyle: getStyles });

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
    <View style={{ width: 90, height: 30, marginTop: -10, marginBottom: 10 }}>
      <LineChart.Provider data={chartData}>
        <LineChart height={50} width={90} shape={d3Shape.curveCatmullRom}>
          <LineChart.Path showInactivePath={false} color={pathColor} width={1}>
            <LineChart.Gradient color={pathColor} />
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
    </View>
  );
};

interface TokenListItemProps {
  item: CopyTradeTokenItemV2;
  onPress: (item: CopyTradeTokenItemV2) => void;
}

const TrendChart = React.memo(TrendChartComponent);

const TokenListItemComponent = ({ item, onPress }: TokenListItemProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const isPositive = (item.price_change || item.price_24h_change || 0) >= 0;

  return (
    <TouchableOpacity style={styles.tokenItem} onPress={() => onPress(item)}>
      <View style={styles.tokenLeftSection}>
        <View style={styles.tokenInfoContainer}>
          {/* Token头像 */}
          <AssetAvatar
            logo={item.logo_url}
            size={46}
            chain={item.chain}
            chainSize={16}
          />
          {/* 链头像 */}
          {/* {item.chain && (
              <Image
                source={{ uri: item.chain }}
                style={styles.chainLogo}
              />
            )} */}
          <View style={styles.tokenInfo}>
            {/* symbol */}
            <Text style={styles.tokenName}>
              {ellipsisOverflowedText(getTokenSymbol(item), 12)}
            </Text>
            {/* 市值 */}
            {item.fdv && (
              <Text style={styles.tokenFdv}>
                {item.fdv ? formatUsdValueKMB(item.fdv) : '-'}
              </Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.tokenRightSection}>
        {/* 价格 */}
        <Text style={styles.priceText}>${formatPrice(item.price)}</Text>
        {/* 24小时价格曲线 */}
        <View>
          <TrendChart
            isPositive={isPositive}
            data={item.price_curve_24h || []}
          />
          {/* 24小时价格百分比 */}
          <Text
            style={StyleSheet.flatten([
              styles.changeText,
              !isPositive && styles.changeTextPositive,
            ])}>
            {formatPercentage(
              Number(item.price_change) || Number(item.price_24h_change) || 0,
            )}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const TokenListItem = React.memo(TokenListItemComponent);

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
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: 8,
  },
  tokenRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11.5,
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
    fontSize: 18,
    lineHeight: 22,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  changeTextPositive: {
    color: colors2024['red-default'],
  },
}));
