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
} from 'react-native';
import { makeTxPageBackgroundColors } from '@/constant/layout';
import { openapi } from '@/core/request';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { appIsDev } from '@/constant/env';
import { findChainByServerID } from '@/utils/chain';
import ChainIconImage from '@/components/Chain/ChainIconImage';

const DEFAULT_COUNT = 10;

export const CopyTradingScreen = () => {
  const { t } = useTranslation();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [chainIdList, setChainIdList] = useState<string[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const [tokenList, setTokenList] = useState<CopyTradeTokenItem[]>([]);
  const { styles } = useTheme2024({ getStyle: getStyles });

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

  useEffect(() => {
    initFetchData();
  }, [initFetchData]);

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
        <Text>CopyTrading</Text>
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
}));
