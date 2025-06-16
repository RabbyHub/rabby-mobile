/* eslint-disable react-native/no-inline-styles */
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
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { CopyTradeRecentBuyItem } from '@rabby-wallet/rabby-api/dist/types';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { appIsDev } from '@/constant/env';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';
import { BuyItem, SkeletonBuyItem } from './BuyItem';
import { formatPercentage } from './TokenListItem';
import { formatPrice } from '@/utils/number';
import { Skeleton } from '@rneui/themed';

// Mock data for recent purchases - using CopyTradeRecentBuyItem format
const mockRecentBuys: CopyTradeRecentBuyItem[] = [
  {
    id: '1',
    user_addr: '0x8853ac213123123beeb85',
    user_addr_pnl: {
      id: '1',
      profit_usd_value: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 1412.1,
    action: 'buy',
    buy_usd_value: 1412100, // $1,412.1K
    create_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  },
  {
    id: '2',
    user_addr: '0x8853ac12412124beeb852424242',
    user_addr_pnl: {
      id: '2',
      profit_usd_value: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 912.1,
    action: 'buy',
    buy_usd_value: 912100, // $912.1K
    create_at: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
  },
  {
    id: '3',
    user_addr: '0x8853ac123123beeb8523232323',
    user_addr_pnl: {
      id: '3',
      profit_usd_value: 1234,
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 412.1,
    action: 'buy',
    buy_usd_value: 412100, // $412.1K
    create_at: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
  },
  {
    id: '4',
    user_addr: '0x8853ac123123beeb8511111',
    user_addr_pnl: {
      id: '3',
      profit_usd_value: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 412.1,
    action: 'buy',
    buy_usd_value: 412100, // $412.1K
    create_at: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
  },
];

const ScreenWidth = Dimensions.get('screen').width;

const TrendChart = ({
  data,
  isPositive,
}: {
  data: { time_at: number; price: number }[];
  isPositive: boolean;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

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
      <View style={{ width: ScreenWidth - 40, height: 100 }}>
        <View
          style={{
            width: '100%',
            height: 2,
            backgroundColor: pathColor,
            borderRadius: 1,
            marginTop: 50,
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.trendChart}>
      <LineChart.Provider data={chartData}>
        <LineChart
          height={100}
          width={ScreenWidth - 40}
          shape={d3Shape.curveCatmullRom}>
          <LineChart.Path showInactivePath={false} color={pathColor} width={2}>
            <LineChart.Gradient color={pathColor} />
          </LineChart.Path>
        </LineChart>
      </LineChart.Provider>
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

  const isDark = useGetBinaryMode() === 'dark';
  const isPositive = (tradingTokenItem.price_24h_change || 0) >= 0;

  const fetchRecentBuyList = useMemoizedFn(async () => {
    try {
      // if (appIsDev) {
      //   return {
      //     recent_buy_list: mockRecentBuys,
      //     total: mockRecentBuys.length,
      //   };
      // }

      const res = await openapi.getCopyTradingRecentBuyList({
        chain_id: tradingTokenItem.chain,
        token_id: tradingTokenItem.id,
        limit: 50,
      });
      return res;
    } catch (e) {
      console.debug('fetchRecentBuyList error', e);
    }
  });

  const { data: recentBuyList, loading } = useRequest(async () => {
    const res = await fetchRecentBuyList();
    return res;
  });

  const ListHeaderComponent = React.useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Price section */}
        <View style={styles.priceSection}>
          <Text style={styles.price}>
            {`$${formatPrice(Number(tradingTokenItem.price) || 0)}`}
          </Text>
          <Text
            style={[
              styles.priceChange,
              {
                color: isPositive
                  ? colors2024['green-default']
                  : colors2024['red-default'],
              },
            ]}>
            {formatPercentage(Number(tradingTokenItem.price_24h_change) || 0)}
          </Text>
          <Text style={styles.priceChangeLabel}>24h</Text>
        </View>

        {/* Chart */}
        {
          <TrendChart
            data={tradingTokenItem.price_curve_24h || []}
            isPositive={isPositive}
          />
        }

        {/* Smart Money Wallets section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <IconDollar width={20} height={20} />
            {loading ? null : (
              <Text style={styles.priceChangeLabel}>
                {`${recentBuyList?.total || 0} ${t(
                  'page.copyTrading.smartMoneyWallets',
                )}`}
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
      styles,
      loading,
      tradingTokenItem.price,
      tradingTokenItem.price_24h_change,
      tradingTokenItem.price_curve_24h,
      isPositive,
      colors2024,
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
    // justifyContent: 'space-between',
  },
  price: {
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '800',
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
