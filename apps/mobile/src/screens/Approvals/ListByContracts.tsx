import React from 'react';
import {
  View,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  ApprovalsTabView,
  NotMatchedHolder,
  getScrollableSectionHeight,
} from './components/Layout';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { TopSearch } from './components/TopSearch';
import {
  type ContractApprovalItem,
  useApprovalsPage,
  useRevokeApprovals,
} from './useApprovalsPage';
import { Tabs } from 'react-native-collapsible-tab-view';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { SectionListProps } from 'react-native';
import ApprovalContractRow from './components/ApprovalContractRow';
import { SkeletonListByContracts } from './components/Skeleton';
import { ApprovalsLayouts } from './layout';

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

  const keyExtractor = React.useCallback<
    SectionListProps<ContractApprovalItem>['keyExtractor'] & object
  >((contractItem, index) => {
    return `${contractItem.id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    SectionListProps<ContractApprovalItem>['renderItem'] & object
  >(
    ({ item, index }) => {
      const isFirstItem = index === 0;
      return (
        <View
          style={[
            styles.itemWrapper,
            isFirstItem ? { marginTop: 0 } : { marginTop: 12 },
          ]}>
          <ApprovalContractRow style={styles.cardContainer} contract={item} />
        </View>
      );
    },
    [styles],
  );

  const { fallList, simulateLoadNext, resetPage, isFetchingNextPage } =
    usePsudoPagination(displaySortedContractList, { pageSize: 10 });

  const sectionList = React.useMemo(() => {
    return !fallList?.length
      ? []
      : [
          {
            title: '',
            data: fallList,
          },
        ];
  }, [fallList]);

  const onEndReached = React.useCallback(() => {
    simulateLoadNext(150);
  }, [simulateLoadNext]);

  const { resetRevokeMaps } = useRevokeApprovals();
  const refresh = React.useCallback(async () => {
    resetPage();

    try {
      await loadApprovals();
      resetRevokeMaps('contract');
    } catch (err) {
      console.error(err);
    } finally {
    }
  }, [resetRevokeMaps, resetPage, loadApprovals]);

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
      {/* Search input area */}
      <View
        style={{
          paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
        }}>
        <TopSearch filterType={'contract'} />
      </View>
      <Tabs.SectionList<ContractApprovalItem>
        initialNumToRender={4}
        maxToRenderPerBatch={20}
        // ListHeaderComponent={renderHeaderComponent}
        ListFooterComponent={
          <View style={styles.listFooterContainer}>
            {isFetchingNextPage ? <ActivityIndicator /> : null}
          </View>
        }
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        renderItem={renderItem}
        // renderSectionHeader={renderSectionHeader}
        renderSectionFooter={() => <View style={styles.footContainer} />}
        sections={sectionList}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            {...(isIOS && {
              progressViewOffset: -12,
            })}
            refreshing={refreshing}
            onRefresh={() => {
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

    list: {},
    listContainer: {
      paddingTop: 0,
      paddingBottom: 0,
      // repair top offset due to special contentInset in iOS
      ...(isIOS && { marginTop: -ApprovalsLayouts.tabbarHeight }),
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
      paddingHorizontal: ApprovalsLayouts.innerContainerHorizontalOffset,
    },
    cardContainer: {
      maxWidth:
        Dimensions.get('window').width -
        ApprovalsLayouts.innerContainerHorizontalOffset * 2,
    },
    footContainer: {},

    innerContainer: {
      padding: 0,
      paddingBottom: 0,
    },
  };
});
