import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  NftRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import { DisplayNftItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  usePulldownRefreshGesture,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { RNGHRefreshControl } from '@/components/customized/reexports';
import { NftItemWithCollection } from '@/screens/Home/hooks/nft';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { useFocusedTab } from 'react-native-collapsible-tab-view';
import { TabsFlatList } from '@/components/customized/react-native-collapsible-tab-view/FlatList';
import { HomeTabName as TabName } from '@/hooks/navigation';
import { ListRenderSeparator } from './RenderRow/Common';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { navigateDeprecated } from '@/utils/navigation';
import {
  useCheckIsExpireAndUpdate,
  useFindAccountByAddress,
  useIsFocusedCurrentTab,
} from './hooks/share';
import { isTabsSwiping, useHomeAssetAccountInfo } from './hooks';
import nftListStore, {
  EMPTY_NFT_ASSETS_INDEX_RESULT,
  getMultiNftsCacheKey,
  getNftAssetsIndexRowKey,
  nftCollectionResourceStore,
  nftEntityResourceStore,
  type NftAssetsIndexRow,
  useNftListComputedStore,
} from '@/store/nfts';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import { IS_ANDROID } from '@/core/native/utils';
import { useAppForeground } from '@/hooks/useAppForeground';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import { useScrollToTopOnChainChange } from '@/hooks/useScrollToTopOnChainChange';
import { resolveAssetProjectionViewState } from '@/store/assetProjectionAvailability';
import { useShallow } from 'zustand/react/shallow';
import { useUserVisibleJsWork } from '@/hooks/useUserVisibleJsWork';

const NFT_LIST_INITIAL_RENDER_COUNT = 10;
const NFT_LIST_RENDER_BATCH_SIZE = 8;
const NFT_LIST_WINDOW_SIZE = 7;
const NFT_LIST_BATCHING_PERIOD_MS = 32;

export const MemoizedNFTItemLoader = React.memo((props: RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View {...props} style={[{ paddingHorizontal: 12 }, props.style]}>
      <ItemLoader style={styles.removeLeft} />
    </View>
  );
});

type NftListItem =
  | NftAssetsIndexRow
  | {
      type: 'empty-nft' | 'loading-skeleton';
      data: string;
    }
  | {
      type: 'toggle-nft';
    };

const NftResourceRow = React.memo(
  ({
    row,
    rowStyle,
    loaderStyle,
    getAccountByAddress,
    onPress,
  }: {
    row: NftAssetsIndexRow;
    rowStyle: ViewStyle;
    loaderStyle: ViewStyle;
    getAccountByAddress(address: string): KeyringAccountWithAlias | undefined;
    onPress: (item: NftItemWithCollection) => void;
  }) => {
    const nft = useActivityStore(
      nftEntityResourceStore.useStore,
      state => (row.type === 'nft' ? state.valueMap[row.nftId] : undefined),
      Object.is,
      { storeLabel: 'home-multi-assets-nft-entities' },
    );
    const collection = useActivityStore(
      nftCollectionResourceStore.useStore,
      state =>
        row.type === 'collection'
          ? state.valueMap[row.collectionId]
          : undefined,
      Object.is,
      { storeLabel: 'home-multi-assets-nft-collections' },
    );
    const rawItem = row.type === 'collection' ? collection : nft;
    const collectionAddress =
      rawItem && 'address' in rawItem && typeof rawItem.address === 'string'
        ? rawItem.address
        : '';
    const ownerAddress =
      rawItem &&
      'owner_addr' in rawItem &&
      typeof rawItem.owner_addr === 'string'
        ? rawItem.owner_addr
        : '';
    const address = collectionAddress || ownerAddress;
    const item = useMemo(
      () =>
        rawItem && address && (!('address' in rawItem) || !rawItem.address)
          ? ({ ...rawItem, address } as NftItemWithCollection)
          : rawItem,
      [address, rawItem],
    );

    if (!item) {
      return <MemoizedNFTItemLoader style={loaderStyle} />;
    }

    return (
      <NftRow
        style={rowStyle}
        logoSize={40}
        chainLogoSize={16}
        item={item}
        account={address ? getAccountByAddress(address) : undefined}
        onPress={() => onPress(item)}
      />
    );
  },
);

const getNftListItemId = (item: NftListItem) => {
  if (item.type === 'nft' || item.type === 'collection') {
    return `nft-row/${getNftAssetsIndexRowKey(item)}`;
  }
  return `${item.type}/${'data' in item ? item.data : ''}`;
};

const NFTListInner = () => {
  const { t } = useTranslation();
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const regressionScenario = useRegressionScenario<'Home'>();
  const regressionScenarioActive = regressionScenario.active;
  const regressionScenarioId = regressionScenario.active
    ? regressionScenario.scenario
    : null;
  const regressionScenarioRunId = regressionScenario.active
    ? regressionScenario.runId
    : null;
  const regressionScenarioReport = regressionScenario.active
    ? regressionScenario.report
    : null;
  const { myTop10Accounts, myTop10Addresses } = useHomeAssetAccountInfo();
  const [showAllNfts, setShowAllNfts] = useState(false);

  const selectedChainItem = useSelectedChainItem();
  const chain = selectedChainItem?.chain;

  const getAccountByAddress = useFindAccountByAddress(myTop10Accounts);
  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.nft);
  const isScreenFocused = useIsFocused();
  const isProjectionActive = isScreenFocused && isFocusing;

  useScrollToTopOnChainChange({
    chain,
    isCurrentTab: isFocusing,
  });

  const { triggerUpdate } = useCheckIsExpireAndUpdate({
    isFocused,
    isFocusing,
  });

  const isLoading = useActivityStore(
    nftListStore,
    state => state.isLoading,
    Object.is,
    { storeLabel: 'home-multi-assets-nft-loading' },
  );
  const batchGetNFTList = nftListStore.getState().batchGetNFTList;

  const multiNftsKey = useMemo(
    () => getMultiNftsCacheKey(myTop10Addresses, chain),
    [chain, myTop10Addresses],
  );
  const nftProjection = useActivityStore(
    useNftListComputedStore,
    useShallow(state => ({
      result:
        state.multiNftsIndexCache[multiNftsKey] ||
        EMPTY_NFT_ASSETS_INDEX_RESULT,
      availability:
        state.multiNftsAvailabilityByKey[multiNftsKey] || 'unresolved',
    })),
    Object.is,
    { storeLabel: 'home-multi-assets-nft-computed-index' },
  );
  const nftIndex = nftProjection.result;
  const nftRowCount = nftIndex.rows.length;
  const nftProjectionViewState = resolveAssetProjectionViewState({
    availability: nftProjection.availability,
    hasData: nftRowCount > 0,
  });
  useUserVisibleJsWork(
    isProjectionActive && (isLoading || nftProjectionViewState === 'loading'),
    'home-nft-visible-load',
  );

  const dataList = useMemo(() => {
    const defaultRows = nftIndex.rows.slice(0, nftIndex.defaultVisibleRowCount);
    const foldedRows = nftIndex.rows.slice(nftIndex.defaultVisibleRowCount);
    const itemData: Array<{
      show: boolean;
      data: NftListItem[];
    }> = [
      {
        show: true,
        data: defaultRows,
      },
      {
        show: foldedRows.length > 0,
        data: [{ type: 'toggle-nft' }, ...(showAllNfts ? foldedRows : [])],
      },
      {
        show: nftProjectionViewState === 'loading',
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: nftProjectionViewState === 'empty',
        data: [
          {
            type: 'empty-nft',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Nft'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [nftIndex, nftProjectionViewState, showAllNfts, t]);

  const hasNotAssets = useMemo(() => {
    return nftProjectionViewState === 'empty' && isFocused;
  }, [nftProjectionViewState, isFocused]);

  const [scenarioReadyCheckTick, setScenarioReadyCheckTick] = useState(0);
  useEffect(() => {
    if (
      !regressionScenarioActive ||
      regressionScenarioId !== 'home-assets' ||
      !isFocused
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setScenarioReadyCheckTick(Date.now());
    }, 350);
    return () => clearTimeout(timer);
  }, [
    chain,
    isFocused,
    myTop10Addresses,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioRunId,
  ]);

  const lastReadyReportKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !regressionScenarioActive ||
      regressionScenarioId !== 'home-assets' ||
      !regressionScenarioRunId ||
      !regressionScenarioReport ||
      !isFocused ||
      !scenarioReadyCheckTick ||
      nftProjectionViewState === 'loading'
    ) {
      return;
    }

    const visibleCount = nftIndex.rows.length;
    const readyKey = [
      regressionScenarioRunId,
      myTop10Addresses.join(','),
      chain || 'all',
      visibleCount,
    ].join(':');
    if (lastReadyReportKeyRef.current === readyKey) {
      return;
    }
    lastReadyReportKeyRef.current = readyKey;

    regressionScenarioReport('assertion', {
      assertion: 'home-assets-nft-ready',
      passed: true,
      state: visibleCount > 0 ? 'data' : 'empty-nft',
      accountCount: myTop10Addresses.length,
      visibleCount,
      selectedChain: chain || null,
    });
  }, [
    chain,
    isFocused,
    nftProjectionViewState,
    myTop10Addresses,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioReport,
    regressionScenarioRunId,
    scenarioReadyCheckTick,
    nftIndex.rows.length,
  ]);

  useEffect(() => {
    useNftListComputedStore
      .getState()
      .setMultiNftsProjectionActive(multiNftsKey, isProjectionActive);

    return () => {
      useNftListComputedStore
        .getState()
        .setMultiNftsProjectionActive(multiNftsKey, false);
    };
  }, [isProjectionActive, multiNftsKey]);

  useEffect(() => {
    useNftListComputedStore
      .getState()
      .registerMultiNfts(myTop10Addresses, chain);
  }, [chain, myTop10Addresses]);

  const handlePressNft = useCallback(
    (item: NftItemWithCollection) => {
      if (!item.address) {
        return;
      }
      if (isTabsSwiping.value) {
        return;
      }
      const currentAccount = getAccountByAddress(item.address || '');
      if ('nft_list' in item && item.nft_list.length) {
        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.COLLECTION_NFTS,
          data: item,
          account: currentAccount,
          bottomSheetModalProps: {
            // enableContentPanningGesture: true,
            enablePanDownToClose: true,
            handleStyle: {
              backgroundColor: colors2024['neutral-bg-2'],
            },
          },
          titleText: `${item.name}(${item.nft_list.length})`,
          onPressItem: (v: DisplayNftItem) => {
            navigateDeprecated(RootNames.NftDetail, {
              token: v,
              isSingleAddress: true,
              account: currentAccount as any,
            });
            removeGlobalBottomSheetModal2024(id);
          },
          onClose: () => {
            removeGlobalBottomSheetModal2024(id);
          },
        });
      } else {
        navigateDeprecated(RootNames.NftDetail, {
          token: item as DisplayNftItem,
          isSingleAddress: true,
          account: currentAccount as any,
        });
      }
    },
    [colors2024, getAccountByAddress],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const { type } = item as NftListItem;
      switch (type) {
        case 'nft':
        case 'collection':
          return (
            <View style={styles.rowWrap}>
              <NftResourceRow
                row={item as NftAssetsIndexRow}
                rowStyle={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                loaderStyle={styles.loadingItem}
                getAccountByAddress={getAccountByAddress}
                onPress={handlePressNft}
              />
            </View>
          );
        case 'toggle-nft':
          return (
            <TokenRowSectionHeader
              str={String(
                nftIndex.rows.length - nftIndex.defaultVisibleRowCount,
              )}
              fold={!showAllNfts}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setShowAllNfts(visible => !visible)}
            />
          );
        case 'empty-nft':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={'data' in item ? item.data : ''}
              type={type}
            />
          );
        case 'loading-skeleton':
          return <MemoizedNFTItemLoader style={styles.loadingItem} />;
        default:
          return null;
      }
    },
    [
      getAccountByAddress,
      handlePressNft,
      isLight,
      nftIndex,
      showAllNfts,
      styles,
    ],
  );

  const onRefresh = useCallback(async () => {
    const balanceRefresh = triggerUpdate(true);
    const nftListRefresh = batchGetNFTList(true, {
      realTimeAddresses: myTop10Addresses,
    });

    withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(error => {
      console.error('Refresh balance failed:', error);
    });

    try {
      await nftListRefresh;
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [batchGetNFTList, myTop10Addresses, triggerUpdate]);

  const handleForeground = useCallback(() => {
    if (isLoading || !isFocusing || !myTop10Addresses) {
      return;
    }
    triggerUpdate(false);
    batchGetNFTList(false, { realTimeAddresses: myTop10Addresses });
  }, [isLoading, isFocusing, myTop10Addresses, triggerUpdate, batchGetNFTList]);

  useAppForeground({
    enabled: isFocusing,
    onForeground: handleForeground,
  });

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
    console.debug('[PulldownRefresh] NFTList isLoading changed', isLoading);
    if (!isLoading) {
      setPulldownRefreshStage({
        state: isLoading ? 'refreshing' : 'finished',
        svIsRefreshing,
        pullDistance,
        svIsManualRefreshing,
        indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
      });
    }
  }, [isLoading, svIsRefreshing, pullDistance, svIsManualRefreshing]);

  const pulldownRefreshReturns = usePulldownRefreshStyles({
    indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    pullDistanceMaxValue: HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset,
    states: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  });

  return (
    <GestureDetector gesture={panGestureRef.current}>
      <TabsFlatList
        keyExtractor={getNftListItemId}
        data={
          hasNotAssets
            ? [
                {
                  type: 'empty-nft',
                  data: t('page.singleHome.sectionHeader.NoData', {
                    name: t('page.singleHome.sectionHeader.Nft'),
                  }),
                },
              ]
            : dataList
        }
        renderItem={renderItem}
        initialNumToRender={NFT_LIST_INITIAL_RENDER_COUNT}
        windowSize={NFT_LIST_WINDOW_SIZE}
        key={isFocused ? 'nft-focused' : 'nft-unfocused'}
        maxToRenderPerBatch={NFT_LIST_RENDER_BATCH_SIZE}
        updateCellsBatchingPeriod={NFT_LIST_BATCHING_PERIOD_MS}
        removeClippedSubviews={IS_ANDROID}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ItemSeparatorComponent={ListRenderSeparator}
        ListHeaderComponent={
          <RefreshPlaceholderIOS
            hooksReturn={pulldownRefreshReturns}
            animatedStyle={pulldownRefreshReturns.refreshPlaceholderStyle}
            __PICK_MANUAL__
          />
        }
        // ListFooterComponent={ListRenderFooter}
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

export const NFTList = () => {
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);
  if (focusedTab === TabName.nft) {
    hasBeenFocusedRef.current = true;
  }

  if (!hasBeenFocusedRef.current) {
    return null;
  }

  return <NFTListInner />;
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    // marginTop: HOME_TOP_HEADER_SIZES.scrollableListTopOffset,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 48,
  },
  sectionHeader: {
    height: ASSETS_SECTION_HEADER,
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
  },
  buttonHeader: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  rowWrap: {
    // paddingHorizontal: 16,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  removeLeft: {
    marginLeft: 0,
  },
  loadingItem: {
    paddingHorizontal: 0,
  },
}));
