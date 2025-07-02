/* eslint-disable react-native/no-inline-styles */
import React, { useMemo } from 'react';
import { Text, View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import {
  CopyTradeTokenItem,
  CopyTradeTokenItemV2,
} from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatUsdValueKMB } from '../../Home/utils/price';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { useTranslation } from 'react-i18next';
import { getTokenSymbol } from '@/utils/token';
import { Skeleton } from '@rneui/themed';
import { useMemoizedFn } from 'ahooks';
import { ellipsisOverflowedText } from '@/utils/text';
import { TokenMetaInfo } from './TokenMetaInfo';
import { DashedUnderlineText } from '@/components2024/DashedUnderlineText';

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

  const chartData = useMemo(() => {
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
  onBuyPress: (item: CopyTradeTokenItemV2) => void;
  onPress: (item: CopyTradeTokenItemV2, isShowSmartWallets?: boolean) => void;
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
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isPositive = (item.price_24h_change || 0) >= 0;

  const handlePressSmartWallets = useMemoizedFn(() => {
    onPress(item, true);
  });

  return (
    <TouchableOpacity style={styles.tokenItem} onPress={() => onPress(item)}>
      <View style={styles.topSection}>
        <View style={styles.tokenLeftSection}>
          <View style={styles.tokenInfoContainer}>
            <AssetAvatar logo={item.logo_url} size={46} />
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenName}>
                {ellipsisOverflowedText(getTokenSymbol(item), 12)}
              </Text>
              <TokenMetaInfo
                tokenCreateAt={item.token_create_at}
                fdv={item.fdv || undefined}
              />
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
          <TouchableOpacity
            style={styles.dollarIconsContainer}
            onPress={showTipsDollarDialog}>
            {Array.from({
              length: Math.min(item.buy_address_count || 0, 10),
            }).map((_, index) => (
              <View key={index}>
                <Image
                  source={require('@/assets2024/icons/home/IconDollar.png')}
                  style={StyleSheet.flatten([
                    styles.dollarIcon,
                    { marginLeft: index === 0 ? 0 : -10 },
                  ])}
                />
              </View>
            ))}
          </TouchableOpacity>
          <View style={styles.buyTextWrapper}>
            <TouchableOpacity
              style={styles.buyTextContainer}
              onPress={handlePressSmartWallets}>
              <DashedUnderlineText
                text={t('page.copyTrading.smartWalletsBuying', {
                  len:
                    item.buy_address_count > 10
                      ? '10+'
                      : item.buy_address_count,
                })}
                textStyle={styles.buyText}
                dashColor={colors2024['neutral-secondary']}
                dashArray="2,2"
                strokeWidth={1}
                dashMarginTop={1}
              />
            </TouchableOpacity>
          </View>
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
    paddingTop: 12,
    paddingHorizontal: 12,
    gap: 4,
    marginBottom: 8,
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
  },
  tokenInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    marginLeft: 8,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  buyInfoContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    padding: 8,
    borderRadius: 8,
  },
  dollarIcon: {
    width: 20,
    height: 20,
  },
  dollarSymbol: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'white',
  },
  buyText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
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
    backgroundColor: colors2024['brand-default'],
    borderRadius: 6,
    width: 56,
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
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triangleContainer: {
    position: 'absolute',
    left: 16,
    top: -6,
    zIndex: 1,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
  },
  changeTextPositive: {
    color: colors2024['red-default'],
  },
  dollarIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
    flexShrink: 1,
  },
  buyTextContainer: {
    flex: 1,
    flexShrink: 0,
    alignSelf: 'flex-start',
    // maxWidth: 160,
  },
  buyTextWrapper: {
    flexShrink: 0,
  },
}));
