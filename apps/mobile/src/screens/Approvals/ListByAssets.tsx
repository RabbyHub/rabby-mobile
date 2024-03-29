import React from 'react';
import { View, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApprovalsLayouts, ApprovalsTabView } from './components/Layout';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { TopSearch } from './components/TopSearch';
import { type AssetApprovalItem, useApprovalsPage } from './useApprovalsPage';
import { Tabs } from 'react-native-collapsible-tab-view';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { SectionListProps } from 'react-native';
import { TailedTitle } from '@/components/patches/Simulation';
import { SkeletonListByAssets } from './components/Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';
import ApprovalAssetsRow from './components/ApprovalAssetsRow';

export default function ListByAssets() {
  const { colors, styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const { isLoading, displaySortedAssetsApprovalList, loadApprovals } =
    useApprovalsPage();

  const keyExtractor = React.useCallback<
    SectionListProps<AssetApprovalItem>['keyExtractor'] & object
  >((contractItem, index) => {
    return `${contractItem.id}-${index}`;
  }, []);

  const renderItem = React.useCallback<
    SectionListProps<AssetApprovalItem>['renderItem'] & object
  >(
    ({ item, section, index }) => {
      const isFirstItem = index === 0;
      return (
        <View
          style={[
            styles.itemWrapper,
            isFirstItem ? { marginTop: 0 } : { marginTop: 12 },
          ]}>
          <ApprovalAssetsRow approvalItem={item} listIndex={index} />
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
  } = usePsudoPagination(displaySortedAssetsApprovalList, { pageSize: 20 });

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

  const refresh = React.useCallback(async () => {
    resetPage();

    try {
      await loadApprovals();
    } finally {
    }
  }, [resetPage, loadApprovals]);

  const ListEmptyComponent = React.useMemo(() => {
    return isLoading ? (
      <SkeletonListByAssets />
    ) : (
      <EmptyHolder text="No Assets" type="card" />
    );
  }, [isLoading]);

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
        <TopSearch filterType={'assets'} />
      </View>
      <Tabs.SectionList<AssetApprovalItem>
        initialNumToRender={4}
        maxToRenderPerBatch={20}
        ListFooterComponent={
          <View style={styles.listFooterContainer}>
            {isFetchingNextPage ? (
              <ActivityIndicator />
            ) : sectionList.length && isReachTheEnd ? (
              <TailedTitle
                style={{
                  paddingHorizontal:
                    ApprovalsLayouts.innerContainerHorizontalOffset,
                }}
                text="No more"
              />
            ) : null}
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
    footContainer: {},

    innerContainer: {
      padding: 0,
      paddingBottom: 0,
    },
  };
});
