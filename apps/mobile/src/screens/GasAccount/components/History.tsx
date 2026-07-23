import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  FlatList,
  Animated,
  Easing,
  ListRenderItem,
  TouchableOpacity,
  Image,
  InteractionManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatUsdValue } from '@/utils/number';
import { Skeleton } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconHistoryLoading from '@/assets/icons/gas-account/IconHistoryLoading.svg';
import { sinceTime } from '@/utils/time';
import { useGasAccountHistory } from '../hooks';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IconGift from '@/assets2024/icons/home/IconGift.svg';
import { GiftInfoModal } from './GiftInfoModal';
import ImgEmpty from '@/assets2024/images/gasAccount/empty.png';
import ImgEmptyDark from '@/assets2024/images/gasAccount/empty-dark.png';
import { Text } from '@/components/Typography';
import { StyleProp, ViewStyle } from 'react-native';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';

type GasAccountHistoryState = ReturnType<typeof useGasAccountHistory>;
const HISTORY_END_REACHED_THRESHOLD = 0.6;
type GasAccountPendingHistoryItem =
  GasAccountHistoryState['txList']['rechargeList'][number];
type GasAccountConfirmedHistoryItem =
  GasAccountHistoryState['txList']['list'][number];

const getPendingHistoryKey = ({
  item,
  type,
  index,
}: {
  item: GasAccountPendingHistoryItem;
  type: 'recharge' | 'withdraw';
  index: number;
}) =>
  [
    'pending',
    type,
    item.tx_id || 'no-tx',
    item.chain_id || 'no-chain',
    item.user_addr || 'no-user',
    item.gas_account_id || 'no-gas-account',
    item.create_at,
    index,
  ].join('-');

const traceGasAccountHistory = (
  event: string,
  data: Record<string, unknown> = {},
) => {
  traceStartupDiagnostic('gas-account', event, data);
};

const PendingHistorySpinner = React.memo(function PendingHistorySpinner() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [transAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    transAnim.setValue(0);
    const animation = Animated.loop(
      Animated.timing(transAnim, {
        toValue: 360,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => {
      animation.stop();
      transAnim.stopAnimation();
    };
  }, [transAnim]);

  const rotate = transAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        ...styles.pendingIcon,
        transform: [{ rotate }],
      }}>
      <RcIconHistoryLoading width={16} height={16} />
    </Animated.View>
  );
});

type HistoryItemProps = {
  time: number;
  value: number;
  sign: string;
  isPending?: boolean;
  borderT?: boolean;
  isWithdraw?: boolean;
  source?: string;
  onGiftIconPress?: () => void;
};

const HistoryItem = React.memo(function HistoryItem({
  time,
  isPending = false,
  value = 0,
  sign = '-',
  borderT = false,
  isWithdraw = false,
  source,
  onGiftIconPress,
}: HistoryItemProps) {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const showGiftIcon = source === 'gas_account_airdrop';

  return (
    <TouchableOpacity
      onPress={showGiftIcon ? onGiftIconPress : undefined}
      style={[
        styles.historyItem,
        borderT && styles.borderTop,
        isPending && styles.pendingHistoryItem,
      ]}>
      <View style={styles.leftContainer}>
        {isPending ? (
          <View style={styles.pendingContainer}>
            <PendingHistorySpinner />
            <Text style={styles.pendingText}>
              {isWithdraw
                ? t('page.gasAccount.withdraw')
                : t('page.gasAccount.deposit')}
            </Text>
          </View>
        ) : (
          <Text style={styles.timeText}>{sinceTime(time)}</Text>
        )}
      </View>
      {showGiftIcon && (
        <TouchableOpacity
          style={styles.giftIconContainer}
          activeOpacity={0.7}
          onPress={onGiftIconPress}>
          <IconGift width={18} height={18} />
        </TouchableOpacity>
      )}
      <Text style={styles.valueText}>
        {sign}
        {formatUsdValue(value)}
      </Text>
    </TouchableOpacity>
  );
});

const LoadingItem = ({ borderT }: { borderT?: boolean }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={[styles.historyItem, borderT && styles.borderTop]}>
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
      <Skeleton width={68} height={16} style={styles.skeletonStyle} />
    </View>
  );
};

type GasAccountHistoryProps = {
  style?: StyleProp<ViewStyle>;
  listStyle?: StyleProp<ViewStyle>;
};

export const GasAccountHistory = React.memo<GasAccountHistoryProps>(
  function GasAccountHistory({ style, listStyle }) {
    const renderStartedAt = Date.now();
    const { t } = useTranslation();
    const historyState = useGasAccountHistory();
    const { loading, loadingMore, txList, loadMore, noMore, hasHistory } =
      historyState;
    const { styles, isLight } = useTheme2024({ getStyle: getStyles });
    const [isModalVisible, setIsModalVisible] = useState(false);
    const listHeightRef = useRef(0);
    const contentHeightRef = useRef(0);
    const renderSeqRef = useRef(0);
    const itemRenderCountRef = useRef(0);
    const hasUserScrolledRef = useRef(false);
    const autoLoadMoreTaskRef = useRef<ReturnType<
      typeof InteractionManager.runAfterInteractions
    > | null>(null);
    const autoLoadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const hasRechargeHistory = Boolean(txList?.rechargeList.length);

    const { bottom } = useSafeAreaInsets();

    const handleGiftIconPress = useCallback(() => {
      setIsModalVisible(true);
    }, []);

    const handleCloseGiftInfo = useCallback(() => {
      setIsModalVisible(false);
    }, []);

    const ListEmptyComponent = useMemo(
      () =>
        loading ? (
          <>
            {Array.from({ length: 10 }).map((_, idx) => (
              <LoadingItem key={idx} borderT={idx !== 0} />
            ))}
          </>
        ) : null,
      [loading],
    );

    const ListEndLoader = useCallback(() => {
      if (!loadingMore || noMore) {
        return null;
      }
      return <LoadingItem borderT />;
    }, [loadingMore, noMore]);

    const clearScheduledAutoLoadMore = useCallback(() => {
      autoLoadMoreTaskRef.current?.cancel();
      autoLoadMoreTaskRef.current = null;
      if (autoLoadMoreTimerRef.current) {
        clearTimeout(autoLoadMoreTimerRef.current);
        autoLoadMoreTimerRef.current = null;
      }
    }, []);

    const canAutoLoadMore = useCallback(() => {
      if (
        loading ||
        loadingMore ||
        noMore ||
        !listHeightRef.current ||
        !contentHeightRef.current
      ) {
        return false;
      }

      return (
        contentHeightRef.current - listHeightRef.current <=
        listHeightRef.current * HISTORY_END_REACHED_THRESHOLD
      );
    }, [loading, loadingMore, noMore]);

    const scheduleAutoLoadMore = useCallback(() => {
      if (!canAutoLoadMore() || autoLoadMoreTaskRef.current) {
        return;
      }

      traceGasAccountHistory('history_auto_load_more_scheduled', {
        listHeight: listHeightRef.current,
        contentHeight: contentHeightRef.current,
        confirmedCount: txList?.list.length || 0,
        rechargeCount: txList?.rechargeList.length || 0,
        withdrawCount: txList?.withdrawList.length || 0,
      });

      autoLoadMoreTaskRef.current = InteractionManager.runAfterInteractions(
        () => {
          autoLoadMoreTimerRef.current = setTimeout(() => {
            autoLoadMoreTaskRef.current = null;
            autoLoadMoreTimerRef.current = null;

            if (!canAutoLoadMore()) {
              return;
            }

            traceGasAccountHistory('history_auto_load_more', {
              listHeight: listHeightRef.current,
              contentHeight: contentHeightRef.current,
              confirmedCount: txList?.list.length || 0,
              rechargeCount: txList?.rechargeList.length || 0,
              withdrawCount: txList?.withdrawList.length || 0,
            });
            loadMore();
          }, 600);
        },
      );
    }, [
      canAutoLoadMore,
      loadMore,
      txList?.list.length,
      txList?.rechargeList.length,
      txList?.withdrawList.length,
    ]);

    useEffect(() => {
      return clearScheduledAutoLoadMore;
    }, [clearScheduledAutoLoadMore]);

    const handleEndReached = useCallback(() => {
      if (!hasUserScrolledRef.current) {
        traceGasAccountHistory('history_end_reached_ignored', {
          listHeight: listHeightRef.current,
          contentHeight: contentHeightRef.current,
          confirmedCount: txList?.list.length || 0,
          rechargeCount: txList?.rechargeList.length || 0,
          withdrawCount: txList?.withdrawList.length || 0,
        });
        return;
      }

      traceGasAccountHistory('history_end_reached', {
        confirmedCount: txList?.list.length || 0,
        rechargeCount: txList?.rechargeList.length || 0,
        withdrawCount: txList?.withdrawList.length || 0,
      });
      loadMore();
    }, [
      loadMore,
      txList?.list.length,
      txList?.rechargeList.length,
      txList?.withdrawList.length,
    ]);

    useEffect(() => {
      scheduleAutoLoadMore();
    }, [
      scheduleAutoLoadMore,
      txList?.list.length,
      txList?.rechargeList.length,
      txList?.withdrawList.length,
    ]);

    const sourceByTxKey = useMemo(() => {
      const map = new Map<string, string | undefined>();
      txList?.list?.forEach(item => {
        map.set(`${item.tx_id}-${item.chain_id}`, item.source);
      });
      return map;
    }, [txList?.list]);

    const shouldShowTopBorder = useCallback(
      (index: number) => (hasRechargeHistory ? true : index !== 0),
      [hasRechargeHistory],
    );

    useEffect(() => {
      renderSeqRef.current += 1;
      traceGasAccountHistory('history_render_commit', {
        seq: renderSeqRef.current,
        renderCommitMs: Date.now() - renderStartedAt,
        loading,
        loadingMore,
        noMore,
        hasHistory,
        confirmedCount: txList?.list.length || 0,
        rechargeCount: txList?.rechargeList.length || 0,
        withdrawCount: txList?.withdrawList.length || 0,
        listHeight: listHeightRef.current,
        contentHeight: contentHeightRef.current,
      });
    });

    itemRenderCountRef.current = 0;

    const ListHeaderComponent = useCallback(() => {
      return (
        <>
          {!loading &&
            txList?.withdrawList?.map((item, index) => {
              return (
                <HistoryItem
                  isWithdraw={true}
                  key={getPendingHistoryKey({
                    item,
                    type: 'withdraw',
                    index,
                  })}
                  time={item.create_at}
                  value={item.amount}
                  sign={'-'}
                  borderT={shouldShowTopBorder(index)}
                  isPending={true}
                  source={sourceByTxKey.get(`${item.tx_id}-${item.chain_id}`)}
                  onGiftIconPress={handleGiftIconPress}
                />
              );
            })}
          {!loading &&
            txList?.rechargeList?.map((item, index) => {
              return (
                <HistoryItem
                  key={getPendingHistoryKey({
                    item,
                    type: 'recharge',
                    index,
                  })}
                  time={item.create_at}
                  value={item.amount}
                  sign={'+'}
                  borderT={true}
                  isPending={true}
                  source={sourceByTxKey.get(`${item.tx_id}-${item.chain_id}`)}
                  onGiftIconPress={handleGiftIconPress}
                />
              );
            })}
        </>
      );
    }, [
      loading,
      shouldShowTopBorder,
      txList?.rechargeList,
      txList?.withdrawList,
      handleGiftIconPress,
      sourceByTxKey,
    ]);

    const renderItem: ListRenderItem<GasAccountConfirmedHistoryItem> =
      useCallback(
        ({ item, index }) => {
          itemRenderCountRef.current += 1;
          if (itemRenderCountRef.current <= 5) {
            traceGasAccountHistory('history_render_item', {
              index,
              renderCountInCommit: itemRenderCountRef.current,
              historyType: item.history_type,
              hasSource: !!item.source,
            });
          }

          return (
            <HistoryItem
              time={item.create_at}
              value={item.usd_value}
              sign={item.history_type === 'recharge' ? '+' : '-'}
              borderT={shouldShowTopBorder(index)}
              source={item.source}
              onGiftIconPress={handleGiftIconPress}
            />
          );
        },
        [handleGiftIconPress, shouldShowTopBorder],
      );

    if (!loading && !hasHistory) {
      return (
        <View
          style={[
            styles.container,
            styles.emptyContainer,
            style,
            isLight ? styles.containerLight : styles.containerDark,
          ]}>
          <View style={styles.emptyContent}>
            <Image
              source={isLight ? ImgEmpty : ImgEmptyDark}
              style={styles.emptyImg}
              resizeMode="contain"
            />
            <Text style={styles.emptyText}>
              {t('page.gasAccount.history.noHistory')}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <>
        <FlatList
          style={[
            styles.container,
            listStyle,
            { marginBottom: bottom },
            style,
            isLight ? styles.containerLight : styles.containerDark,
          ]}
          data={txList?.list}
          contentInset={{ bottom: 12 }}
          onLayout={event => {
            listHeightRef.current = event.nativeEvent.layout.height;
            traceGasAccountHistory('history_list_layout', {
              height: listHeightRef.current,
              confirmedCount: txList?.list.length || 0,
              rechargeCount: txList?.rechargeList.length || 0,
              withdrawCount: txList?.withdrawList.length || 0,
            });
            scheduleAutoLoadMore();
          }}
          onContentSizeChange={(_, height) => {
            contentHeightRef.current = height;
            traceGasAccountHistory('history_content_size', {
              height,
              listHeight: listHeightRef.current,
              confirmedCount: txList?.list.length || 0,
              rechargeCount: txList?.rechargeList.length || 0,
              withdrawCount: txList?.withdrawList.length || 0,
            });
            scheduleAutoLoadMore();
          }}
          ListHeaderComponent={ListHeaderComponent}
          renderItem={renderItem}
          extraData={txList?.rechargeList.length}
          keyExtractor={item =>
            `${item.tx_id}-${item.chain_id}-${item.id || item.user_addr}-${
              item.create_at
            }`
          }
          onScrollBeginDrag={() => {
            hasUserScrolledRef.current = true;
          }}
          onMomentumScrollBegin={() => {
            hasUserScrolledRef.current = true;
          }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={HISTORY_END_REACHED_THRESHOLD}
          ListFooterComponent={ListEndLoader}
          ListEmptyComponent={ListEmptyComponent}
        />
        <GiftInfoModal
          visible={isModalVisible}
          snapPoints={[209]}
          header={
            <View style={styles.giftInfoHeader}>
              <IconGift width={18} height={18} />
              <Text style={styles.giftInfoHeaderText}>
                {t('component.gasAccount.giftInfo.giftTips')}
              </Text>
            </View>
          }
          onClose={handleCloseGiftInfo}
        />
      </>
    );
  },
);

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  containerLight: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  containerDark: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
  },
  pendingHistoryItem: {
    height: 64,
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 100,
    padding: 10,
    borderWidth: 1,
    borderColor: colors2024['orange-light-2'],
  },
  pendingIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  pendingText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 19.73,
    letterSpacing: 0.447,
    color: colors2024['orange-default'],
  },
  externalIcon: {
    width: 12,
    height: 12,
  },
  timeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  valueText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
    color: colors2024['neutral-title-1'],
  },
  giftInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
  },
  giftInfoHeaderText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  skeletonStyle: {
    height: 16,
    borderRadius: 4,
    width: 68,
  },
  borderTop: {},

  emptyImg: {
    marginTop: 36,
    width: 163,
    height: 126,
  },

  emptyContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  emptyContainer: {
    height: 234,
  },

  emptyText: {
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 20,
  },

  skeletonBlock: {
    width: '100%',
    height: 210,
    padding: 0,
    borderRadius: 6,
    marginBottom: 12,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  giftIconContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
