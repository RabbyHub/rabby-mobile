import { groupBy, minBy, range } from 'lodash';
import React, {
  useMemo,
  useRef,
  useCallback,
  useImperativeHandle,
  type Ref,
} from 'react';
import {
  FlatList,
  Platform,
  StyleProp,
  View,
  ViewStyle,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { HistoryItem } from './HistoryItem';
import { SkeletonCard } from './SkeletonCard';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { TransactionGroup } from '@/core/services/transactionHistory';
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
import { Account } from '@/types/account';

const isIOS = Platform.OS === 'ios';

interface DisplayHistoryItem {
  isDateStart?: boolean;
  time: number;
  data: HistoryDisplayItem | TransactionGroup;
}

export type HistoryListHeaderComponent =
  FlatListProps<DisplayHistoryItem>['ListHeaderComponent'];

function markFirstItems(
  arr: (HistoryDisplayItem | TransactionGroup)[],
): DisplayHistoryItem[] {
  if (arr.length === 0) {
    return [];
  }

  const result: DisplayHistoryItem[] = [];
  let prevDateKey = '';

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];

    const time =
      'time_at' in item && item.time_at
        ? item.time_at * 1000
        : 'completedAt' in item && item.completedAt
        ? item.completedAt
        : Date.now();

    const date = new Date(time);
    const currentDateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    const isDateStart = i === 0 || currentDateKey !== prevDateKey;

    result.push({
      data: item,
      time,
      isDateStart,
    });

    prevDateKey = currentDateKey;
  }

  return result;
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
  style,
  ListHeaderComponent,
  emptyComponent,
  onScroll,
  scrollEventThrottle,
  ref,
}: {
  firstFetchDone?: boolean;
  historySuccessList?: string[];
  localTxList?: TransactionGroup[];
  list: (HistoryDisplayItem | TransactionGroup)[];
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
  style?: StyleProp<ViewStyle>;
  ListHeaderComponent?: HistoryListHeaderComponent;
  emptyComponent?: React.ReactElement | null;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  account?: Account | null;
  ref?: Ref<{ scrollToTop: () => void }>;
}) => {
  const flatListRef = useRef<FlatList>(null);

  const scrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const { getCexInfoByAddress } = useGetCexList();

  useImperativeHandle(ref, () => ({
    scrollToTop,
  }));

  const markedList = useMemo(() => {
    return markFirstItems(list);
  }, [list]);
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
    if ('project_item' in item.data) {
      return (
        <>
          {item.isDateStart ? (
            <Text
              style={[
                styles.date,
                !isForMultipleAddress && styles.marginBottom,
              ]}>
              {formatTimestamp(item.time, t)}
            </Text>
          ) : null}
          <HistoryItem
            data={item.data}
            isForMultipleAddress={isForMultipleAddress}
            getCexInfoByAddress={getCexInfoByAddress}
            onPress={onPresssItem}
            account={account}
          />
        </>
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

      return (
        <>
          {item.isDateStart ? (
            <Text
              style={[
                styles.date,
                !isForMultipleAddress && styles.marginBottom,
              ]}>
              {formatTimestamp(item.time, t)}
            </Text>
          ) : null}
          <TransactionItem
            getCexInfoByAddress={getCexInfoByAddress}
            isForMultipleAddress={isForMultipleAddress}
            historySuccessList={historySuccessList}
            data={item.data}
            canCancel={canCancel}
            onRefresh={onRefresh}
            account={account}
          />
        </>
      );
    }
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
      data={markedList}
      renderItem={renderItem}
      windowSize={5}
      initialNumToRender={Math.min(markedList.length, 20)}
      ListEmptyComponent={
        loading ? null : emptyComponent ? (
          emptyComponent
        ) : firstFetchDone ? (
          <Empty
            title={
              isNeedFetchFromApi
                ? t('page.activities.signedTx.empty.title')
                : t('page.activities.signedTx.empty.titleLastThreeMonths')
            }
          />
        ) : null
      }
      ListHeaderComponent={ListHeaderComponent}
      style={[styles.container, style]}
      keyExtractor={item =>
        'id' in item.data
          ? `${item.data.address}-${item.data.chain}-${item.data.id}`
          : `${item.data.address}-${item.data.chainId}-${item.data.maxGasTx.hash}`
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      removeClippedSubviews={true}
      ListFooterComponent={
        loadingMore ? (
          <>
            {range(0, moreLoadingLength).map(i => {
              return <SkeletonCard key={i} />;
            })}
          </>
        ) : (
          <View style={{ height: bottom + (appendBottom || 0) }} />
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
  marginBottom: {
    marginBottom: 8,
  },
  date: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    paddingLeft: 4,
    marginTop: 4,
    marginBottom: 8,
    color: colors2024['neutral-secondary'],
    lineHeight: 18,
  },
}));
