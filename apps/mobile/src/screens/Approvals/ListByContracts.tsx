import React from 'react';
import {
  View,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  ApprovalsLayouts,
  ApprovalsTabView,
  NotMatchedHolder,
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
import ApprovalCardContract from './components/ApprovalCardContract';
import { TailedTitle } from '@/components/patches/Simulation';
import { SkeletonListByContracts } from './components/Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';
import { encodeApprovalKey } from './utils';

export default function ListByContracts() {
  const { colors, styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const { isLoading, displaySortedContractList, loadApprovals, skContract } =
    useApprovalsPage();

  const keyExtractor = React.useCallback<
    SectionListProps<ContractApprovalItem>['keyExtractor'] & object
  >((contractItem, index) => {
    return `${contractItem.id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    SectionListProps<ContractApprovalItem>['renderItem'] & object
  >(
    ({ item, section, index }) => {
      const isFirstItem = index === 0;
      return (
        <View
          style={[
            styles.itemWrapper,
            isFirstItem ? { marginTop: 0 } : { marginTop: 12 },
          ]}>
          <ApprovalCardContract style={styles.cardContainer} contract={item} />
        </View>
      );
    },
    [styles],
  );

  const {
    fallList,
    simulateLoadNext,
    resetPage,
    isFetchingNextPage,
    isReachTheEnd,
  } = usePsudoPagination(displaySortedContractList, { pageSize: 10 });

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
      <View style={styles.emptyHolderContainer}>
        <NotMatchedHolder />
      </View>
    );
  }, [styles.emptyHolderContainer, isLoading]);

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
        progressViewOffset={0}
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
            progressViewOffset={0}
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
      height: ApprovalsLayouts.scrollableSectionHeight,
    },
    container: {
      flex: 1,
      flexDirection: 'column',
    },

    list: {},
    listContainer: {
      paddingTop: 0,
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
