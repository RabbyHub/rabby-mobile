import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import { range } from 'lodash';
import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { HistoryItem } from './HistoryItem';
import { SkeletonCard } from './SkeletonCard';
import { TransactionItem } from '@/screens/TransactionRecord/components/TransactionItem';
import { TransactionGroup } from '@/core/services/transactionHistory';

export const HistoryList = ({
  loading,
  loadingMore,
  loadMore,
  list,
}: {
  list?: (TxDisplayItem | TransactionGroup)[];
  loading?: boolean;
  loadingMore?: boolean;
  loadMore?: () => void;
}) => {
  const renderItem = ({ item }: { item: TxDisplayItem | TransactionGroup }) => {
    if ('projectDict' in item) {
      return (
        <HistoryItem
          data={item}
          projectDict={item.projectDict}
          cateDict={item.cateDict}
          tokenDict={item.tokenDict || {}}
        />
      );
    } else {
      return <TransactionItem data={item} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        {range(0, 4).map(i => {
          return <SkeletonCard key={i} />;
        })}
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={list}
      renderItem={renderItem}
      windowSize={5}
      style={styles.container}
      onEndReached={loadMore}
      onEndReachedThreshold={0.8}
      ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'column',
    gap: 12,
  },
});
