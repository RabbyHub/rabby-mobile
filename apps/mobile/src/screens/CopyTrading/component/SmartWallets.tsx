/* eslint-disable react-native/no-inline-styles */
import React, { useState, useCallback, useEffect } from 'react';
import { Text, View, TouchableOpacity, Image } from 'react-native';
import IconEmptyDefi from '@/assets2024/singleHome/empty-defi.png';
import IconEmptyDefiDark from '@/assets2024/singleHome/empty-defi-dark.png';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  CopyTradeRecentBuyItemV2,
  CopyTradeTokenItemV2,
} from '@rabby-wallet/rabby-api/dist/types';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import { useMemoizedFn } from 'ahooks';
import { openapi } from '@/core/request';
import { ellipsisAddress } from '@/utils/address';
import {
  formatUsdValueKMB,
  formatUsdValueKMBWithSign,
} from '@/screens/Home/utils/price';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { Skeleton } from '@rneui/themed';
import { toast } from '@/components2024/Toast';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';

interface SmartWalletsProps {
  tradingTokenItem: CopyTradeTokenItemV2;
}

const LIMIT = 20;

export const SkeletonStatsCard = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.statsCard}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Skeleton
            circle
            width={20}
            height={20}
            style={styles.skeleton}
            LinearGradientComponent={LoadingLinear}
          />
          <Skeleton
            width={80}
            height={16}
            style={{ borderRadius: 4, marginLeft: 4, ...styles.skeleton }}
            LinearGradientComponent={LoadingLinear}
          />
        </View>
        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Skeleton
            width={70}
            height={16}
            style={{ borderRadius: 4, ...styles.skeleton }}
            LinearGradientComponent={LoadingLinear}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.statItem}>
          <Skeleton
            width={60}
            height={16}
            style={{ borderRadius: 4, ...styles.skeleton }}
            LinearGradientComponent={LoadingLinear}
          />
        </View>
      </View>
    </View>
  );
};

export const SkeletonWalletItem = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.walletItem}>
      <View style={styles.walletLeft}>
        <View style={styles.walletInfo}>
          <Skeleton
            width={60}
            height={16}
            style={{ borderRadius: 4, ...styles.skeleton }}
            LinearGradientComponent={LoadingLinear}
          />
          <View style={styles.walletAddressContainer}>
            <Skeleton
              width={120}
              height={20}
              style={{ borderRadius: 4, ...styles.skeleton }}
              LinearGradientComponent={LoadingLinear}
            />
          </View>
        </View>
      </View>

      <View style={styles.walletRight}>
        <Skeleton
          width={80}
          height={18}
          style={{ borderRadius: 4, ...styles.skeleton }}
          LinearGradientComponent={LoadingLinear}
        />
        <Skeleton
          width={70}
          height={18}
          style={{ borderRadius: 4, marginTop: 4, ...styles.skeleton }}
          LinearGradientComponent={LoadingLinear}
        />
      </View>
    </View>
  );
};

export const SkeletonSmartWallets = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <SkeletonStatsCard />

        <View style={styles.listHeaderContainer}>
          <Skeleton
            width={100}
            height={18}
            style={{ borderRadius: 4, ...styles.skeleton }}
            LinearGradientComponent={LoadingLinear}
          />
          <Skeleton
            width={80}
            height={18}
            style={{ borderRadius: 4, ...styles.skeleton }}
            LinearGradientComponent={LoadingLinear}
          />
        </View>
      </View>

      <View style={styles.contentContainer}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonWalletItem key={index} />
        ))}
      </View>
    </View>
  );
};

export const SmartWallets: React.FC<SmartWalletsProps> = ({
  tradingTokenItem,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [buyList, setBuyList] = useState<CopyTradeRecentBuyItemV2[]>([]);
  const [cursor, setCursor] = useState<string>('');
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);

  const loadInitialData = useMemoizedFn(async () => {
    if (!tradingTokenItem?.chain || !tradingTokenItem?.id) {
      return;
    }

    try {
      setIsInitialLoading(true);
      const { recent_buy_list, pagination } =
        await openapi.getCopyTradingRecentBuyListV2({
          chain_id: tradingTokenItem.chain,
          token_id: tradingTokenItem.id,
          limit: LIMIT,
          cursor: '',
        });

      setBuyList(recent_buy_list || []);
      setCursor(pagination?.next_cursor || '');
      setHasMore(!!pagination?.has_next);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setBuyList([]);
    } finally {
      setIsInitialLoading(false);
    }
  });

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMoreData = useMemoizedFn(async () => {
    if (!hasMore || isLoadingMore || !cursor) {
      return;
    }

    try {
      setIsLoadingMore(true);
      const { recent_buy_list, pagination } =
        await openapi.getCopyTradingRecentBuyListV2({
          chain_id: tradingTokenItem.chain,
          token_id: tradingTokenItem.id,
          limit: LIMIT,
          cursor: cursor,
        });

      setBuyList(prevList => [...prevList, ...(recent_buy_list || [])]);
      setCursor(pagination?.next_cursor || '');
      setHasMore(!!pagination?.has_next);
    } catch (e) {
      console.error('Failed to load more data:', e);
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingMore(false);
    }
  });

  const handleEndReached = useMemoizedFn(() => {
    loadMoreData();
  });

  const handleCopyAddress = useMemoizedFn((address: string) => {
    Clipboard.setString(address);
    toastCopyAddressSuccess(address);
  });

  const statsData = React.useMemo(() => {
    const totalBought = buyList.reduce(
      (sum, item) => sum + item.buy_usd_value,
      0,
    );
    const totalEarned = buyList.reduce(
      (sum, item) => sum + item.pnl_usd_value,
      0,
    );
    return {
      walletCount: tradingTokenItem.buy_address_count || buyList.length,
      totalBought: tradingTokenItem.buy_usd_value || totalBought,
      totalEarned: tradingTokenItem.pnl_usd_value || totalEarned,
    };
  }, [tradingTokenItem, buyList]);

  const renderWalletItem = useMemoizedFn(
    ({ item }: { item: CopyTradeRecentBuyItemV2 }) => (
      <View style={styles.walletItem}>
        <View style={styles.walletLeft}>
          <View style={styles.walletInfo}>
            <Text style={styles.walletNickname}>
              {dayjs((item.last_buy_at as unknown as number) * 1000).format(
                'MM/DD HH:mm',
              )}
            </Text>
            <TouchableOpacity
              style={styles.walletAddressContainer}
              onPress={() => handleCopyAddress(item.user_addr)}>
              <Text style={styles.walletAddress}>
                {ellipsisAddress(item.user_addr)}
              </Text>
              <RcIconCopy
                width={14}
                height={14}
                color={colors2024['neutral-secondary']}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.walletRight}>
          <Text style={[styles.walletBuyUsdValue]}>
            {`${t('page.copyTrading.buy')} ${formatUsdValueKMB(
              item.buy_usd_value,
            )}`}
          </Text>
          <Text
            style={[
              styles.walletProfit,
              {
                color:
                  item.pnl_usd_value >= 0
                    ? colors2024['green-default']
                    : colors2024['red-default'],
              },
            ]}>
            {`${t(
              item.pnl_usd_value >= 0
                ? 'page.copyTrading.earn'
                : 'page.copyTrading.loss',
            )} ${formatUsdValueKMBWithSign(item.pnl_usd_value)}`}
          </Text>
        </View>
      </View>
    ),
  );

  const renderFooter = () => {
    // if (!hasMore && !isLoading) {
    //   return (
    //     <View style={styles.emptyFooter}>
    //       <Text style={styles.emptyText}>No More data</Text>
    //     </View>
    //   );
    // }

    if (!isLoadingMore) {
      return null;
    }

    return (
      <View style={styles.loadingFooter}>
        <SkeletonWalletItem />
        <SkeletonWalletItem />
      </View>
    );
  };

  const renderEmptyComponent = () => {
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={isLight ? IconEmptyDefi : IconEmptyDefiDark}
          style={styles.image}
        />
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  };

  if (isInitialLoading) {
    return <SkeletonSmartWallets />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Image
                source={require('@/assets2024/icons/home/IconDollar.png')}
                style={styles.dollarIcon}
              />
              <Text style={styles.statValue}>
                {statsData.walletCount} {t('page.copyTrading.smartWallets')}
              </Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatUsdValueKMB(statsData.totalBought)}{' '}
                {t('page.copyTrading.bought')}
              </Text>
            </View>

            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      statsData.totalEarned >= 0
                        ? colors2024['green-default']
                        : colors2024['red-default'],
                  },
                ]}>
                {formatUsdValueKMBWithSign(statsData.totalEarned)}{' '}
                {statsData.totalEarned >= 0
                  ? t('page.copyTrading.earned')
                  : t('page.copyTrading.loss')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.listHeaderContainer}>
          <Text style={styles.listHeaderLeft}>
            {t('page.copyTrading.timeSmartWallet')}
          </Text>
          <Text style={styles.listHeaderRight}>
            {t('page.copyTrading.buyEarn')}
          </Text>
        </View>
      </View>
      <BottomSheetFlatList
        data={buyList}
        keyExtractor={item => `${item.user_addr}_${item.last_buy_at}`}
        renderItem={renderWalletItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyComponent}
        removeClippedSubviews={true}
        initialNumToRender={LIMIT}
        maxToRenderPerBatch={LIMIT}
        windowSize={10}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  contentContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
  },
  headerContainer: {
    // marginBottom: 16,
  },
  statsCard: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dollarIcon: {
    width: 20,
    height: 20,
    marginRight: -2,
  },
  statValue: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  listHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  listHeaderLeft: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  listHeaderRight: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  walletAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletInfo: {
    flex: 1,
    gap: 4,
  },
  walletNickname: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
  },
  walletAddress: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  walletRight: {
    alignItems: 'flex-end',
  },
  walletBuyUsdValue: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  walletProfit: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['green-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingVertical: 12,
    // gap: 8,
  },
  emptyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  initialLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  image: {
    width: 163,
    height: 126,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: colors2024['neutral-info'],
    marginHorizontal: 4,
  },
  skeleton: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
}));
