import React, {
  useCallback,
  useEffect,
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
import { LiquidityPoolHistoryItem } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { useInfiniteScroll, useRequest } from 'ahooks';
import { Service } from 'ahooks/lib/useInfiniteScroll/types';
import { scrollEndCallBack } from './hooks';
import { throttle, uniqBy } from 'lodash';
import { every10sEvent } from '../../event';
import {
  formatAmountValueKMB,
  formatPercent,
  formatTime,
  formatUsdValueKMB,
} from '../../util';
import AddressView from './AddressView';
import { formatPrice } from '@/utils/number';
import InfoContainer from './InfoContainer';
import EmptyData from './EmptyData';
import { pools as mockPools } from './mock';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import { trigger } from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';

interface PoolsProps {
  tokenId: string;
  chainId: string;
}

const enum TabKey {
  top5 = 'top5',
  liquidityDetail = 'liquidityDetail',
}

const enum DetailsTabKey {
  all = 'all',
  buy = 'add',
  sell = 'remove',
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

  const service = useCallback(
    async (d?: {
      list: LiquidityPoolHistoryItem[];
      nextCursor?: string;
      hasMore: boolean;
    }) => {
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
    return uniqBy(data?.list, 'id');
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
    </View>
  );
};

const Top5Pools = ({
  chainId,
  tokenId,
}: {
  chainId: string;
  tokenId: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  // const { data, loading } = useRequest(async () => {
  //   const res = await openapi.getLiquidityPoolList({
  //     token_id: tokenId,
  //     chain_id: chainId,
  //   });
  //   return res;
  // });

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

  return (
    <View style={styles.holderContainer}>
      <View style={styles.details}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderItem, styles.firstItem]}>Dex</Text>
          <Text style={styles.tableHeaderItem}>Pair</Text>
          <Text style={styles.tableHeaderItem}>Amount</Text>
          <Text style={[styles.tableHeaderItem, styles.lastItem]}>Value</Text>
        </View>
        <View style={styles.tableBody}>
          {mockPools?.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.tableRow,
                index === mockPools.length - 1 && styles.hideBottomBorder,
              ]}>
              <View style={styles.indexItem}>
                <Image
                  source={{ uri: item.project.logo_url }}
                  style={styles.indexItemImage}
                />
                <Pressable
                  style={styles.projectNameContainer}
                  onPress={() => handleCopyAddress(item.project.id)}>
                  <Text style={styles.projectName}>{item.project.name}</Text>
                  <RcIconCopy width={10} height={10} style={styles.copy} />
                </Pressable>
              </View>
              <View style={styles.pairNames}>
                {item.tokens.map((token, _index) => (
                  <Text
                    key={token.symbol}
                    style={[
                      styles.pairName,
                      _index === 0 && styles.firstPairName,
                    ]}>
                    {token.symbol}
                  </Text>
                ))}
              </View>
              <View style={styles.amountItems}>
                {item.tokens.map((token, _index) => (
                  <Text
                    key={token.symbol}
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
          ))}
        </View>
      </View>
    </View>
  );
};

const Pools = ({ tokenId, chainId }: PoolsProps) => {
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
            Top 5 pools
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTabKey(TabKey.liquidityDetail)}>
          <Text
            style={[
              styles.headerText,
              activeTabKey === TabKey.liquidityDetail && styles.activeText,
            ]}>
            Liquidity Detail
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {activeTabKey === TabKey.top5 && (
          <Top5Pools chainId={chainId} tokenId={tokenId} />
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
    flex: 1,
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
  actionAndTime: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  chatTopRight: {
    justifyContent: 'flex-end',
  },
  chatTopText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: colors2024['green-light-4'],
    borderRadius: 6,
    width: 32,
    lineHeight: 26,
    height: 26,
    textAlign: 'center',
    overflow: 'hidden',
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
    flex: 1,
    gap: 2,
  },
  ratioItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
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
    fontWeight: '500',
    color: colors2024['green-default'],
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
    flex: 1.1,
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
  detailWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  firstItem: {
    flex: 0,
    width: 80,
  },
  holderContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
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
  },
  copy: {},
}));
