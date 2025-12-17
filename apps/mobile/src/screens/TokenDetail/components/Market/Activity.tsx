import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  FlatList,
  Pressable,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import InfoContainer from './InfoContainer';
import EmptyData from './EmptyData';
import { MarketSummary } from '@rabby-wallet/rabby-api/dist/types';
import {
  formatPercent,
  formatAmountValueKMB,
  formatTime,
  formatUsdValueKMB,
} from '../../util';
import { formatPrice } from '@/utils/number';
import AddressView from './AddressView';
import useInfiniteScroll from 'ahooks/lib/useInfiniteScroll';
import { useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { throttle, uniqBy } from 'lodash';
import { Service } from 'ahooks/lib/useInfiniteScroll/types';
import { scrollEndCallBack } from './hooks';
import { every10sEvent } from '../../event';

interface ISummaryData {
  data?: MarketSummary;
  isEmpty: boolean;
}

const enum TabKey {
  '5m' = '5m',
  '1h' = '1h',
  '6h' = '6h',
  '24h' = '24h',
}

const Summary = ({ data, isEmpty }: ISummaryData) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(TabKey['24h']);
  const currentData = useMemo(() => data?.[activeTab], [data, activeTab]);
  const { buyFlex, sellFlex } = useMemo(() => {
    const buyVolume = currentData?.summary?.buy?.volume_amount ?? 0;
    const sellVolume = currentData?.summary?.sell?.volume_amount ?? 0;
    const total = (buyVolume || 0) + (sellVolume || 0);
    if (!total) {
      return { buyFlex: 1, sellFlex: 1 };
    }
    return {
      buyFlex: buyVolume / total,
      sellFlex: sellVolume / total,
    };
  }, [
    currentData?.summary?.buy?.volume_amount,
    currentData?.summary?.sell?.volume_amount,
  ]);

  const getTextColor = useCallback(
    (v: number) => {
      if (!v || typeof v !== 'number') {
        return colors2024['neutral-body'];
      }
      return v > 0 ? colors2024['green-default'] : colors2024['red-default'];
    },
    [colors2024],
  );

  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.summary')}>
      {isEmpty ? (
        <EmptyData />
      ) : (
        <View style={styles.summaryContainer}>
          <View style={styles.switchContainer}>
            <Pressable
              onPress={() => setActiveTab(TabKey['5m'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['5m'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>
                5{' '}
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.min',
                )}
              </Text>
              <Text
                style={[
                  styles.switchItemPercentage,
                  {
                    color: getTextColor(data?.['5m']?.price?.change ?? 0),
                  },
                ]}>
                {formatPercent(data?.['5m']?.price?.change ?? 0)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab(TabKey['1h'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['1h'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>
                1{' '}
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.hour',
                )}
              </Text>
              <Text
                style={[
                  styles.switchItemPercentage,
                  {
                    color: getTextColor(data?.['1h']?.price?.change ?? 0),
                  },
                ]}>
                {formatPercent(data?.['1h']?.price?.change ?? 0)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab(TabKey['6h'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['6h'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>
                6{' '}
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.hour',
                )}
              </Text>
              <Text
                style={[
                  styles.switchItemPercentage,
                  {
                    color: getTextColor(data?.['6h']?.price?.change ?? 0),
                  },
                ]}>
                {formatPercent(data?.['6h']?.price?.change ?? 0)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab(TabKey['24h'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['24h'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>
                24{' '}
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.hour',
                )}
              </Text>
              <Text
                style={[
                  styles.switchItemPercentage,
                  {
                    color: getTextColor(data?.['24h']?.price?.change ?? 0),
                  },
                ]}>
                {formatPercent(data?.['24h']?.price?.change ?? 0)}
              </Text>
            </Pressable>
          </View>
          <View style={styles.summaryChartContainer}>
            <View style={styles.chartLeft}>
              <View style={styles.chatTop}>
                <Text style={styles.chatTopText}>
                  {t(
                    'page.tokenDetail.marketInfo.activitySections.tableHeader.buy',
                  )}
                </Text>
                <Text style={styles.actionAmount}>
                  {formatUsdValueKMB(
                    currentData?.summary?.buy?.volume_usd_value ?? 0,
                  ) || '-'}
                </Text>
              </View>
            </View>
            <View style={styles.chartRight}>
              <View style={[styles.chatTop, styles.chatTopRight]}>
                <Text style={[styles.chatTopText, styles.chatTopTextRight]}>
                  {t(
                    'page.tokenDetail.marketInfo.activitySections.tableHeader.sell',
                  )}
                </Text>
                <Text style={[styles.actionAmount, styles.actionAmountRight]}>
                  {formatUsdValueKMB(
                    currentData?.summary?.sell?.volume_usd_value ?? 0,
                  ) || '-'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.chatBottomLineContainer}>
            <View style={[styles.chatBottomLine, { flex: buyFlex }]} />
            <View
              style={[
                styles.chatBottomLine,
                styles.chatBottomLineRight,
                { flex: sellFlex },
              ]}
            />
          </View>
          <View style={styles.summaryBottomContainer}>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.volume',
                )}
              </Text>
              <Text style={styles.summaryBottomItemValue}>
                {formatUsdValueKMB(
                  currentData?.summary?.totals?.volume_usd_value ?? 0,
                ) || '-'}
              </Text>
            </View>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.transactionCount',
                )}
              </Text>
              <Text style={styles.summaryBottomItemValue}>
                {formatAmountValueKMB(
                  currentData?.summary?.totals?.trading_count ?? 0,
                ) || '-'}
              </Text>
            </View>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.addresses',
                )}
              </Text>
              <Text style={styles.summaryBottomItemValue}>
                {formatAmountValueKMB(
                  currentData?.summary?.totals?.addresses ?? 0,
                  0,
                ) || '-'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </InfoContainer>
  );
};

const enum DetailsTabKey {
  all = 'all',
  buy = 'buy',
  sell = 'sell',
}

type MarketTradingHistoryItem = {
  id: string;
  action: 'buy' | 'sell';
  price: number;
  amount: number;
  usd_value: number;
  tx_id: string;
  user_addr: string;
  time_at: number;
};

const Details = ({
  tokenId,
  chainId,
}: {
  tokenId: string;
  chainId: string;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(DetailsTabKey.all);

  const service = useCallback(
    async (d?: {
      list: MarketTradingHistoryItem[];
      nextCursor?: string;
      hasMore: boolean;
    }) => {
      try {
        if (!tokenId || !chainId) {
          return {
            list: [],
            nextCursor: undefined,
            hasMore: false,
          };
        }
        const res = await openapi.getMarketTradingHistory({
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
        console.error('getMarketTradingHistory error:', error);
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
        list: MarketTradingHistoryItem[];
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

  useEffect(() => {
    if (
      (data?.list?.length && data?.list?.length > 20) ||
      (!data?.list && !loading)
    ) {
      return;
    }
    return every10sEvent.on(() => {
      reloadAsync();
    });
  }, [reloadAsync, data?.list?.length, data?.list, loading]);

  const list = useMemo(() => {
    return uniqBy(data?.list || [], 'id');
  }, [data?.list]);

  useEffect(() => {
    reloadAsync();
  }, [activeTab, reloadAsync]);

  const renderHeader = useCallback(() => {
    return (
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.activitySections.tableHeader.type')}|
          {t('page.tokenDetail.marketInfo.activitySections.tableHeader.time')}
        </Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.activitySections.tableHeader.price')}
        </Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.activitySections.tableHeader.qnt')}
        </Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.activitySections.tableHeader.value')}
        </Text>
        <Text style={[styles.tableHeaderItem, styles.lastItem]}>
          {t(
            'page.tokenDetail.marketInfo.activitySections.tableHeader.address',
          )}
        </Text>
      </View>
    );
  }, [styles.lastItem, styles.tableHeader, styles.tableHeaderItem, t]);

  const renderItem = useCallback(
    ({ item, index }) => {
      const isBuy = item.action === 'buy';
      return (
        <View
          key={item.id}
          style={[
            styles.tableRow,
            index === list.length - 1 && styles.hideBottomBorder,
          ]}>
          <View style={styles.actionAndTime}>
            <Text
              style={[styles.chatTopText, !isBuy && styles.chatTopTextRight]}>
              {isBuy
                ? t(
                    'page.tokenDetail.marketInfo.activitySections.tableHeader.buy',
                  )
                : t(
                    'page.tokenDetail.marketInfo.activitySections.tableHeader.sell',
                  )}
            </Text>
            <Text style={styles.timeAtItem}>{formatTime(item.time_at)}</Text>
          </View>
          <Text style={styles.indexItem}>{formatPrice(item.price)}</Text>
          <Text style={styles.ratioItem}>
            {formatAmountValueKMB(item.amount)}
          </Text>
          <Text
            style={[
              styles.amountItem,
              isBuy ? styles.amountItemGreen : styles.amountItemRed,
            ]}>
            {formatUsdValueKMB(item.usd_value)}
          </Text>
          <View style={styles.addressItem}>
            <AddressView address={item.user_addr} />
          </View>
        </View>
      );
    },
    [
      styles.tableRow,
      styles.hideBottomBorder,
      styles.actionAndTime,
      styles.chatTopText,
      styles.chatTopTextRight,
      styles.timeAtItem,
      styles.indexItem,
      styles.ratioItem,
      styles.amountItem,
      styles.amountItemGreen,
      styles.amountItemRed,
      styles.addressItem,
      list.length,
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

  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.details')}>
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
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.all',
                )}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === DetailsTabKey.buy && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(DetailsTabKey.buy)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === DetailsTabKey.buy && styles.activeTabItemText,
                ]}>
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.buy',
                )}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === DetailsTabKey.sell && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(DetailsTabKey.sell)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === DetailsTabKey.sell && styles.activeTabItemText,
                ]}>
                {t(
                  'page.tokenDetail.marketInfo.activitySections.tableHeader.sell',
                )}
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
      ) : loading ? null : (
        <EmptyData />
      )}
    </InfoContainer>
  );
};

const Activity = ({
  tokenId,
  chainId,
}: {
  tokenId: string;
  chainId: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const {
    data: summaryData,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useRequest(
    async () => {
      try {
        if (!tokenId || !chainId) {
          return undefined;
        }
        const res = await openapi.getMarketSummary({
          token_id: tokenId,
          chain_id: chainId,
        });
        return res;
      } catch (error) {
        return undefined;
      }
    },
    {
      refreshDeps: [tokenId, chainId],
    },
  );
  const isSummaryEmpty = useMemo(() => {
    return (
      !summaryLoading &&
      !summaryData?.['1h'] &&
      !summaryData?.['5m'] &&
      !summaryData?.['6h'] &&
      !summaryData?.['24h']
    );
  }, [summaryData, summaryLoading]);

  useEffect(() => {
    if (isSummaryEmpty) {
      return;
    }
    return every10sEvent.on(() => {
      refreshSummary();
    });
  }, [isSummaryEmpty, refreshSummary]);

  return (
    <View style={styles.container}>
      {(!summaryLoading || summaryData) && (
        <Summary data={summaryData} isEmpty={isSummaryEmpty} />
      )}
      <Details tokenId={tokenId} chainId={chainId} />
    </View>
  );
};

export default Activity;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    gap: 12,
  },
  summary: {
    color: colors2024['red-default'],
  },
  details: {
    color: colors2024['red-default'],
  },
  summaryContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  switchContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  switchItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  activeItem: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-4'],
    borderRadius: 8,
  },
  switchItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  switchItemPercentage: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  summaryChartContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
  },
  chartLeft: {
    flex: 1,
    gap: 12,
  },
  chartRight: {
    flex: 1,
    gap: 12,
  },
  chatTop: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTopRight: {
    justifyContent: 'flex-end',
  },
  chatTopText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: colors2024['green-light-1'],
    borderRadius: 6,
    width: 32,
    lineHeight: 26,
    height: 26,
    textAlign: 'center',
    overflow: 'hidden',
  },
  actionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  actionAmountRight: {
    color: colors2024['red-default'],
  },
  chatTopTextRight: {
    color: colors2024['red-default'],
    backgroundColor: colors2024['red-light-2'],
  },
  chatBottomLineContainer: {
    display: 'flex',
    flexDirection: 'row',
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 4,
    paddingHorizontal: 16,
    marginTop: 1,
  },
  chatBottomLine: {
    height: 4,
    borderRadius: 20,
    flex: 1,
    backgroundColor: colors2024['green-default'],
  },
  chatBottomLineRight: {
    flex: 1,
    backgroundColor: colors2024['red-default'],
  },
  summaryBottomContainer: {
    display: 'flex',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  summaryBottomItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 6,
  },
  summaryBottomItemText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  summaryBottomItemValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
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
      ? colors2024['neutral-bg-2']
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
    paddingHorizontal: 16,
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
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
    flex: 1.1,
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 12,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
    alignItems: 'center',
  },
  hideBottomBorder: {
    borderBottomWidth: 0,
  },
  indexItem: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  ratioItem: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  amountItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
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
    flex: 1.1,
  },
  timeAtItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    marginLeft: 4,
  },
  actionAndTime: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
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
  footerText: {
    fontSize: 12,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  loadMoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-4'],
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  loading: {
    paddingBottom: 10,
  },
}));
