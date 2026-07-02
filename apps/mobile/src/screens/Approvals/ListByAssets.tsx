import React from 'react';
import {
  View,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';

import {
  ApprovalsTabView,
  NotMatchedHolder,
  getScrollableSectionHeight,
} from './components/Layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  type AssetApprovalItem,
  useApprovalsPage,
  useRevokeApprovals,
} from './useApprovalsPage';
import { Tabs } from '@rabby-wallet/react-native-collapsible-tab-view/src';
import { useFocusEffect } from '@react-navigation/native';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { FlatListProps } from 'react-native';
import { SkeletonListByAssets } from './components/Skeleton';
import ApprovalAssetRow from './components/ApprovalAssetRow';
import { ApprovalsLayouts } from './layout';
import { useApprovalsPullTopGap } from './useApprovalsPullTopGap';

const isIOS = Platform.OS === 'ios';

export default function ListByAssets() {
  const { styles } = useTheme2024({ getStyle });

  const {
    isLoading,
    displaySortedAssetApprovalList,
    loadApprovals,
    assetEmptyStatus,
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();
  const { pullDownDistance, ListTopGap, captureRefreshDistance } =
    useApprovalsPullTopGap();

  const keyExtractor = React.useCallback<
    FlatListProps<AssetApprovalItem>['keyExtractor'] & object
  >((contractItem, index) => {
    return `${contractItem.id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    FlatListProps<AssetApprovalItem>['renderItem'] & object
  >(
    ({ item, index }) => {
      const isFirstItem = index === 0;

      return (
        <View
          style={[
            styles.itemWrapper,
            isFirstItem ? { marginTop: 0 } : { marginTop: 8 },
          ]}>
          <ApprovalAssetRow assetApproval={item} />
        </View>
      );
    },
    [styles],
  );

  const { fallList, simulateLoadNext, resetPage, isFetchingNextPage } =
    usePsudoPagination(displaySortedAssetApprovalList, { pageSize: 20 });

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(150);
  }, [simulateLoadNext]);

  const { resetRevokeMaps } = useRevokeApprovals();
  const refresh = React.useCallback(async () => {
    resetPage();

    try {
      resetRevokeMaps('assets');
      await loadApprovals();
    } catch (err) {
      console.error(err);
    } finally {
    }
  }, [resetRevokeMaps, resetPage, loadApprovals]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const ListEmptyComponent = React.useMemo(() => {
    return isLoading ? (
      <SkeletonListByAssets />
    ) : (
      <View
        style={[
          styles.emptyHolderContainer,
          {
            height: getScrollableSectionHeight({
              bottomAreaHeight: safeSizes.bottomAreaHeight,
            }),
          },
        ]}>
        <NotMatchedHolder
          text={assetEmptyStatus === 'none' ? 'No approvals' : 'Not Matched'}
        />
      </View>
    );
  }, [
    styles.emptyHolderContainer,
    safeSizes.bottomAreaHeight,
    isLoading,
    assetEmptyStatus,
  ]);

  const refreshing = React.useMemo(() => {
    if (fallList.length > 0) {
      return isLoading;
    } else {
      return false;
    }
  }, [isLoading, fallList]);

  return (
    <ApprovalsTabView
      style={styles.container}
      innerStyle={[
        styles.innerContainer,
        // makeDebugBorder('red')
      ]}>
      <Tabs.FlatList<AssetApprovalItem>
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        data={fallList}
        pullDownDistance={pullDownDistance}
        ListHeaderComponent={ListTopGap}
        ListFooterComponent={
          <View style={styles.listFooterContainer}>
            {isFetchingNextPage ? <ActivityIndicator /> : null}
          </View>
        }
        style={[
          styles.list,
          {
            paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
          },
        ]}
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            {...(isIOS && {
              progressViewOffset: ApprovalsLayouts.tabbarHeight,
            })}
            refreshing={refreshing}
            onRefresh={() => {
              captureRefreshDistance();
              refresh();
            }}
          />
        }
      />
    </ApprovalsTabView>
  );
}

const getStyle = createGetStyles2024(({ colors, colors2024 }) => {
  return {
    emptyHolderContainer: {
      height: getScrollableSectionHeight(),
    },
    container: {
      flex: 1,
      flexDirection: 'column',
    },

    list: {},
    listFooterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: ApprovalsLayouts.listFooterComponentHeight,
      // ...makeDebugBorder('green'),
    },
    listContainer: {
      paddingBottom: 0,
    },
    itemWrapper: {
      width: '100%',
    },

    innerContainer: {
      padding: 0,
      paddingBottom: 0,
    },
  };
});
