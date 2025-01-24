import { minBy, range } from 'lodash';
import React, { useMemo } from 'react';
import { Animated, Platform, View, Text } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import dayjs from 'dayjs';
import { HistoryItem } from './HistoryItem';
import { SkeletonCard } from './SkeletonCard';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { formatTimestamp } from '@/utils/time';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

const isIOS = Platform.OS === 'ios';

interface DisplayHistoryItem {
  isFirst: boolean;
  isDateStart?: boolean;
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
      isFirst: false,
      data: item,
    };
    if (i === 0) {
      newItem.isFirst = true;
    } else if (!isSameAddress(item.address, arr[i - 1].address)) {
      newItem.isFirst = true;
    } else {
      newItem.isFirst = false;
    }
    if ('projectDict' in item) {
      const prev = arr[i - 1];
      if (i === 0) {
        newItem.isDateStart = true;
      } else if ('isPending' in prev) {
        newItem.isDateStart = true;
      } else if ('projectDict' in prev) {
        const curDate = dayjs(item.time_at * 1000);
        const prevDate = dayjs(prev.time_at * 1000);
        if (!curDate.isSame(prevDate, 'date')) {
          newItem.isDateStart = true;
        }
      }
      if (newItem.isDateStart && !newItem.isFirst) {
        newItem.isFirst = true;
      }
    }
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

export const HistoryList = ({
  loading,
  historySuccessList,
  loadingMore,
  loadMore,
  refreshLoading,
  resetTopMenu,
  list,
  localTxList,
  onRefresh,
  isForMultipleAdderss = true,
}: {
  resetTopMenu?: () => void;
  historySuccessList?: string[];
  localTxList?: TransactionGroup[];
  list?: (HistoryDisplayItem | TransactionGroup)[];
  loading?: boolean;
  loadingMore?: boolean;
  refreshLoading?: boolean;
  isForMultipleAdderss?: boolean;
  loadMore?: () => void;
  onRefresh?: () => void;
}) => {
  const markedList = useMemo(() => {
    return markFirstItems(list || []);
  }, [list]);
  const { styles } = useTheme2024({ getStyle });
  const { accounts } = useMyAccounts();

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
              {formatTimestamp(item.data.time_at * 1000)}
            </Text>
          ) : null}
          {/* {item.isFirst && isForMultipleAdderss ? (
            <AddressInfo account={item.data.account} />
          ) : null} */}
          <HistoryItem
            data={item.data}
            isForMultipleAdderss={isForMultipleAdderss}
            projectDict={item.data.projectDict}
            cateDict={item.data.cateDict}
            tokenDict={item.data.tokenDict || {}}
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
      const account = accounts.find(i =>
        isSameAddress(i.address, item.data.address),
      );
      return (
        <>
          {/* {item.isFirst ? <AddressInfo account={account} /> : null} */}
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
    <Animated.FlatList
      data={markedList}
      renderItem={renderItem}
      windowSize={5}
      onTouchStart={() => resetTopMenu && resetTopMenu()}
      style={styles.container}
      onEndReached={loadMore}
      onEndReachedThreshold={0.8}
      ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
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
    paddingHorizontal: 20,
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
