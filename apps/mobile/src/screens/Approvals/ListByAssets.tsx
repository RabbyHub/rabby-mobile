import React from 'react';
import {
  View,
  SectionList,
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
  type AssetApprovalItem,
  useApprovalsPage,
  useRevokeApprovals,
} from './useApprovalsPage';
import { Tabs } from 'react-native-collapsible-tab-view';
import { usePsudoPagination } from '@/hooks/common/usePagination';
import { SectionListProps } from 'react-native';
import { SkeletonListByAssets } from './components/Skeleton';
import ApprovalAssetRow from './components/ApprovalAssetRow';
import { ApprovalsLayouts } from './layout';

const isIOS = Platform.OS === 'ios';

export default function ListByAssets() {
  const { colors, styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const {
    isLoading,
    displaySortedAssetApprovalList,
    loadApprovals,
    assetEmptyStatus,
    safeSizeInfo: { safeSizes },
  } = useApprovalsPage();

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
          <ApprovalAssetRow assetApproval={item} />
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
  } = usePsudoPagination(displaySortedAssetApprovalList, { pageSize: 20 });

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
      resetRevokeMaps('assets');
    } catch (err) {
      console.error(err);
    } finally {
    }
  }, [resetRevokeMaps, resetPage, loadApprovals]);

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
      height: getScrollableSectionHeight(),
    },
    container: {
      flex: 1,
      flexDirection: 'column',
    },

    list: {
      // ...makeDebugBorder(),
    },
    listContainer: {
      paddingTop: 0,
      paddingBottom: 0,
      // repair top offset due to special contentInset in iOS
      ...(isIOS && { marginTop: -ApprovalsLayouts.tabbarHeight }),
      // height: '100%',
      // ...makeDebugBorder('yellow'),
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
