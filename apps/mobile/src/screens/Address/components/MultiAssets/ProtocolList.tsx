import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import {
  FullDefiRenderItem,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import { createGetStyles2024 } from '@/utils/styles';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import { GestureDetector } from 'react-native-gesture-handler';
import { KeyringAccountWithAlias } from '@/hooks/account';
import useLoadMoreData from './hooks/useLoadMoreData';
import { HomeTabName as TabName } from '@/hooks/navigation';
import { ListRenderSeparator } from './RenderRow/Common';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import useProtocols, {
  getMultiProtocolsCacheKey,
  ProtocolAssetsIndexResult,
  ProtocolEntityId,
  useProtocolEntity,
  useProtocolListComputedStore,
} from '@/store/protocols';
import { useShallow } from 'zustand/react/shallow';
import { useAccountInfo } from './hooks';
import addressBalanceStore from '@/store/balance';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { IS_ANDROID } from '@/core/native/utils';
import { TabsFlatList } from '@/components/customized/react-native-collapsible-tab-view/FlatList';
import {
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  usePulldownRefreshGesture,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { RNGHRefreshControl } from '@/components/customized/reexports';
import { useAppForeground } from '@/hooks/useAppForeground';

const emptyProtocolIndexResult: ProtocolAssetsIndexResult = {
  foldIds: [],
  unFoldIds: [],
  foldDeFiValue: '',
};

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);

export const MemoizedDefiItemLoader = React.memo(DefiItemLoader);

const { batchGetProtocols } = useProtocols.getState();

type ProtocolListItem =
  | {
      type: 'unfold_defi' | 'fold_defi';
      protocolId: ProtocolEntityId;
    }
  | {
      type: 'toggle_defi_fold';
      data: string;
    }
  | {
      type: 'empty-defi';
      data: string;
    }
  | {
      type: 'loading-defi-skeleton';
      data: string;
    };

const ProtocolResourceRow = React.memo(
  ({
    protocolId,
    showAccount,
    style,
    disableAction,
    defaultExpand,
    getAccountByAddress,
  }: {
    protocolId: ProtocolEntityId;
    showAccount: boolean;
    style?: React.ComponentProps<typeof FullDefiRenderItem>['style'];
    disableAction: boolean;
    defaultExpand: boolean;
    getAccountByAddress(address?: string): KeyringAccountWithAlias | undefined;
  }) => {
    const data = useProtocolEntity(protocolId);

    if (!data) {
      return <MemoizedDefiItemLoader />;
    }

    return (
      <MemoizedFullDefiRenderItem
        data={data}
        showAccount={showAccount}
        style={style}
        disableAction={disableAction}
        defaultExpand={defaultExpand}
        account={
          getAccountByAddress(
            data.owner_addr,
          ) as unknown as KeyringAccountWithAlias
        }
      />
    );
  },
);

export const ProtocolList = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { myTop10Addresses } = useAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = selectedChainItem?.chain;
  const [foldDefi, setFoldDefi] = useState(true);

  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.defi);
  const getAccountByAddress = useFindAccountByAddress();
  const { triggerUpdate } = addressBalanceStore.useAccountsBalanceTrigger();

  const multiProtocolsKey = useMemo(() => {
    return getMultiProtocolsCacheKey(myTop10Addresses, chain);
  }, [chain, myTop10Addresses]);

  const registerMultiAssets = useProtocolListComputedStore(
    s => s.registerMultiProtocols,
  );

  const multiProtocols = useProtocolListComputedStore(
    useShallow(
      state =>
        state.multiProtocolsIndexCache[multiProtocolsKey] ||
        emptyProtocolIndexResult,
    ),
  );

  const isLoading = useProtocols(state => state.isLoading);

  const { data: unFoldProtocolIds, loadMore: loadMorePortfolios } =
    useLoadMoreData(multiProtocols.unFoldIds);

  const shouldDefaultExpand = useMemo(
    () => multiProtocols.unFoldIds.length <= 5,
    [multiProtocols.unFoldIds.length],
  );

  const portfolioListData = useMemo(() => {
    const foldDeFiList: ProtocolListItem[] = multiProtocols.foldIds.map(
      protocolId => ({
        type: 'fold_defi',
        protocolId,
      }),
    );

    const itemData: Array<{
      show: boolean;
      data: ProtocolListItem[];
    }> = [
      {
        show: true,
        data: unFoldProtocolIds.map(protocolId => ({
          type: 'unfold_defi',
          protocolId,
        })),
      },
      {
        show: !!foldDeFiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
            data: multiProtocols.foldDeFiValue,
          },
          ...(foldDefi ? [] : foldDeFiList),
        ],
      },
      {
        show:
          !!isLoading &&
          !multiProtocols.unFoldIds.length &&
          !multiProtocols.foldIds.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: index.toString(),
        })),
      },
      {
        show:
          !isLoading &&
          multiProtocols.unFoldIds.length === 0 &&
          multiProtocols.foldIds.length === 0,
        data: [
          {
            type: 'empty-defi',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Defi'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [
    foldDefi,
    isLoading,
    t,
    multiProtocols.foldDeFiValue,
    multiProtocols.foldIds,
    multiProtocols.unFoldIds.length,
    unFoldProtocolIds,
  ]);

  const hasNotAssets = useMemo(() => {
    return (
      multiProtocols.unFoldIds.length === 0 &&
      multiProtocols.foldIds.length === 0 &&
      !isLoading &&
      isFocused
    );
  }, [
    multiProtocols.foldIds.length,
    multiProtocols.unFoldIds.length,
    isLoading,
    isFocused,
  ]);

  useEffect(() => {
    registerMultiAssets(myTop10Addresses, chain);
  }, [myTop10Addresses, chain, registerMultiAssets]);

  useEffect(() => {
    batchGetProtocols(myTop10Addresses);
  }, [myTop10Addresses]);

  const handleForeground = useCallback(() => {
    if (isLoading || !isFocusing || !myTop10Addresses) {
      return;
    }
    triggerUpdate(false);
    batchGetProtocols(myTop10Addresses);
  }, [isFocusing, isLoading, myTop10Addresses, triggerUpdate]);

  useAppForeground({
    enabled: isFocusing,
    onForeground: handleForeground,
  });

  const renderItem = useCallback(
    ({ item }) => {
      const { type } = item as ProtocolListItem;
      switch (type) {
        case 'unfold_defi':
        case 'fold_defi':
          return (
            <ProtocolResourceRow
              protocolId={item.protocolId}
              showAccount
              style={styles.fullDefi}
              disableAction={isLoading}
              defaultExpand={type === 'fold_defi' ? false : shouldDefaultExpand}
              getAccountByAddress={getAccountByAddress}
            />
          );
        case 'toggle_defi_fold':
          return (
            <TokenRowSectionHeader
              style={styles.tokenSectionHeader}
              str={item.data}
              fold={foldDefi}
              onPressFold={() => setFoldDefi(pre => !pre)}
            />
          );
        case 'empty-defi':
          return (
            <MemoizedEmptyAssets
              style={styles.emptyAssets}
              desc={item.data}
              type={type}
            />
          );
        case 'loading-defi-skeleton':
          return <MemoizedDefiItemLoader style={styles.defiLoading} />;
        default:
          return null;
      }
    },
    [
      foldDefi,
      styles.defiLoading,
      styles.emptyAssets,
      styles.fullDefi,
      styles.tokenSectionHeader,
      getAccountByAddress,
      isLoading,
      shouldDefaultExpand,
    ],
  );

  const keyExtractor = useCallback((item: ProtocolListItem) => {
    if (item.type === 'unfold_defi' || item.type === 'fold_defi') {
      return `${item.type}-${item.protocolId}`;
    }
    return `${item.type}-${'data' in item ? item.data || '' : ''}`;
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        batchGetProtocols(myTop10Addresses, true),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [triggerUpdate, myTop10Addresses]);

  const scrollY = useCurrentTabScrollY();
  const {
    panGestureRef,
    isRefreshing,
    svs: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  } = usePulldownRefreshGesture({
    scrollViewYValue: scrollY,
    onJsPulldownRefresh: ctx => {
      ctx.svIsManualRefreshing.value = true;
      return onRefresh();
    },
  });

  useEffect(() => {
    console.debug(
      '[PulldownRefresh] ProtocolList isLoading changed',
      isLoading,
    );
    if (!isLoading) {
      setPulldownRefreshStage({
        state: isLoading ? 'refreshing' : 'finished',
        indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
        svIsRefreshing,
        svIsManualRefreshing,
        pullDistance,
      });
    }
  }, [isLoading, svIsRefreshing, svIsManualRefreshing, pullDistance]);

  const pulldownRefreshReturns = usePulldownRefreshStyles({
    indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    pullDistanceMaxValue: HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset,
    states: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  });

  // if (!isFocusing) {
  //   return null;
  // }
  return (
    <GestureDetector gesture={panGestureRef.current}>
      <TabsFlatList
        keyExtractor={keyExtractor}
        data={
          hasNotAssets
            ? [
                {
                  type: 'empty-defi',
                  data: t('page.singleHome.sectionHeader.NoData', {
                    name: t('page.singleHome.sectionHeader.Defi'),
                  }),
                },
              ]
            : portfolioListData
        }
        key={isFocused ? 'defi-focused' : 'defi-unfocused'}
        renderItem={renderItem}
        initialNumToRender={15}
        windowSize={5}
        maxToRenderPerBatch={15}
        removeClippedSubviews={IS_ANDROID}
        ItemSeparatorComponent={ListRenderSeparator}
        ListHeaderComponent={
          <>
            <RefreshPlaceholderIOS
              hooksReturn={pulldownRefreshReturns}
              animatedStyle={pulldownRefreshReturns.refreshPlaceholderStyle}
              __PICK_MANUAL__
            />
          </>
        }
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={[
          styles.container,
          pulldownRefreshReturns.scrollableStyle.container,
        ]}
        contentContainerStyle={[
          styles.list,
          pulldownRefreshReturns.scrollableStyle.list,
        ]}
        onEndReached={loadMorePortfolios}
        onEndReachedThreshold={0.5}
        bounces={false}
        overScrollMode={'never'}
        scrollEventThrottle={16}
        simultaneousHandlers={[panGestureRef]}
        {...(!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING && {
          refreshControl: (
            <RNGHRefreshControl
              style={{ paddingHorizontal: 16 }}
              refreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          ),
        })}
      />
    </GestureDetector>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
    // marginTop: HOME_TOP_HEADER_SIZES.scrollableListTopOffset,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  bgContainer: {
    paddingHorizontal: 16,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  emptyTokenHolder: {
    paddingHorizontal: 0,
  },
  defiLoading: {
    paddingHorizontal: 0,
  },
  loadingMore: {
    paddingHorizontal: 0,
    marginTop: 16,
  },
  fullDefi: {
    marginHorizontal: 0,
    // marginTop: 8,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
  },
}));
