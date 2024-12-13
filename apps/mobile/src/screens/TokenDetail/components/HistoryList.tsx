import { range } from 'lodash';
import React from 'react';
import { Animated, FlatListProps, Platform, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { useTheme2024 } from '@/hooks/theme';
import { HistoryDisplayItem } from '@/screens/Transaction/MultiAddressHistory';
import { HistoryItem } from '@/screens/Transaction/components/HistoryItem';
import { SkeletonCard } from '@/screens/Transaction/components/SkeletonCard';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { Empty } from '@/screens/Transaction/components/Empty';

const isIOS = Platform.OS === 'ios';

export const HistoryList = ({
  ListHeaderComponent,
  loading,
  loadingMore,
  loadMore,
  refreshLoading,
  list,
  onRefresh,
}: {
  list?: HistoryDisplayItem[];
  loading?: boolean;
  loadingMore?: boolean;
  refreshLoading?: boolean;
  loadMore?: () => void;
  onRefresh?: () => void;
  ListHeaderComponent?: FlatListProps<any>['ListHeaderComponent'];
}) => {
  const { styles } = useTheme2024({ getStyle });

  const renderItem = useMemoizedFn(({ item }: { item: HistoryDisplayItem }) => {
    return (
      <View style={styles.historyItem}>
        <HistoryItem
          data={item}
          projectDict={item.projectDict}
          cateDict={item.cateDict}
          tokenDict={item.tokenDict || {}}
        />
      </View>
    );
  });

  return (
    <Animated.FlatList
      data={list}
      renderItem={renderItem}
      windowSize={5}
      style={styles.container}
      onEndReached={loadMore}
      onEndReachedThreshold={0.8}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={loadingMore ? <SkeletonCard /> : null}
      ListEmptyComponent={
        <>
          {loading ? (
            <View style={styles.skeletonContainer}>
              {range(0, 4).map(i => {
                return <SkeletonCard key={i} />;
              })}
            </View>
          ) : (
            <Empty
              style={{
                height: 300,
              }}
              isShowDesc={false}
            />
          )}
        </>
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
  container: {},
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
    fontSize: 18,
    fontWeight: '700',
    paddingLeft: 12,
    marginBottom: 20,
    color: colors2024['neutral-title-1'],
    lineHeight: 22,
  },
  historyItem: {
    paddingHorizontal: 20,
  },
}));
