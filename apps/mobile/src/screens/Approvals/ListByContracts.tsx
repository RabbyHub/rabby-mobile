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
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import {
  type ContractApprovalItem,
  useApprovalsPage,
  useRevokeApprovals,
} from './useApprovalsPage';
import { Tabs } from '@rabby-wallet/react-native-collapsible-tab-view/src';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { FlatListProps } from 'react-native';
import ApprovalContractRow from './components/ApprovalContractRow';
import { SkeletonListByContracts } from './components/Skeleton';
import { ApprovalsLayouts } from './layout';
import { useFocusEffect } from '@react-navigation/native';
import { useApprovalsPullTopGap } from './useApprovalsPullTopGap';

const isIOS = Platform.OS === 'ios';

export default function ListByContracts() {
  const { styles } = useThemeStyles(getStyles);

  const {
    isLoading,
    displaySortedContractList,
    loadApprovals,
    contractEmptyStatus,
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();
  const { pullDownDistance, ListTopGap, captureRefreshDistance } =
    useApprovalsPullTopGap();

  const keyExtractor = React.useCallback<
    FlatListProps<ContractApprovalItem>['keyExtractor'] & object
  >((contractItem, index) => {
    return `${contractItem.id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    FlatListProps<ContractApprovalItem>['renderItem'] & object
  >(
    ({ item, index }) => {
      const isFirstItem = index === 0;
      return (
        <View
          style={[
            styles.itemWrapper,
            isFirstItem ? { marginTop: 0 } : { marginTop: 8 },
          ]}>
          <ApprovalContractRow contract={item} />
        </View>
      );
    },
    [styles],
  );

  const { fallList, simulateLoadNext, resetPage, isFetchingNextPage } =
    usePsudoPagination(displaySortedContractList, { pageSize: 10 });

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(150);
  }, [simulateLoadNext]);

  const { resetRevokeMaps } = useRevokeApprovals();
  const refresh = React.useCallback(async () => {
    resetPage();

    try {
      resetRevokeMaps('contract');
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
      <SkeletonListByContracts />
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
          text={contractEmptyStatus === 'none' ? 'No approvals' : 'Not Matched'}
        />
      </View>
    );
  }, [
    styles.emptyHolderContainer,
    safeSizes.bottomAreaHeight,
    isLoading,
    contractEmptyStatus,
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
      <Tabs.FlatList<ContractApprovalItem>
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
        style={styles.list}
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

const getStyles = createGetStyles(colors => {
  return {
    emptyHolderContainer: {
      // ...makeDebugBorder(),
      height: getScrollableSectionHeight(),
    },
    container: {
      flex: 1,
      flexDirection: 'column',
    },

    list: {
      paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
    },
    listContainer: {
      paddingBottom: 0,
    },
    listFooterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: ApprovalsLayouts.listFooterComponentHeight,
      // ...makeDebugBorder('green'),
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
