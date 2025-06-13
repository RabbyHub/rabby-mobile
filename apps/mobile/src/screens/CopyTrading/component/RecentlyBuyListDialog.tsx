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
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import RcIconArrowDownCC from '@/assets2024/icons/copyTrading/IconDownPolygon.svg';
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
import {
  CopyAddressIcon,
  toastCopyAddressSuccess,
} from '@/components/AddressViewer/CopyAddress';
import { toast } from '@/components2024/Toast';
import Clipboard from '@react-native-clipboard/clipboard';
import { CopyTradePnlItem } from '@rabby-wallet/rabby-api/dist/types';

// Mock data for profit history - using CopyTradePnlItem format
const mockUserProfitHistory: CopyTradePnlItem[] = [
  {
    id: 'eth_0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    chain: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    display_symbol: 'ETH',
    optimized_symbol: 'ETH',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/coin/logo_url/eth/6443cdccced33e204d90cb723c632917.png',
    price: 2500,
    amount: 1.5,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    profit_usd: 1200,
  },
  {
    id: 'eth_0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    chain: 'eth',
    name: 'Wrapped BTC',
    symbol: 'WBTC',
    display_symbol: 'WBTC',
    optimized_symbol: 'WBTC',
    decimals: 8,
    logo_url:
      'https://static.debank.com/image/eth_token/logo_url/0x2260fac5e5542a773aa44fbcfedf7c193bc2c599/756de8d45fd7a6ce701e3fd4585a2010.png',
    price: 42000,
    amount: 0.1,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    profit_usd: 800,
  },
  {
    id: 'eth_0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    chain: 'eth',
    name: 'Aave',
    symbol: 'AAVE',
    display_symbol: 'AAVE',
    optimized_symbol: 'AAVE',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/eth_token/logo_url/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9/61e56f93e583456641682b5c63ecb3f1.png',
    price: 80,
    amount: 10,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    profit_usd: 300,
  },
  {
    id: 'eth_0x514910771af9ca656af840dff83e8264ecf986ca',
    chain: 'eth',
    name: 'Chainlink',
    symbol: 'LINK',
    display_symbol: 'LINK',
    optimized_symbol: 'LINK',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/eth_token/logo_url/0x514910771af9ca656af840dff83e8264ecf986ca/69bb6c5c6c38d7e63c4f9dfd4b8c8e6f.png',
    price: 15,
    amount: 100,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    profit_usd: 400,
  },
];

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
  const { colors2024, styles } = useTheme2024({ getStyle });

  // Transform data for chart
  const chartData = data.map(point => ({
    timestamp: point.time_at * 1000, // Convert to milliseconds
    value: point.price,
  }));

  const pathColor = isPositive
    ? colors2024['green-default']
    : colors2024['red-default'];

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

// Update interface for expanded address data
interface ExpandedAddressData {
  loading: boolean;
  data: CopyTradePnlItem[] | null;
}

// Add skeleton item component
const ProfitHistorySkeletonItem = () => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.profitHistoryItem}>
      <View style={styles.profitHistoryLeft}>
        <View
          style={[
            styles.skeletonCircle,
            { backgroundColor: colors2024['neutral-line'] },
          ]}
        />
        <View
          style={[
            styles.skeletonText,
            styles.skeletonSymbol,
            { backgroundColor: colors2024['neutral-line'] },
          ]}
        />
      </View>
      <View
        style={[
          styles.skeletonText,
          styles.skeletonValue,
          { backgroundColor: colors2024['neutral-line'] },
        ]}
      />
    </View>
  );
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
        limit: 50,
      });
      return res;
    } catch (e) {
      console.debug('fetchRecentBuyList error', e);
    }
  });

  const { data: recentBuyList } = useRequest(async () => {
    const res = await fetchRecentBuyList();
    return res;
  });

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
            {formatPercentage(tradingTokenItem.price_24h_change)}
          </Text>
          <Text style={styles.priceChangeLabel}>24h</Text>
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
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <IconDollar width={20} height={20} />
            <Text style={styles.priceChangeLabel}>
              {`${recentBuyList?.total || 0} ${t(
                'page.copyTrading.smartMoneyWallets',
              )}`}
            </Text>
          </View>
          <Text style={styles.priceChangeLabel}>
            {t('page.copyTrading.recentBuy')}
          </Text>
        </View>
      </View>
    ),
    [
      styles,
      tradingTokenItem.price,
      tradingTokenItem.price_24h_change,
      tradingTokenItem.net_curve_24h,
      isPositive,
      colors2024,
      formatPercentage,
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

  const handleCopyAddress = useMemoizedFn((address: string) => {
    Clipboard.setString(address);
    toastCopyAddressSuccess(address);
  });

  // Change to Set to support multiple expanded addresses
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(
    new Set(),
  );
  const [profitHistoryCache, setProfitHistoryCache] = useState<
    Record<string, ExpandedAddressData>
  >({});

  // Add fetchProfitHistory function
  const fetchProfitHistory = async (address: string) => {
    try {
      if (appIsDev) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return mockUserProfitHistory;
      }
      const res = await openapi.getCopyTradingPnlList({
        user_addr: address,
      });
      return res?.pnl_list || [];
    } catch (error) {
      console.error('fetchProfitHistory error:', error);
      return [];
    }
  };

  // Update toggleProfitHistory function
  const toggleProfitHistory = async (address: string) => {
    const isCurrentlyExpanded = expandedAddresses.has(address);

    if (isCurrentlyExpanded) {
      // Just collapse this address
      setExpandedAddresses(prev => {
        const next = new Set(prev);
        next.delete(address);
        return next;
      });
    } else {
      // Expand this address and load data if not cached
      setExpandedAddresses(prev => {
        const next = new Set(prev);
        next.add(address);
        return next;
      });

      if (!profitHistoryCache[address]?.data) {
        // Set loading state
        setProfitHistoryCache(prev => ({
          ...prev,
          [address]: {
            loading: true,
            data: null,
          },
        }));

        // Fetch data
        const historyData = await fetchProfitHistory(address);

        // Cache the fetched data
        setProfitHistoryCache(prev => ({
          ...prev,
          [address]: {
            loading: false,
            data: historyData,
          },
        }));
      }
    }
  };

  // Update renderProfitHistory function
  const renderProfitHistory = (address: string) => {
    const expandedData = profitHistoryCache[address];
    const isExpanded = expandedAddresses.has(address);

    if (!isExpanded) {
      return null;
    }

    return (
      <View style={styles.profitHistoryContainer}>
        <View style={styles.triangleContainer}>
          <View style={styles.triangle} />
        </View>
        <View style={styles.profitHistoryContent}>
          {expandedData?.loading ? (
            <>
              <ProfitHistorySkeletonItem />
              <ProfitHistorySkeletonItem />
              <ProfitHistorySkeletonItem />
              <ProfitHistorySkeletonItem />
            </>
          ) : (
            expandedData?.data?.map((historyItem, index) => (
              <View key={historyItem.id} style={styles.profitHistoryItem}>
                <View style={styles.profitHistoryLeft}>
                  <AssetAvatar
                    logo={historyItem.logo_url}
                    size={22}
                    chain={historyItem.chain}
                    chainSize={10}
                  />
                  <Text style={styles.profitHistorySymbol}>
                    {getTokenSymbol(historyItem)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.profitHistoryValue,
                    {
                      color: colors2024['green-default'],
                    },
                  ]}>
                  +{formatUsdValueKMB(historyItem.profit_usd)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderBuyItem = useMemoizedFn(
    ({ item }: { item: CopyTradeRecentBuyItem }) => {
      const isExpanded = expandedAddresses.has(item.user_addr);

      return (
        <View style={styles.buyItemContainer}>
          <View style={styles.buyItem}>
            <View style={styles.buyItemContent}>
              <View style={styles.buyItemLeft}>
                <TouchableOpacity
                  onPress={() => handleCopyAddress(item.user_addr)}
                  style={styles.addressContainer}>
                  <Text style={styles.address}>
                    {ellipsisAddress(item.user_addr)}
                  </Text>
                  <RcIconCopy
                    width={14}
                    height={14}
                    color={colors2024['neutral-secondary']}
                  />
                </TouchableOpacity>
                <View style={styles.profitRow}>
                  <TouchableOpacity
                    style={styles.profitLabelContainer}
                    onPress={() => toggleProfitHistory(item.user_addr)}>
                    <RcIconArrowDownCC
                      width={10}
                      height={8}
                      color={colors2024['neutral-title-1']}
                      style={[
                        styles.arrowIcon,
                        isExpanded && styles.arrowIconRotated,
                      ]}
                    />
                    <Text style={styles.profitLabel}>
                      {t('page.copyTrading.historyProfit')}
                    </Text>
                    <Text
                      style={[
                        styles.profitValue,
                        {
                          color: colors2024['green-default'],
                        },
                      ]}>
                      +{formatUsdValueKMB(item.user_addr_pnl.profit_usd)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.buyItemRight}>
                <Text style={styles.buyLabel}>{t('page.copyTrading.buy')}</Text>
                <Text style={styles.buyAmount}>
                  {formatUsdValueKMB(item.usd_value)}
                </Text>
              </View>
            </View>

            {/* Expanded profit history - inside the card */}
            {isExpanded && renderProfitHistory(item.user_addr)}
          </View>
        </View>
      );
    },
  );

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
        renderItem={renderBuyItem}
        contentContainerStyle={styles.flatListContent}
      />

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
  buyItemContainer: {
    marginBottom: 12,
  },
  buyItem: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  buyItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buyItemLeft: {
    flex: 1,
  },
  buyItemRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexDirection: 'row',
  },
  address: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  copyButton: {
    width: 14,
    height: 14,
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  profitLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  profitValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['green-default'],
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
    // marginTop: 2,
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
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profitLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandedContent: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    gap: 12,
    paddingVertical: 12,
  },
  profitHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
  },
  profitHistoryItem_last: {
    marginBottom: 0,
  },
  profitHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profitHistorySymbol: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  profitHistoryValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  triangleContainer: {
    position: 'absolute',
    left: 120,
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
    borderBottomColor: colors2024['neutral-bg-2'],
  },
  skeletonCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  skeletonText: {
    height: 12,
    borderRadius: 6,
  },
  skeletonSymbol: {
    width: 36,
  },
  skeletonValue: {
    width: 48,
  },
  profitHistoryContainer: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  profitHistoryContent: {
    gap: 12,
  },
  arrowIcon: {
    transform: [{ rotate: '0deg' }],
  },
  arrowIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
}));
