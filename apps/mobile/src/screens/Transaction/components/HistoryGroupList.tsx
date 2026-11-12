import { groupBy, minBy, range } from 'lodash';
import React, {
  useMemo,
  useRef,
  useCallback,
  useImperativeHandle,
  type Ref,
} from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import {
  FlatList,
  Platform,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { HistoryItem } from './HistoryItem';
import { SkeletonCard } from './SkeletonCard';
import { renderStickyRowScrollView } from './StickyRowScrollView';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import type { TransactionGroup } from '@/core/services/transactionHistory';
import type { HistoryDisplayItem } from '@/types/history';
import { Empty } from '../components/Empty';
import { formatTimestamp } from '@/utils/time';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetCexList } from '../hook';
import { useMemoizedFn } from 'ahooks';
import { Text } from '@/components/Typography';
import type { Account } from '@/types/account';
import {
  isBridgeHistoryRow,
  type BridgeAwareHistoryItem,
  type BridgeHistoryRow,
} from '../utils/bridgeHistory';

const isIOS = Platform.OS === 'ios';

type DisplayHistoryItem =
  | { type: 'date'; key: string; time: number }
  | { type: 'tx'; time: number; data: BridgeAwareHistoryItem };

export type HistoryListHeaderComponent =
  FlatListProps<DisplayHistoryItem>['ListHeaderComponent'];

/** One row per transaction, with a date row in front of each day's first one. */
function buildRows(arr: BridgeAwareHistoryItem[]) {
  const rows: DisplayHistoryItem[] = [];
  const dateIndices: number[] = [];
  let prevDateKey = '';

  for (const item of arr) {
    const time =
      'time_at' in item && item.time_at
        ? item.time_at * 1000
        : 'completedAt' in item && item.completedAt
        ? item.completedAt
        : Date.now();

    const date = new Date(time);
    const currentDateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (currentDateKey !== prevDateKey) {
      // local rows are not strictly time-ordered, so a day can start more than
      // once; the ordinal keeps the keys unique
      const key = `date-${dateIndices.length}-${currentDateKey}`;
      dateIndices.push(rows.length);
      rows.push({ type: 'date', key, time });
    }
    rows.push({ type: 'tx', time, data: item });

    prevDateKey = currentDateKey;
  }

  return { rows, dateIndices };
}

export const HistoryList = ({
  loading,
  firstFetchDone,
  historySuccessList,
  loadingMore,
  loadMore,
  refreshLoading,
  list,
  localTxList,
  onRefresh,
  onPresssItem,
  isForMultipleAddress = true,
  account,
  isNeedFetchFromApi,
  appendBottom,
  moreLoadingLength = 1,
  noMoreText,
  style,
  ListHeaderComponent,
  stickyDateBackgroundColor,
  emptyComponent,
  onScroll,
  scrollEventThrottle,
  renderBridgeItem,
  onVisibleItemsChange,
  ref,
}: {
  firstFetchDone?: boolean;
  historySuccessList?: string[];
  localTxList?: TransactionGroup[];
  list: BridgeAwareHistoryItem[];
  loading?: boolean;
  loadingMore?: boolean;
  refreshLoading?: boolean;
  isForMultipleAddress?: boolean;
  onPresssItem?: (data: HistoryDisplayItem) => void;
  loadMore?: () => void;
  onRefresh?: () => void;
  isNeedFetchFromApi?: boolean;
  appendBottom?: number;
  moreLoadingLength?: number;
  /** shown under the last item once there is nothing left to load */
  noMoreText?: string;
  style?: StyleProp<ViewStyle>;
  ListHeaderComponent?: HistoryListHeaderComponent;
  /**
   * Keeps the current day's date pinned to the top while its rows scroll under
   * it. The date is painted with this color to cover those rows, so pass the
   * background of the page the list sits on.
   */
  stickyDateBackgroundColor?: ColorValue;
  emptyComponent?: React.ReactElement | null;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  renderBridgeItem?: (row: BridgeHistoryRow) => React.ReactNode;
  onVisibleItemsChange?: (items: BridgeAwareHistoryItem[]) => void;
  account?: Account | null;
  ref?: Ref<{ scrollToTop: () => void }>;
}) => {
  const flatListRef = useRef<FlatList>(null);
  const onViewableItemsChanged = useMemoizedFn(
    ({ viewableItems }: { viewableItems: ViewToken<DisplayHistoryItem>[] }) =>
      onVisibleItemsChange?.(
        viewableItems.flatMap(({ item }) =>
          item.type === 'tx' ? [item.data] : [],
        ),
      ),
  );

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const { getCexInfoByAddress } = useGetCexList();

  useImperativeHandle(ref, () => ({
    scrollToTop,
  }));

  const { rows, dateIndices } = useMemo(() => buildRows(list), [list]);
  const isStickyDate = !!stickyDateBackgroundColor;
  // FlatList counts ListHeaderComponent as index 0
  const headerOffset = ListHeaderComponent ? 1 : 0;
  const stickyHeaderIndices = useMemo(
    () =>
      isStickyDate ? dateIndices.map(index => index + headerOffset) : undefined,
    [isStickyDate, dateIndices, headerOffset],
  );
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const minLocalTxNonceByChain = useMemo(() => {
    const pendingGroup = localTxList?.filter(i => i.isPending);
    if (!pendingGroup?.length) {
      return {};
    }

    const tempObj: Record<string, number> = {};
    Object.entries(
      groupBy(pendingGroup, i => `${i.address}-${i.chainId}`),
    ).forEach(([key, txs]) => {
      tempObj[key] = minBy(txs, i => i.nonce)?.nonce || 0;
    });
    return tempObj;
  }, [localTxList]);

  const renderItem = useMemoizedFn(({ item }: { item: DisplayHistoryItem }) => {
    if (item.type === 'date') {
      return (
        <Text
          style={[
            styles.date,
            isStickyDate && { backgroundColor: stickyDateBackgroundColor },
          ]}>
          {formatTimestamp(item.time, t)}
        </Text>
      );
    }

    let content: React.ReactNode;
    if (isBridgeHistoryRow(item.data)) {
      content = renderBridgeItem?.(item.data);
    } else if ('project_item' in item.data) {
      content = (
        <HistoryItem
          data={item.data}
          isForMultipleAddress={isForMultipleAddress}
          getCexInfoByAddress={getCexInfoByAddress}
          onPress={onPresssItem}
          account={account}
        />
      );
    } else {
      // const canCancel =
      //   minBy(
      //     localTxList?.filter(
      //       i =>
      //         i.chainId === (item.data as TransactionGroup).chainId &&
      //         i.isPending,
      //     ) || [],
      //     i => i.nonce,
      //   )?.nonce === item.data.nonce;
      const canCancel =
        minLocalTxNonceByChain[`${item.data.address}-${item.data.chainId}`] ===
        item.data.nonce;

      content = (
        <TransactionItem
          getCexInfoByAddress={getCexInfoByAddress}
          isForMultipleAddress={isForMultipleAddress}
          historySuccessList={historySuccessList}
          data={item.data}
          canCancel={canCancel}
          onRefresh={onRefresh}
          account={account}
        />
      );
    }
    return <>{content}</>;
  });

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        {range(0, 8).map(i => {
          return <SkeletonCard key={i} />;
        })}
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={rows}
      renderItem={renderItem}
      stickyHeaderIndices={stickyHeaderIndices}
      renderScrollComponent={
        isStickyDate ? renderStickyRowScrollView : undefined
      }
      windowSize={5}
      initialNumToRender={Math.min(rows.length, 20)}
      ListEmptyComponent={
        loading ? null : emptyComponent ? (
          emptyComponent
        ) : firstFetchDone ? (
          <Empty
            title={
              isNeedFetchFromApi
                ? t('page.activities.signedTx.empty.titleNoTransactions')
                : t('page.activities.signedTx.empty.titleInLast90Days')
            }
          />
        ) : null
      }
      ListHeaderComponent={ListHeaderComponent}
      style={[styles.container, style]}
      keyExtractor={item =>
        item.type === 'date'
          ? item.key
          : isBridgeHistoryRow(item.data)
          ? item.data.key
          : 'id' in item.data
          ? `${item.data.address}-${item.data.chain}-${item.data.id}`
          : `${item.data.address}-${item.data.chainId}-${item.data.maxGasTx?.hash}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      onScroll={onScroll}
      onViewableItemsChanged={
        onVisibleItemsChange ? onViewableItemsChanged : undefined
      }
      scrollEventThrottle={scrollEventThrottle}
      // Android: React Native turns clipping off by itself once a list has
      // sticky headers. Doing that on a mounted list drops the rows that are
      // clipped at that moment and the next insert crashes, so pinned dates
      // start with it off rather than switch when the first rows arrive.
      removeClippedSubviews={!(isStickyDate && Platform.OS === 'android')}
      ListFooterComponent={
        loadingMore ? (
          <>
            {range(0, moreLoadingLength).map(i => {
              return <SkeletonCard key={i} />;
            })}
          </>
        ) : (
          <>
            {noMoreText && rows.length ? (
              <View style={styles.noMore}>
                <View style={styles.noMoreLine} />
                <Text style={styles.noMoreText}>{noMoreText}</Text>
                <View style={styles.noMoreLine} />
              </View>
            ) : null}
            <View style={{ height: bottom + (appendBottom || 0) }} />
          </>
        )
      }
      refreshControl={
        onRefresh && (
          <RefreshControl
            {...(isIOS && {
              progressViewOffset: -12,
            })}
            refreshing={refreshLoading || false}
            onRefresh={onRefresh}
          />
        )
      }
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 15,
    flex: 1,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'column',
    gap: 12,
  },
  addressInfo: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 12,
  },
  aliasName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-secondary'],
    marginLeft: 4,
  },
  date: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    // padding rather than margin, so a sticky date's background covers the gaps
    paddingLeft: 4,
    paddingTop: 4,
    paddingBottom: 8,
    color: colors2024['neutral-secondary'],
    lineHeight: 18,
  },
  noMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    // keep clear of the screen edge where the bottom inset is 0 (Android)
    paddingBottom: 20,
  },
  noMoreLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
  noMoreText: {
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
}));
