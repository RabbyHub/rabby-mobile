import { minBy, range } from 'lodash';
import React, {
  useMemo,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { FlatList, Platform, View, Text } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import dayjs from 'dayjs';
import { HistoryItem } from './HistoryItem';
import { SkeletonCard } from './SkeletonCard';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { Empty } from '../components/Empty';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { formatTimestamp } from '@/utils/time';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isIOS = Platform.OS === 'ios';

interface DisplayHistoryItem {
  isDateStart?: boolean;
  time: number;
  data: HistoryDisplayItem | TransactionGroup;
}

function markFirstItems(
  arr: (HistoryDisplayItem | TransactionGroup)[],
): DisplayHistoryItem[] {
  if (arr.length === 0) {
    return [];
  }
  const newArr: DisplayHistoryItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const newItem: DisplayHistoryItem = {
      data: item,
      time:
        ('time_at' in item ? item.time_at * 1000 : undefined) ||
        ('completedAt' in item && item.completedAt
          ? item.completedAt
          : new Date().getTime()),
    };

    const prev = arr[i - 1];

    if (i === 0) {
      newItem.isDateStart = true;
    } else {
      if ('isPending' in prev && 'projectDict' in item) {
        // remove same item from local tx and db history list
        const curId = `${item.address.toLowerCase()}-${item.id}`;
        const preId = `${prev.address.toLowerCase()}-${prev.maxGasTx.hash}`;
        if (curId === preId) {
          continue;
        }
      }

      // judgs is date start
      const curDate = dayjs(newItem.time);
      const prevTime =
        ('time_at' in prev ? prev.time_at * 1000 : undefined) ||
        ('completedAt' in prev && prev.completedAt
          ? prev.completedAt
          : new Date().getTime());
      const prevDate = dayjs(prevTime); // get time at
      if (!curDate.isSame(prevDate, 'date')) {
        newItem.isDateStart = true;
      }
    }

    // if ('projectDict' in item) {
    //   const prev = arr[i - 1];
    //   if (i === 0) {
    //     newItem.isDateStart = true;
    //   } else if ('projectDict' in prev) {
    //     const curDate = dayjs(item.time_at * 1000);
    //     const prevDate = dayjs(prev.time_at * 1000);
    //     if (!curDate.isSame(prevDate, 'date')) {
    //       newItem.isDateStart = true;
    //     }
    //   } else if ('isPending' in prev) {
    //     if (prev.isPending) {
    //       // pending time is set current time
    //       const curDate = dayjs(item.time_at * 1000);
    //       const prevDate = dayjs(new Date().getTime());
    //       if (!curDate.isSame(prevDate, 'date')) {
    //         newItem.isDateStart = true;
    //       }
    //     } else {
    //       const curDate = dayjs(item.time_at * 1000);
    //       const prevDate = dayjs(prev.completedAt);
    //       if (!curDate.isSame(prevDate, 'date')) {
    //         newItem.isDateStart = true;
    //       }
    //     }
    //   }
    // }
    // if ('isPending' in item) {
    //   if (item.isPending) {
    //     newItem.isDateStart = false;
    //     i === 0 && (newItem.isFirst = true);
    //   } else {
    //     const prev = arr[i - 1];
    //     if (i === 0) {
    //       newItem.isDateStart = true;
    //     } else if ('isPending' in prev && !prev.isPending) {
    //       const curDate = dayjs(item.completedAt);
    //       const prevDate = dayjs(prev.completedAt);
    //       if (!curDate.isSame(prevDate, 'date')) {
    //         newItem.isDateStart = true;
    //       }
    //     } else if ('projectDict' in prev) {
    //       const curDate = dayjs(item.completedAt);
    //       const prevDate = dayjs(prev.time_at * 1000);
    //       if (!curDate.isSame(prevDate, 'date')) {
    //         newItem.isDateStart = true;
    //       }
    //     }
    //   }
    // }
    newArr.push(newItem);
  }

  return newArr;
}

const AddressInfo = ({ account }: { account?: KeyringAccountWithAlias }) => {
  const { styles } = useTheme2024({ getStyle });
  if (account) {
    return (
      <View style={styles.addressInfo}>
        <WalletIcon
          type={account.type}
          width={16}
          height={16}
          borderRadius={4}
        />
        <Text style={styles.aliasName}>{account.aliasName}</Text>
      </View>
    );
  }
  return null;
};

export const HistoryList = forwardRef(
  (
    {
      loading,
      ensureCurrentNoDbData,
      historySuccessList,
      loadingMore,
      loadMore,
      refreshLoading,
      list,
      localTxList,
      onRefresh,
      isForMultipleAdderss = true,
      onPresssItem,
    }: {
      ensureCurrentNoDbData?: boolean;
      historySuccessList?: string[];
      localTxList?: TransactionGroup[];
      list?: (HistoryDisplayItem | TransactionGroup)[];
      loading?: boolean;
      loadingMore?: boolean;
      refreshLoading?: boolean;
      isForMultipleAdderss?: boolean;
      onPresssItem?: (data: HistoryDisplayItem) => void;
      loadMore?: () => void;
      onRefresh?: () => void;
    },
    ref,
  ) => {
    const flatListRef = useRef<FlatList>(null);

    const scrollToTop = useCallback(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, []);

    useImperativeHandle(ref, () => ({
      scrollToTop,
    }));

    const markedList = useMemo(() => {
      return markFirstItems(list || []);
    }, [list]);
    const { styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const { bottom } = useSafeAreaInsets();

    const renderItem = ({ item }: { item: DisplayHistoryItem }) => {
      if ('projectDict' in item.data) {
        return (
          <>
            {item.isDateStart ? (
              <Text
                style={[
                  styles.date,
                  !isForMultipleAdderss && styles.marginBottom,
                ]}>
                {formatTimestamp(item.time, t)}
              </Text>
            ) : null}
            <HistoryItem
              data={item.data}
              isForMultipleAdderss={isForMultipleAdderss}
              projectDict={item.data.projectDict}
              cateDict={item.data.cateDict}
              tokenDict={item.data.tokenDict || {}}
              onPresss={onPresssItem}
            />
          </>
        );
      } else {
        const canCancel =
          minBy(
            localTxList?.filter(
              i =>
                i.chainId === (item.data as TransactionGroup).chainId &&
                i.isPending,
            ) || [],
            i => i.nonce,
          )?.nonce === item.data.nonce;

        return (
          <>
            {item.isDateStart ? (
              <Text
                style={[
                  styles.date,
                  !isForMultipleAdderss && styles.marginBottom,
                ]}>
                {formatTimestamp(item.time, t)}
              </Text>
            ) : null}
            <TransactionItem
              isForMultipleAdderss={isForMultipleAdderss}
              historySuccessList={historySuccessList}
              data={item.data}
              canCancel={canCancel}
              onRefresh={onRefresh}
            />
          </>
        );
      }
    };

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
        removeClippedSubviews
        data={markedList}
        renderItem={renderItem}
        windowSize={5}
        ListEmptyComponent={
          loading ? null : ensureCurrentNoDbData ? <Empty /> : null
        }
        style={styles.container}
        onEndReached={loadMore}
        onEndReachedThreshold={0.8}
        ListFooterComponent={
          loadingMore ? <SkeletonCard /> : <View style={{ height: bottom }} />
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
  },
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    paddingHorizontal: 15,
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
    marginBottom: 12,
  },
  date: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 8,
    marginTop: 12,
    marginBottom: 8,
    color: colors2024['neutral-secondary'],
    lineHeight: 18,
  },
}));
