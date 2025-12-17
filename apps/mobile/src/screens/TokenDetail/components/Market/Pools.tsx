import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  FlatList,
  Image,
} from 'react-native';
import {
  LiquidityPoolHistoryItem,
  LiquidityPoolItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { useInfiniteScroll } from 'ahooks';
import { Service } from 'ahooks/lib/useInfiniteScroll/types';
import { scrollEndCallBack } from './hooks';
import { throttle, uniqBy } from 'lodash';
import {
  formatAmountValueKMB,
  formatTime,
  formatUsdValueKMB,
} from '../../util';
import EmptyData from './EmptyData';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import { trigger } from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { getChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import { toast } from '@/components2024/Toast';
import { Skeleton } from '@rneui/themed';
import { LoadingLinear } from '../TokenPriceChart/LoadingLinear';
import { sortTokenWithSymbol } from './utils';

interface PoolsProps {
  tokenId: string;
  chainId: string;
  symbol: string;
  top5Pools: LiquidityPoolItem[];
  top5PoolsLoading: boolean;
}

const enum TabKey {
  top5 = 'top5',
  liquidityDetail = 'liquidityDetail',
}

const enum DetailsTabKey {
  all = 'all',
  add = 'add',
  remove = 'remove',
}

const LiquidityDetail = ({
  tokenId,
  chainId,
}: {
  tokenId: string;
  chainId: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(DetailsTabKey.all);
  const [isInitialized, setIsInitialized] = useState(false);

  const service = useCallback(
    async (d?: {
      list: LiquidityPoolHistoryItem[];
      nextCursor?: string;
      hasMore: boolean;
    }) => {
      try {
        const res = await openapi.getLiquidityPoolHistoryList({
          token_id: tokenId,
          chain_id: chainId,
          action: activeTab === DetailsTabKey.all ? undefined : activeTab,
          limit: 20,
          cursor: d?.nextCursor,
        });
        const page = res?.pagination || {};
        const merged = [...(res?.data_list || [])];
        return {
          list: merged,
          nextCursor: page?.next_cursor,
          hasMore: !!page?.has_next,
        };
      } catch (error) {
        console.error('getLiquidityPoolHistoryList error:', error);
        return {
          list: [],
          nextCursor: undefined,
          hasMore: false,
        };
      }
    },
    [activeTab, chainId, tokenId],
  );

  const { data, loadMore, reloadAsync, loading, loadingMore } =
    useInfiniteScroll(
      service as Service<{
        list: LiquidityPoolHistoryItem[];
        nextCursor?: string;
        hasMore: boolean;
      }>,
      {
        isNoMore: d => {
          if (d && d?.list?.length >= 200) {
            return true;
          }
          return d ? !d.hasMore : false;
        },
        manual: true,
      },
    );

  useEffect(() => {
    scrollEndCallBack.cb = throttle(loadMore, 1000);
  }, [loadMore]);

  const list = useMemo(() => {
    return uniqBy(data?.list || [], 'id');
  }, [data?.list]);

  useLayoutEffect(() => {
    setIsInitialized(false);
    reloadAsync().finally(() => {
      setIsInitialized(true);
    });
  }, [activeTab, reloadAsync]);

  const onOpenTxHash = useCallback(
    (txHash?: string) => {
      const info = typeof chainId === 'string' ? getChain(chainId) : chainId;

      if (info?.scanLink) {
        openTxExternalUrl({ chain: info, txHash });
      } else {
        toast.error('Unknown chain');
      }
    },
    [chainId],
  );

  const renderHeader = useCallback(() => {
    return (
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.pool.headers.time')}
        </Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.pool.headers.amount')}
        </Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.pool.headers.value')}
        </Text>
        <Text style={[styles.tableHeaderItem, styles.lastItem]} />
      </View>
    );
  }, [styles.lastItem, styles.tableHeader, styles.tableHeaderItem, t]);

  const renderItem = useCallback(
    ({ item, index }) => {
      const isAdd = item.action === 'add';
      return (
        <View
          key={item.id}
          style={[
            styles.tableRow,
            index === list.length - 1 && styles.hideBottomBorder,
          ]}>
          <View style={styles.actionAndTime}>
            <View style={styles.chatTop}>
              <Text
                style={[styles.chatTopText, !isAdd && styles.chatTopTextRight]}>
                {isAdd
                  ? t('page.tokenDetail.marketInfo.pool.actions.add')
                  : t('page.tokenDetail.marketInfo.pool.actions.remove')}
              </Text>
            </View>
            <Text style={styles.timeAtItem}>{formatTime(item.time_at)}</Text>
          </View>
          <View style={styles.ratioItem}>
            {item.tokens.map(token => (
              <Text key={token.symbol} style={styles.ratioItemText}>
                <Text
                  style={
                    isAdd ? styles.ratioItemTextAdd : styles.ratioItemTextRemove
                  }>
                  {isAdd ? '+' : '-'} {formatAmountValueKMB(token.amount)}
                </Text>{' '}
                {token.symbol}
              </Text>
            ))}
          </View>
          <Text style={[styles.amountItem]}>
            {formatUsdValueKMB(item.usd_value)}
          </Text>
          <View style={styles.addressItem}>
            <Pressable
              onPress={() => {
                onOpenTxHash(item.tx_id);
              }}>
              <RcIconJumpCC
                width={12}
                height={12}
                color={colors2024['neutral-foot']}
              />
            </Pressable>
          </View>
        </View>
      );
    },
    [
      styles.tableRow,
      styles.hideBottomBorder,
      styles.actionAndTime,
      styles.chatTop,
      styles.chatTopText,
      styles.chatTopTextRight,
      styles.timeAtItem,
      styles.ratioItem,
      styles.amountItem,
      styles.addressItem,
      styles.ratioItemText,
      styles.ratioItemTextAdd,
      styles.ratioItemTextRemove,
      list.length,
      colors2024,
      onOpenTxHash,
      t,
    ],
  );
  const footerRef = useRef<any>(null);
  const renderFooter = useCallback(() => {
    return (
      <View
        ref={footerRef}
        style={[styles.footerContainer, !loadingMore && styles.hideFooter]}>
        {loadingMore && (
          <ActivityIndicator
            style={styles.loading}
            color={colors2024['neutral-body']}
            size="small"
          />
        )}
      </View>
    );
  }, [
    colors2024,
    loadingMore,
    styles.footerContainer,
    styles.hideFooter,
    styles.loading,
  ]);

  if ((loading || !isInitialized) && !list.length) {
    return (
      <Skeleton
        style={styles.skeletonBlock}
        LinearGradientComponent={LoadingLinear}
      />
    );
  }

  return (
    <View style={styles.detailWrapper}>
      {list.length > 0 ? (
        <View style={styles.detailsContainer}>
          <View style={styles.switchTabs}>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === DetailsTabKey.all && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(DetailsTabKey.all)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === DetailsTabKey.all && styles.activeTabItemText,
                ]}>
                {t('page.tokenDetail.marketInfo.pool.actions.all')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === DetailsTabKey.add && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(DetailsTabKey.add)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === DetailsTabKey.add && styles.activeTabItemText,
                ]}>
                {t('page.tokenDetail.marketInfo.pool.actions.add')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === DetailsTabKey.remove &&
                  styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(DetailsTabKey.remove)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === DetailsTabKey.remove &&
                    styles.activeTabItemText,
                ]}>
                {t('page.tokenDetail.marketInfo.pool.actions.remove')}
              </Text>
            </Pressable>
          </View>
          <FlatList
            data={list}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.tableBody}
            ListHeaderComponent={renderHeader}
            nestedScrollEnabled={true}
            scrollEnabled={false}
            ListFooterComponent={renderFooter}
          />
        </View>
      ) : (
        <EmptyData />
      )}
    </View>
  );
};

const Top5Pools = ({
  data,
  loading,
  symbol,
}: {
  data: LiquidityPoolItem[];
  loading: boolean;
  symbol: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const handleCopyAddress = useCallback((address: string) => {
    if (!address) {
      return;
    }
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    Clipboard.setString(address);
    toastCopyAddressSuccess(address);
  }, []);

  if (loading) {
    return (
      <Skeleton
        style={styles.skeletonBlock}
        LinearGradientComponent={LoadingLinear}
      />
    );
  }

  return (
    <View style={styles.holderContainer}>
      {data?.length === 0 ? (
        <EmptyData />
      ) : (
        <View style={styles.details}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderItem, styles.firstItem]}>
              {t('page.tokenDetail.marketInfo.pool.dex')}
            </Text>
            <Text style={styles.tableHeaderItem}>
              {t('page.tokenDetail.marketInfo.pool.pair')}
            </Text>
            <Text style={styles.tableHeaderItem}>
              {t('page.tokenDetail.marketInfo.pool.amount')}
            </Text>
            <Text style={[styles.tableHeaderItem, styles.valueItem]}>
              {t('page.tokenDetail.marketInfo.pool.value')}
            </Text>
          </View>
          <View style={styles.tableBody}>
            {data?.map((item, index) => {
              const sortedTokens = sortTokenWithSymbol(item.tokens, symbol);
              return (
                <View
                  key={item.id}
                  style={[
                    styles.tableRow,
                    index === data.length - 1 && styles.hideBottomBorder,
                  ]}>
                  <View style={styles.indexItem}>
                    <Image
                      source={{ uri: item?.project?.logo_url }}
                      style={styles.indexItemImage}
                    />
                    <Pressable
                      style={styles.projectNameContainer}
                      onPress={() => handleCopyAddress(item?.pool_id)}>
                      <Text style={styles.projectName}>
                        {item?.project?.name}
                      </Text>
                      <RcIconCopy width={10} height={10} style={styles.copy} />
                    </Pressable>
                  </View>
                  <View style={styles.pairNames}>
                    {sortedTokens.map((token, _index) => (
                      <Text
                        key={`${token.symbol}_${_index}`}
                        style={[
                          styles.pairName,
                          _index === 0 && styles.firstPairName,
                        ]}>
                        {token.symbol}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.amountItems}>
                    {sortedTokens.map((token, _index) => (
                      <Text
                        key={`${token.symbol}_${_index}`}
                        style={[
                          styles.amountItemValue,
                          _index === 0 && styles.firstAmountItemValue,
                        ]}>
                        {formatAmountValueKMB(token.amount)}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.usdValueItem}>
                    <Text style={styles.poolUsdValue}>
                      {formatUsdValueKMB(item.usd_value)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const Pools = ({
  tokenId,
  chainId,
  symbol,
  top5Pools,
  top5PoolsLoading,
}: PoolsProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(TabKey.top5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setActiveTabKey(TabKey.top5)}>
          <Text
            style={[
              styles.headerText,
              activeTabKey === TabKey.top5 && styles.activeText,
            ]}>
            {t('page.tokenDetail.marketInfo.pool.tab.top5')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTabKey(TabKey.liquidityDetail)}>
          <Text
            style={[
              styles.headerText,
              activeTabKey === TabKey.liquidityDetail && styles.activeText,
            ]}>
            {t('page.tokenDetail.marketInfo.pool.tab.liquidityDetail')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {activeTabKey === TabKey.top5 && (
          <Top5Pools
            data={top5Pools}
            loading={top5PoolsLoading}
            symbol={symbol}
          />
        )}
        {activeTabKey === TabKey.liquidityDetail && (
          <LiquidityDetail tokenId={tokenId} chainId={chainId} />
        )}
      </View>
    </View>
  );
};

export default Pools;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
  },
  header: {
    gap: 9.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 6,
    overflow: 'hidden',
  },
  content: {
    marginTop: 16,
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableHeaderItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  lastItem: {
    textAlign: 'right',
    flex: 0,
  },
  valueItem: {
    flex: 1,
    textAlign: 'right',
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
    alignItems: 'center',
  },
  hideBottomBorder: {
    borderBottomWidth: 0,
  },
  actionAndTime: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  chatTopRight: {
    justifyContent: 'flex-end',
  },
  chatTop: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTopText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: colors2024['green-light-1'],
    borderRadius: 6,
    lineHeight: 26,
    height: 26,
    textAlign: 'center',
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  chatTopTextRight: {
    color: colors2024['red-default'],
    backgroundColor: colors2024['red-light-2'],
  },
  timeAtItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  indexItem: {
    flex: 1.3,
    gap: 2,
  },
  ratioItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  ratioItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  ratioItemTextAdd: {
    color: colors2024['green-default'],
  },
  ratioItemTextRemove: {
    color: colors2024['red-default'],
  },
  pairNames: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  pairName: {
    display: 'flex',
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  firstPairName: {
    color: colors2024['neutral-title-1'],
  },
  amountItem: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  amountItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  usdValueItem: {
    flex: 1,
    textAlign: 'right',
  },
  poolUsdValue: {
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  firstAmountItemValue: {
    color: colors2024['neutral-title-1'],
  },
  amountItemGreen: {
    color: colors2024['green-default'],
  },
  amountItemRed: {
    color: colors2024['red-default'],
  },
  addressItem: {
    display: 'flex',
    justifyContent: 'flex-end',
    flex: 0,
  },
  loading: {
    paddingBottom: 10,
  },
  footerContainer: {
    height: 40,
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hideFooter: {
    height: 0,
  },
  switchTabs: {
    display: 'flex',
    flexDirection: 'row',
    marginTop: 12,
  },
  switchTabItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 30,
  },
  switchTabItemActive: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-line']
      : colors2024['neutral-bg-4'],
  },
  switchTabItemText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  activeTabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  detailsContainer: {
    display: 'flex',
    flexDirection: 'column',
    paddingHorizontal: 12,
    gap: 12,
  },
  detailWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 0,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  firstItem: {
    flex: 1.3,
  },
  holderContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 2,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  indexItemImage: {
    width: 24,
    height: 24,
    borderRadius: 1000,
  },
  projectNameContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  projectName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    maxWidth: 80,
  },
  copy: {},
  skeletonBlock: {
    height: 250,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
}));
