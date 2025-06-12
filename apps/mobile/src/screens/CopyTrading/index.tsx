/* eslint-disable react-native/no-inline-styles */
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { toast } from '@/components2024/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { makeTxPageBackgroundColors, RootNames } from '@/constant/layout';
import { openapi } from '@/core/request';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { appIsDev } from '@/constant/env';
import { findChain, findChainByServerID } from '@/utils/chain';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { TokenListItem } from './component/TokenListItem';
import { CHAINS_ENUM } from '@/constant/chains';
import { useTipsDollarDialog } from './component/hooks';
import { preferenceService } from '@/core/services/shared';

const DEFAULT_COUNT = 10;

// Mock data for demonstration - CopyTradeTokenItem format
const mockTokenData: CopyTradeTokenItem[] = [
  {
    // TokenItem base properties
    id: 'eth_0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    chain: 'eth',
    name: 'Doge',
    symbol: 'DOGE',
    display_symbol: 'DOGE',
    optimized_symbol: 'DOGE',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/coin/logo_url/doge/e13a69552b0a43c263fb5c8b49f59b92.png',
    price: 0.12345,
    amount: 1000,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    // CopyTradeTokenItem specific properties
    fdv: 19170000000, // $19.17B in actual number
    buy_amount_24h: 5674000000, // $5.674B in actual number
    buy_usd_value_24h: 5674000000,
    net_curve_24h: [
      { time_at: Date.now() / 1000 - 86400, price: 0.11 },
      { time_at: Date.now() / 1000 - 72000, price: 0.105 },
      { time_at: Date.now() / 1000 - 43200, price: 0.118 },
      { time_at: Date.now() / 1000 - 28800, price: 0.125 },
      { time_at: Date.now() / 1000 - 14400, price: 0.12 },
      { time_at: Date.now() / 1000, price: 0.12345 },
    ],
    price_24h_change: 4.4,
  },
  {
    id: 'eth',
    chain: 'eth',
    name: 'ETH',
    symbol: 'ETH',
    display_symbol: null,
    optimized_symbol: 'ETH',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/coin/logo_url/eth/6443cdccced33e204d90cb723c632917.png',
    price: 2340.56,
    amount: 100,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    fdv: 19170000000,
    buy_amount_24h: 5674000000,
    buy_usd_value_24h: 5674000000,
    net_curve_24h: [
      { time_at: Date.now() / 1000 - 86400, price: 2200 },
      { time_at: Date.now() / 1000 - 72000, price: 2180 },
      { time_at: Date.now() / 1000 - 43200, price: 2280 },
      { time_at: Date.now() / 1000 - 28800, price: 2320 },
      { time_at: Date.now() / 1000 - 14400, price: 2300 },
      { time_at: Date.now() / 1000, price: 2340.56 },
    ],
    price_24h_change: 4.4,
  },
  {
    id: 'base_0xb3f7d7b9e8f4a5c6d1e2f3a4b5c6d7e8f9a0b1c2',
    chain: 'base',
    name: 'WETH',
    symbol: 'WETH',
    display_symbol: null,
    optimized_symbol: 'WETH',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/coin/logo_url/eth/6443cdccced33e204d90cb723c632917.png',
    price: 2340.56,
    amount: 50,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    fdv: 19170000000,
    buy_amount_24h: 5674000000,
    buy_usd_value_24h: 5674000000,
    net_curve_24h: [
      { time_at: Date.now() / 1000 - 86400, price: 2200 },
      { time_at: Date.now() / 1000 - 72000, price: 2180 },
      { time_at: Date.now() / 1000 - 43200, price: 2280 },
      { time_at: Date.now() / 1000 - 28800, price: 2320 },
      { time_at: Date.now() / 1000 - 14400, price: 2300 },
      { time_at: Date.now() / 1000, price: 2340.56 },
    ],
    price_24h_change: 4.4,
  },
  {
    id: 'polygon_0xc4f6e2b3d5a7e9f1a2b3c4d5e6f7a8b9c0d1e2f3',
    chain: 'matic',
    name: 'MATIC',
    symbol: 'MATIC',
    display_symbol: 'MATIC',
    optimized_symbol: 'MATIC',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/coin/logo_url/matic/6f5a6b6f0732a7a906e676fca5d5a457.png',
    price: 0.87,
    amount: 2000,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    fdv: 19170000000,
    buy_amount_24h: 5674000000,
    buy_usd_value_24h: 5674000000,
    net_curve_24h: [
      { time_at: Date.now() / 1000 - 86400, price: 0.8 },
      { time_at: Date.now() / 1000 - 72000, price: 0.78 },
      { time_at: Date.now() / 1000 - 43200, price: 0.85 },
      { time_at: Date.now() / 1000 - 28800, price: 0.88 },
      { time_at: Date.now() / 1000 - 14400, price: 0.86 },
      { time_at: Date.now() / 1000, price: 0.87 },
    ],
    price_24h_change: 4.4,
  },
  {
    id: 'bsc_0xf5d8e7a9b2c3e4f6a7b8c9d0e1f2a3b4c5d6e7f8',
    chain: 'bsc',
    name: 'BNB',
    symbol: 'BNB',
    display_symbol: 'BNB',
    optimized_symbol: 'BNB',
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/coin/logo_url/bnb/9784283a36f23a58982fc964574ea530.png',
    price: 245.67,
    amount: 80,
    time_at: Date.now() / 1000,
    is_core: true,
    is_verified: true,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    fdv: 19170000000,
    buy_amount_24h: 5674000000,
    buy_usd_value_24h: 5674000000,
    net_curve_24h: [
      { time_at: Date.now() / 1000 - 86400, price: 270 },
      { time_at: Date.now() / 1000 - 72000, price: 275 },
      { time_at: Date.now() / 1000 - 43200, price: 260 },
      { time_at: Date.now() / 1000 - 28800, price: 250 },
      { time_at: Date.now() / 1000 - 14400, price: 248 },
      { time_at: Date.now() / 1000, price: 245.67 },
    ],
    price_24h_change: -4.4,
  },
];

export const CopyTradingScreen = () => {
  const { t } = useTranslation();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [chainIdList, setChainIdList] = useState<string[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const [tokenList, setTokenList] = useState<CopyTradeTokenItem[]>([]);
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { navigation } = useSafeSetNavigationOptions();
  const [loading, setLoading] = useState(false);

  const chainList = useMemo(() => {
    const list = chainIdList
      .map(chainId => findChainByServerID(chainId))
      .filter(item => Boolean(item?.enum));
    return list;
  }, [chainIdList]);

  const fetchChainList = useMemoizedFn(async () => {
    try {
      if (appIsDev) {
        return ['base', 'eth', 'bsc', 'matic'];
      }

      const chainIdArr = await openapi.getCopyTradingChainList();
      setChainIdList(chainIdArr);
      return chainIdArr;
    } catch (e) {
      console.debug('fetchChainList error', e);
      return [];
    }
  });

  const fetchTokenList = useMemoizedFn(
    async (chainId: string, startTime: number) => {
      try {
        console.log('fetchTokenList token_list chainId:', chainId);
        const { token_list } = await openapi.getCopyTradingTokenList({
          chain_id: chainId,
          limit: DEFAULT_COUNT,
          start_time: startTime,
        });
        return token_list;
      } catch (e) {
        console.debug('fetchTokenList error', e);
        return [];
      }
    },
  );

  const initFetchData = useMemoizedFn(async () => {
    try {
      setLoading(true);
      const chainIdArr = await fetchChainList();

      setChainIdList(chainIdArr);
      setSelectedChainId(chainIdArr[0]);
      const tokenArr = await fetchTokenList(chainIdArr[0], 0);
      setTokenList(tokenArr);
    } catch (error) {
      console.debug('initFetchData error', error);
    } finally {
      setLoading(false);
    }
  });

  const handleChainItemPress = useMemoizedFn(async (chainId: string) => {
    setSelectedChainId(chainId);
    const tokenArr = await fetchTokenList(chainId, 0);
    setTokenList(tokenArr);
  });

  const handleBuyPress = useMemoizedFn((item: CopyTradeTokenItem) => {
    const chain = findChain({
      serverId: item.chain,
    });
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.MultiSwap,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: item?.id,
        type: 'Buy',
      },
    });
  });

  const handleTokenItemPress = useMemoizedFn((item: CopyTradeTokenItem) => {
    console.log('handleTokenItemPress item', item);
  });

  const { showTipsDollarDialog } = useTipsDollarDialog();

  useEffect(() => {
    initFetchData();
  }, [initFetchData]);

  useEffect(() => {
    const hasOpenCopyTrading = preferenceService.getHasOpenCopyTrading();
    if (!hasOpenCopyTrading) {
      preferenceService.setHasOpenCopyTrading(true);
      showTipsDollarDialog();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NormalScreenContainer type="bg0">
      <View style={styles.headerContainer}>
        <ScrollView
          style={styles.headerChainList}
          contentContainerStyle={styles.scrollContentContainer}
          horizontal={true}
          showsHorizontalScrollIndicator={false}>
          {chainList.map(chain => (
            <TouchableOpacity
              key={chain?.id}
              onPress={() => handleChainItemPress(chain?.serverId ?? '')}
              style={StyleSheet.flatten([
                styles.chainItem,
                selectedChainId === chain?.serverId && styles.selectedChainItem,
              ])}>
              <ChainIconImage
                size={18}
                chainEnum={chain?.enum}
                isShowRPCStatus={true}
              />
              <Text style={styles.chainItemText}>{chain?.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.container}>
        <FlatList
          data={mockTokenData}
          renderItem={({ item }) => (
            <TokenListItem
              showTipsDollarDialog={showTipsDollarDialog}
              item={item}
              onBuyPress={handleBuyPress}
              onPress={handleTokenItemPress}
            />
          )}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      </View>
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  headerContainer: {
    height: 56,
    overflow: 'hidden',
  },

  chainItem: {
    display: 'flex',
    flexDirection: 'row',
    // alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedChainItem: {
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors2024['brand-disable'],
  },
  chainItemText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
  },
  headerChainList: {
    flexDirection: 'row',
    flex: 0,
    paddingVertical: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    gap: 8,
    // paddingLeft: 16,
    // paddingRight: 16,
  },
  container: {
    flex: 1,
    paddingBottom: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
}));
