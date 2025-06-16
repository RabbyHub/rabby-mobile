/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../../Home/utils/price';
import IconDollar from '@/assets2024/icons/home/IconDollar.svg';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import { Skeleton } from '@rneui/themed';

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

  // Transform data for chart
  const chartData = data.map(point => ({
    timestamp: point.time_at * 1000, // Convert to milliseconds
    value: point.price,
  }));

  const pathColor = isPositive
    ? colors2024['green-default']
    : colors2024['red-default'];

  if (!chartData.length || chartData.length < 2) {
    // Fallback to simple line if insufficient data
    return (
      <View style={{ width: 100, height: 30 }}>
        <View
          style={{
            width: '100%',
            height: 2,
            backgroundColor: pathColor,
            borderRadius: 1,
            marginTop: 15,
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ width: 100, height: 30, marginTop: -10, marginBottom: 10 }}>
      <LineChart.Provider data={chartData}>
        <LineChart height={50} width={100} shape={d3Shape.curveCatmullRom}>
          <LineChart.Path showInactivePath={false} color={pathColor} width={2}>
            <LineChart.Gradient color={pathColor} />
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
    </View>
  );
};

interface TokenListItemProps {
  item: CopyTradeTokenItem;
  onBuyPress: (item: CopyTradeTokenItem) => void;
  onPress: (item: CopyTradeTokenItem) => void;
  showTipsDollarDialog: () => void;
}

const TrendChart = React.memo(TrendChartComponent);

export const SkeletonTokenListItem = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.tokenItem}>
      <View style={styles.topSection}>
        <View style={styles.tokenLeftSection}>
          <View style={styles.tokenInfoContainer}>
            <Skeleton circle width={46} height={46} />
            <View style={styles.tokenInfo}>
              <Skeleton
                width={40}
                height={20}
                style={{ marginTop: 0, borderRadius: 4 }}
              />
              <Skeleton
                width={80}
                height={18}
                style={{ marginTop: 4, borderRadius: 4 }}
              />
            </View>
          </View>
        </View>
        <View style={styles.tokenRightSection}>
          <Skeleton width={100} height={56} style={{ borderRadius: 10 }} />
        </View>
      </View>
      <View style={styles.bottomSection}>
        <Skeleton width={160} height={36} style={{ borderRadius: 6 }} />
        <Skeleton width={66} height={34} style={{ borderRadius: 6 }} />
      </View>
    </View>
  );
};

const TokenListItemComponent = ({
  item,
  onBuyPress,
  onPress,
  showTipsDollarDialog,
}: TokenListItemProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isPositive = (item.price_24h_change || 0) >= 0;

  return (
    <TouchableOpacity style={styles.tokenItem} onPress={() => onPress(item)}>
      <View style={styles.topSection}>
        <View style={styles.tokenLeftSection}>
          <View style={styles.tokenInfoContainer}>
            <AssetAvatar logo={item.logo_url} size={46} />
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenName}>{getTokenSymbol(item)}</Text>
              <Text style={styles.fdvText}>
                FDV {formatUsdValueKMB(item.fdv || 0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tokenRightSection}>
          <TrendChart
            isPositive={isPositive}
            data={item.price_curve_24h || []}
          />
          <Text
            style={StyleSheet.flatten([
              styles.changeText,
              !isPositive && styles.changeTextPositive,
            ])}>
            {formatPercentage(Number(item.price_24h_change) || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.buyInfoContainer}>
          <View style={styles.triangleContainer}>
            <View style={styles.triangle} />
          </View>
          <TouchableOpacity onPress={showTipsDollarDialog}>
            <IconDollar width={20} height={20} style={styles.dollarIcon} />
          </TouchableOpacity>
          <Text style={styles.buyText}>
            Buy{'  '}
            <Text style={styles.buyTextBold}>
              {formatUsdValueKMB(item.buy_usd_value_24h || 0)}
            </Text>
            {'  '}
            in 24h
          </Text>
        </View>
        <TouchableOpacity
          style={styles.buyButton}
          onPress={() => onBuyPress(item)}>
          <Text style={styles.buyButtonText}>Buy</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export const TokenListItem = React.memo(TokenListItemComponent);

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  tokenItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 16,
    marginBottom: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  tokenLeftSection: {
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  tokenInfoContainer: {
    flexDirection: 'row',
  },
  tokenInfo: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  fdvText: {
    marginTop: 4,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  buyInfoContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingLeft: 12,
    borderRadius: 8,
  },
  dollarIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  dollarSymbol: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'white',
  },
  buyText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  buyTextBold: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
  },
  tokenRightSection: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    justifyContent: 'center',
    width: 100,
  },
  changeText: {
    fontWeight: '700',
    // marginTop: 4,
    fontSize: 18,
    lineHeight: 22,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  buyButton: {
    backgroundColor: colors2024['blue-default'],
    borderRadius: 6,
    width: 66,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyButtonText: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
  },
  topSection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomSection: {
    width: '100%',
    height: 34,
    gap: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triangleContainer: {
    position: 'absolute',
    left: 16,
    top: -10,
    zIndex: 1,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors2024['brand-light-1'],
  },
  changeTextPositive: {
    color: colors2024['red-default'],
  },
}));
