/* eslint-disable react-native/no-inline-styles */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { getTokenSymbol } from '@/utils/token';
import { Button } from '@/components2024/Button';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { LineChart } from 'react-native-wagmi-charts';
import * as d3Shape from 'd3-shape';
import { formatUsdValueKMB } from '../../Home/utils/price';
import IconDollar from '@/assets2024/icons/home/IconDollar.svg';
import {
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet';
import { useMemoizedFn, useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { CopyTradeRecentBuyItem } from '@rabby-wallet/rabby-api/dist/types';
import { ellipsisAddress } from '@/utils/address';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { appIsDev } from '@/constant/env';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';

// Mock data for recent purchases - using CopyTradeRecentBuyItem format
const mockRecentBuys: CopyTradeRecentBuyItem[] = [
  {
    id: '1',
    user_addr: '0x8853ac213123123beeb85',
    user_addr_pnl: {
      id: '1',
      profit_usd: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 1412.1,
    action: 'buy',
    usd_value: 1412100, // $1,412.1K
    create_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  },
  {
    id: '2',
    user_addr: '0x8853ac12412124beeb852424242',
    user_addr_pnl: {
      id: '2',
      profit_usd: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 912.1,
    action: 'buy',
    usd_value: 912100, // $912.1K
    create_at: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
  },
  {
    id: '3',
    user_addr: '0x8853ac123123beeb8523232323',
    user_addr_pnl: {
      id: '3',
      profit_usd: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 412.1,
    action: 'buy',
    usd_value: 412100, // $412.1K
    create_at: Math.floor(Date.now() / 1000) - 14400, // 4 hours ago
  },
  {
    id: '4',
    user_addr: '0x8853ac123123beeb8511111',
    user_addr_pnl: {
      id: '3',
      profit_usd: 1234, // $1,234 profit
    },
    chain_id: 'eth',
    token_id: 'eth_0x...',
    token_amount: 412.1,
    action: 'buy',
    usd_value: 412100, // $412.1K
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
  const { colors2024 } = useTheme2024({ getStyle });

  // Transform data for chart
  const chartData = data.map(point => ({
    timestamp: point.time_at * 1000, // Convert to milliseconds
    value: point.price,
  }));

  const pathColor = isPositive
    ? colors2024['green-default']
    : colors2024['red-default'];

  return (
    <View style={{ width: '100%', height: 100, marginTop: 20 }}>
      <LineChart.Provider data={chartData}>
        <LineChart
          height={100}
          width={ScreenWidth - 32}
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

  const formatPercentage = React.useCallback(
    (change: number | null | undefined): string => {
      if (change === null || change === undefined) {
        return '+0.0%';
      }
      return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
    },
    [],
  );

  // 提取ListHeaderComponent到函数组件外部
  const ListHeaderComponent = React.useMemo(
    () => (
      <View style={styles.listHeader}>
        {/* Price section */}
        <View style={styles.priceSection}>
          <Text style={styles.price}>
            ${tradingTokenItem.price?.toFixed(2) || '0.00'}
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
            {formatPercentage(tradingTokenItem.price_24h_change)} 24h
          </Text>
        </View>

        {/* Chart */}
        {tradingTokenItem.net_curve_24h &&
          tradingTokenItem.net_curve_24h.length > 0 && (
            <TrendChart
              data={tradingTokenItem.net_curve_24h || []}
              isPositive={isPositive}
            />
          )}

        {/* Smart Money Wallets section header */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconDollar width={20} height={20} />
            <Text style={styles.sectionTitle}>9 Smart Money Wallets</Text>
            <Text style={styles.recentBuy}>Recent Buy</Text>
          </View>
        </View>
      </View>
    ),
    [
      styles.listHeader,
      styles.priceSection,
      styles.price,
      styles.priceChange,
      styles.section,
      styles.sectionHeader,
      styles.sectionTitle,
      styles.recentBuy,
      tradingTokenItem.price,
      tradingTokenItem.price_24h_change,
      tradingTokenItem.net_curve_24h,
      isPositive,
      colors2024,
      formatPercentage,
    ],
  );

  const fetchRecentBuyList = useMemoizedFn(async () => {
    try {
      if (appIsDev) {
        return {
          recent_buy_list: mockRecentBuys,
          total: mockRecentBuys.length,
        };
      }

      const res = await openapi.getCopyTradingRecentBuyList({
        chain_id: tradingTokenItem.chain,
        token_id: tradingTokenItem.id,
        limit: 10,
      });
      return res;
    } catch (e) {
      console.debug('fetchRecentBuyList error', e);
    }
  });

  // ttodo： 确认是否分页
  const { data: recentBuyList } = useRequest(async () => {
    const res = await fetchRecentBuyList();
    return res;
  });

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

      <BottomSheetFlatList
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        data={recentBuyList?.recent_buy_list || []}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeaderComponent}
        renderItem={({ item }) => (
          <View style={styles.buyItem}>
            <View style={styles.buyItemLeft}>
              <Text style={styles.address}>
                {ellipsisAddress(item.user_addr)}
              </Text>
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>▼ History Profit</Text>
                <Text style={[styles.profitValue]}>
                  {formatUsdValueKMB(item.user_addr_pnl?.profit_usd)}
                </Text>
              </View>
            </View>
            <View style={styles.buyItemRight}>
              <Text style={styles.buyLabel}>Buy</Text>
              <Text style={styles.buyAmount}>
                {formatUsdValueKMB(item.usd_value)}
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.flatListContent}
      />

      {/* Fixed bottom button */}
      <View style={styles.bottomButton}>
        <Button
          type="primary"
          title="Buy"
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
  header: {
    height: 38,
    marginBottom: 12,
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
    marginTop: 24,
    alignItems: 'center',
  },
  price: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  priceChange: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    marginTop: 4,
  },
  section: {
    marginTop: 32,
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
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
  buyItem: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 12,
    marginBottom: 8,
  },
  buyItemLeft: {
    flex: 1,
  },
  buyItemRight: {
    alignItems: 'flex-end',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profitLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  profitValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  buyLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  buyAmount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 2,
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
}));
