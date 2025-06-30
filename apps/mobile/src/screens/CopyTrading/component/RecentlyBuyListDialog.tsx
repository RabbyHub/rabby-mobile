import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Dimensions,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { getTokenSymbol } from '@/utils/token';
import { Button } from '@/components2024/Button';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { formatUsdValueKMB } from '../../Home/utils/price';
import IconDollar from '@/assets2024/icons/home/IconDollar.svg';
import {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { CopyTradeRecentBuyItem } from '@rabby-wallet/rabby-api/dist/types';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';
import { BuyItem, SkeletonBuyItem } from './BuyItem';
import { formatPercentage } from './TokenListItem';
import { formatPrice } from '@/utils/number';
import { Skeleton } from '@rneui/themed';
import { toast } from '@/components2024/Toast';
import dayjs from 'dayjs';

const ScreenWidth = Dimensions.get('screen').width;
interface IHeaderProps {
  currentPrice: string;
  currentChange: string;
  isPositive: boolean;
  data: {
    timestamp: number;
    value: number;
    formattedPrice: string;
    formattedPercentage: string;
    clockTimeString?: string;
    isLoss?: boolean;
  }[];
}

const PriceHeader = ({
  currentPrice,
  currentChange,
  isPositive,
  data,
}: IHeaderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentIndex } = LineChart.useChart();

  const priceText = useDerivedValue(() => {
    return data?.[currentIndex.value]?.formattedPrice || currentPrice;
  }, [data, currentIndex.value, currentPrice]);

  const percentChange = useDerivedValue(() => {
    return data?.[currentIndex.value]?.formattedPercentage || currentChange;
  }, [data, currentIndex.value, currentChange]);

  const changeStyleProps = useAnimatedStyle(() => {
    if (data?.[currentIndex.value]) {
      return {
        color: data?.[currentIndex?.value]?.isLoss
          ? colors2024['red-default']
          : colors2024['green-default'],
      };
    }
    return {
      color: isPositive
        ? colors2024['green-default']
        : colors2024['red-default'],
    };
  }, [data, currentIndex.value, isPositive, colors2024]);

  const priceAnimatedProps = useAnimatedProps(() => {
    return {
      text: priceText.value,
    };
  });

  const changeAnimatedProps = useAnimatedProps(() => {
    return {
      text: percentChange.value,
    };
  });

  const dateTime = useDerivedValue(() => {
    return data?.[currentIndex?.value]?.clockTimeString || '24h';
  }, [data, currentIndex]);

  const dateTimeAnimatedProps = useAnimatedProps(() => {
    return {
      text: dateTime.value,
    };
  });

  return (
    <View style={styles.priceSection}>
      <AnimateableText
        style={styles.price}
        animatedProps={priceAnimatedProps}
      />
      <AnimateableText
        style={changeStyleProps}
        animatedProps={changeAnimatedProps}
      />
      <AnimateableText
        style={styles.priceChangeLabel}
        animatedProps={dateTimeAnimatedProps}
      />
    </View>
  );
};

const TrendChart = ({
  data,
  isPositive,
}: {
  data: { time_at: number; price: number }[];
  isPositive: boolean;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  const pathColor = isPositive
    ? colors2024['green-default']
    : colors2024['red-default'];

  return (
    <View style={styles.trendChart}>
      <LineChart
        height={100}
        width={ScreenWidth - 40}
        shape={d3Shape.curveCatmullRom}>
        <LineChart.Path showInactivePath={false} color={pathColor} width={2}>
          <LineChart.Gradient color={pathColor} />
        </LineChart.Path>
        <LineChart.CursorLine color={colors2024['neutral-line']} />
        <LineChart.CursorCrosshair color={pathColor} outerSize={12} size={8} />
      </LineChart>
    </View>
  );
};

export type DialogProps = {
  tradingTokenItem: CopyTradeTokenItem;
  onClose?: () => void;
};

export default function RecentlyBuyListDialog({
  tradingTokenItem,
  onClose,
}: RNViewProps & DialogProps) {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const isPositive = (tradingTokenItem.price_24h_change || 0) >= 0;

  const fetchRecentBuyList = useMemoizedFn(async () => {
    try {
      const res = await openapi.getCopyTradingRecentBuyList({
        chain_id: tradingTokenItem.chain,
        token_id: tradingTokenItem.id,
        limit: 50,
      });
      return res;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return {
        recent_buy_list: [],
        total: 0,
      };
    }
  });

  const { data: recentBuyList, loading } = useRequest(async () => {
    const res = await fetchRecentBuyList();
    return res;
  });

  const chartData = useMemo(() => {
    const priceData = tradingTokenItem.price_curve_24h || [];
    if (!priceData.length || priceData.length < 2) {
      return [
        {
          timestamp: 0,
          value: 0,
          formattedPrice: '$0',
          formattedPercentage: '+0.00%',
        },
        {
          timestamp: 1,
          value: 0,
          formattedPrice: '$0',
          formattedPercentage: '+0.00%',
        },
      ];
    }

    const firstPrice = priceData[0]?.price || 0;

    return priceData.map(point => {
      const price = point.price;
      const change = price - firstPrice;
      const changePercent = firstPrice !== 0 ? change / firstPrice : 0;
      const isLoss = changePercent < 0;
      const date = new Date(point.time_at * 1000);
      const HH = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');

      return {
        timestamp: point.time_at * 1000,
        value: price,
        formattedPrice: `$${formatPrice(price, 6)}`,
        formattedPercentage: `${formatPercentage(changePercent)}`,
        isLoss,
        clockTimeString: `${HH}:${mm}`,
      };
    });
  }, [tradingTokenItem.price_curve_24h]);

  const ListHeaderComponent = React.useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Price section with chart interaction */}
        <LineChart.Provider data={chartData}>
          <PriceHeader
            currentPrice={`$${formatPrice(
              Number(tradingTokenItem.price) || 0,
              6,
            )}`}
            currentChange={formatPercentage(
              Number(tradingTokenItem.price_24h_change) || 0,
            )}
            isPositive={isPositive}
            data={chartData}
          />

          {/* Chart */}
          <TrendChart
            data={tradingTokenItem.price_curve_24h || []}
            isPositive={isPositive}
          />
        </LineChart.Provider>

        {/* Smart Money Wallets section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <IconDollar width={20} height={20} />
            {loading ? null : (
              <Text style={styles.priceChangeLabel}>
                {`${recentBuyList?.total || 0} ${
                  recentBuyList?.total === 1
                    ? t('page.copyTrading.smartMoneyWallet')
                    : t('page.copyTrading.smartMoneyWallets')
                }`}
              </Text>
            )}
          </View>
          <Text style={styles.priceChangeLabel}>
            {t('page.copyTrading.recentBuy')}
          </Text>
        </View>
      </View>
    ),
    [
      chartData,
      styles,
      loading,
      tradingTokenItem.price,
      tradingTokenItem.price_24h_change,
      tradingTokenItem.price_curve_24h,
      isPositive,
      t,
      recentBuyList?.total,
    ],
  );

  const handleBuyPress = useMemoizedFn((item: CopyTradeTokenItem) => {
    const chain = findChain({
      serverId: item.chain,
    });
    onClose?.();
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.MultiSwap,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: item?.id,
        type: 'Buy',
        isFromCopyTrading: true,
      },
    });
  });

  const renderBuyItem = useMemoizedFn(
    ({ item }: { item: CopyTradeRecentBuyItem }) => {
      return <BuyItem item={item} />;
    },
  );

  // Render skeleton items when loading
  const renderSkeletonList = useMemoizedFn(() => {
    return (
      <View>
        {ListHeaderComponent}
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonBuyItem key={index} />
        ))}
      </View>
    );
  });

  return (
    <AutoLockView style={styles.container}>
      {/* Header with token info */}
      <BottomSheetHandlableView>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.tokenHeader}
            onPress={() => {
              // Close dialog first, then navigate
              onClose?.();
              naviPush(RootNames.TokenDetail, {
                token: ensureAbstractPortfolioToken(tradingTokenItem),
                needUseCacheToken: true,
              });
            }}>
            <AssetAvatar
              logo={tradingTokenItem?.logo_url}
              size={24}
              chain={tradingTokenItem?.chain}
              chainSize={12}
            />
            <Text
              style={styles.tokenName}
              numberOfLines={1}
              ellipsizeMode="tail">
              {getTokenSymbol(tradingTokenItem)}
            </Text>
            <RcIconRightCC
              width={14}
              height={14}
              color={colors2024['neutral-title-1']}
            />
          </TouchableOpacity>
        </View>
      </BottomSheetHandlableView>

      {loading ? (
        <View style={styles.scrollContent}>{renderSkeletonList()}</View>
      ) : (
        <BottomSheetFlatList
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={recentBuyList?.recent_buy_list || []}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeaderComponent}
          renderItem={renderBuyItem}
          contentContainerStyle={styles.flatListContent}
        />
      )}

      {/* Fixed bottom button */}
      <View style={styles.bottomButton}>
        <Button
          type="primary"
          title={t('page.copyTrading.buy')}
          onPress={() => handleBuyPress(tradingTokenItem)}
        />
      </View>
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  trendChart: {
    width: '100%',
    height: 100,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  skeletonBorder: {
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  header: {
    height: 38,
    marginBottom: 15,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 100,
    padding: 6,
  },
  tokenName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  scrollContent: {
    flex: 1,
  },
  listHeader: {
    paddingBottom: 0,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  priceSection: {
    gap: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  price: {
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  priceChangeLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  priceChange: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  dateTime: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  recentBuy: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  bottomButton: {
    paddingHorizontal: 8,
    paddingTop: 12,
    height: 115,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  buyButton: {
    height: 48,
    borderRadius: 12,
  },
  buyButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
}));
