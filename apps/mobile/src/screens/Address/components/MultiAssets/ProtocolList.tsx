import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type {
  LayoutChangeEvent,
  ListRenderItem,
  ViewStyle,
  ViewToken,
} from 'react-native';
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
import { HomeTabName as TabName } from '@/hooks/navigation';
import { ListRenderSeparator } from './RenderRow/Common';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import useProtocols, {
  EMPTY_PROTOCOL_ASSETS_INDEX_RESULT,
  getMultiProtocolsCacheKey,
  protocolEntityResourceStore,
  type ProtocolEntityId,
  useProtocolListComputedStore,
} from '@/store/protocols';
import { useShallow } from 'zustand/react/shallow';
import { useHomeAssetAccountInfo } from './hooks';
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
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import {
  useRegressionScenario,
  useRegressionScenarioAssertion,
} from '@/devtools/regressionScenarios/react';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { useScrollToTopOnChainChange } from '@/hooks/useScrollToTopOnChainChange';
import { resolveAssetProjectionViewState } from '@/store/assetProjectionAvailability';

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);

export const MemoizedDefiItemLoader = React.memo(DefiItemLoader);

const { batchGetProtocols } = useProtocols.getState();

type ProtocolListItem =
  | {
      type: 'visible-defi' | 'folded-defi';
      protocolId: ProtocolEntityId;
    }
  | {
      type: 'toggle-defi';
      data: string;
    }
  | {
      type: 'empty-defi' | 'loading-defi-skeleton';
      data: string;
    };

const ProtocolResourceRow = React.memo(
  ({
    protocolId,
    getAccountByAddress,
    style,
    disableAction,
    defaultExpand,
  }: {
    protocolId: ProtocolEntityId;
    getAccountByAddress(address: string): KeyringAccountWithAlias | undefined;
    style: ViewStyle;
    disableAction: boolean;
    defaultExpand: boolean;
  }) => {
    const protocol = useActivityStore(
      protocolEntityResourceStore.useStore,
      state => state.valueMap[protocolId],
      Object.is,
      { storeLabel: 'home-multi-assets-defi-entities' },
    );

    if (!protocol) {
      return <MemoizedDefiItemLoader />;
    }

    return (
      <MemoizedFullDefiRenderItem
        data={protocol}
        showAccount
        style={style}
        disableAction={disableAction}
        defaultExpand={defaultExpand}
        account={getAccountByAddress(protocol.owner_addr)}
      />
    );
  },
);

const getProtocolListItemId = (item: ProtocolListItem) => {
  if ('protocolId' in item) {
    return `${item.type}/${item.protocolId}`;
  }
  return `${item.type}/${item.data}`;
};

export const ProtocolList = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });
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
  const isHighCardinalityRegressionScenario =
    regressionScenarioActive &&
    regressionScenarioId === 'high-cardinality-assets' &&
    !!regressionScenarioRunId &&
    !!regressionScenarioReport;

  const { myTop10Accounts, myTop10Addresses } = useHomeAssetAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = selectedChainItem?.chain;
  const [showAllProtocols, setShowAllProtocols] = useState(false);
  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.defi);

  useScrollToTopOnChainChange({
    chain,
    isCurrentTab: isFocusing,
  });
  const getAccountByAddress = useFindAccountByAddress(myTop10Accounts);
  const { triggerUpdate } = addressBalanceStore.useAccountsBalanceTrigger();

  const multiProtocolsKey = useMemo(() => {
    return getMultiProtocolsCacheKey(myTop10Addresses, chain);
  }, [chain, myTop10Addresses]);

  const registerMultiAssets =
    useProtocolListComputedStore.getState().registerMultiProtocols;

  const protocolProjection = useActivityStore(
    useProtocolListComputedStore,
    useShallow(state => ({
      result:
        state.multiProtocolsIndexCache[multiProtocolsKey] ||
        EMPTY_PROTOCOL_ASSETS_INDEX_RESULT,
      availability:
        state.multiProtocolsAvailabilityByKey[multiProtocolsKey] ||
        'unresolved',
    })),
    Object.is,
    { storeLabel: 'home-multi-assets-defi-computed-index' },
  );
  const protocolIndex = protocolProjection.result;

  const isLoading = useActivityStore(
    useProtocols,
    state => state.isLoading,
    Object.is,
    { storeLabel: 'home-multi-assets-defi-loading' },
  );
  const protocolProjectionViewState = resolveAssetProjectionViewState({
    availability: protocolProjection.availability,
    hasData: protocolIndex.protocolIds.length > 0,
  });

  // The high-cardinality probe intentionally selects Watch addresses. Keep the
  // assertion at the final entity-to-row boundary so it catches a future
  // account-filter mismatch that would otherwise leave a populated projection
  // visually blank.
  const [highCardinalityDefiRenderable, setHighCardinalityDefiRenderable] =
    useState<Readonly<Record<string, unknown>> | null>(null);
  const highCardinalityRenderableProtocolIds = useMemo(
    () => protocolIndex.protocolIds.slice(0, 5),
    [protocolIndex.protocolIds],
  );
  useEffect(() => {
    if (
      !isHighCardinalityRegressionScenario ||
      !regressionScenarioRunId ||
      protocolProjectionViewState !== 'data' ||
      !highCardinalityRenderableProtocolIds.length
    ) {
      return;
    }

    let disposed = false;
    const checkRenderableRows = () => {
      if (disposed) {
        return;
      }
      const valueMap = protocolEntityResourceStore.getState().valueMap;
      const renderableCount = highCardinalityRenderableProtocolIds.reduce(
        (count, protocolId) => {
          const protocol = valueMap[protocolId];
          return (
            count +
            Number(
              Boolean(protocol && getAccountByAddress(protocol.owner_addr)),
            )
          );
        },
        0,
      );

      if (renderableCount !== highCardinalityRenderableProtocolIds.length) {
        return;
      }

      setHighCardinalityDefiRenderable(previous => {
        if (previous?.runId === regressionScenarioRunId) {
          return previous;
        }
        return {
          runId: regressionScenarioRunId,
          protocolCount: protocolIndex.protocolIds.length,
          sampleSize: highCardinalityRenderableProtocolIds.length,
          renderableCount,
        };
      });
    };

    checkRenderableRows();
    return protocolEntityResourceStore.subscribe(checkRenderableRows);
  }, [
    getAccountByAddress,
    highCardinalityRenderableProtocolIds,
    isHighCardinalityRegressionScenario,
    protocolIndex.protocolIds.length,
    protocolProjectionViewState,
    regressionScenarioRunId,
  ]);
  useRegressionScenarioAssertion(
    'high-cardinality-defi-rows-renderable',
    highCardinalityDefiRenderable?.runId === regressionScenarioRunId
      ? highCardinalityDefiRenderable
      : null,
  );

  const shouldDefaultExpand = useMemo(
    () => protocolIndex.defaultVisibleProtocolCount <= 5,
    [protocolIndex.defaultVisibleProtocolCount],
  );

  const portfolioListData = useMemo(() => {
    const visibleDefiList: ProtocolListItem[] = protocolIndex.protocolIds
      .slice(0, protocolIndex.defaultVisibleProtocolCount)
      .map(protocolId => ({
        type: 'visible-defi',
        protocolId,
      }));
    const foldedDefiList: ProtocolListItem[] = protocolIndex.protocolIds
      .slice(protocolIndex.defaultVisibleProtocolCount)
      .map(protocolId => ({
        type: 'folded-defi',
        protocolId,
      }));

    const itemData: Array<{
      show: boolean;
      data: ProtocolListItem[];
    }> = [
      {
        show: true,
        data: visibleDefiList,
      },
      {
        show: foldedDefiList.length > 0,
        data: [
          {
            type: 'toggle-defi',
            data: protocolIndex.foldedProtocolUsdValue,
          },
          ...(showAllProtocols ? foldedDefiList : []),
        ],
      },
      {
        show: protocolProjectionViewState === 'loading',
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: index.toString(),
        })),
      },
      {
        show: protocolProjectionViewState === 'empty',
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
  }, [protocolIndex, protocolProjectionViewState, showAllProtocols, t]);

  const lastHighCardinalityRenderStateKeyRef = useRef<string | null>(null);
  const lastHighCardinalityListMeasurementKeyRef = useRef<string | null>(null);
  const reportHighCardinalityListMeasurement = useCallback(
    (mark: string, details: Record<string, number>) => {
      if (!isHighCardinalityRegressionScenario || !regressionScenarioReport) {
        return;
      }

      const measurementKey = [
        regressionScenarioRunId,
        mark,
        ...Object.entries(details).flat(),
      ].join(':');
      if (lastHighCardinalityListMeasurementKeyRef.current === measurementKey) {
        return;
      }
      lastHighCardinalityListMeasurementKeyRef.current = measurementKey;

      regressionScenarioReport('perf-mark', {
        mark,
        ...details,
      });
    },
    [
      isHighCardinalityRegressionScenario,
      regressionScenarioReport,
      regressionScenarioRunId,
    ],
  );
  const onHighCardinalityListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      reportHighCardinalityListMeasurement('home-assets-defi-list-layout', {
        width,
        height,
        itemCount: portfolioListData.length,
      });
    },
    [portfolioListData.length, reportHighCardinalityListMeasurement],
  );
  const onHighCardinalityListContentSizeChange = useCallback(
    (width: number, height: number) => {
      reportHighCardinalityListMeasurement(
        'home-assets-defi-list-content-size',
        {
          width,
          height,
          itemCount: portfolioListData.length,
        },
      );
    },
    [portfolioListData.length, reportHighCardinalityListMeasurement],
  );
  const highCardinalityListReporterRef = useRef<
    ((mark: string, details: Record<string, number>) => void) | null
  >(null);
  highCardinalityListReporterRef.current = reportHighCardinalityListMeasurement;
  const onHighCardinalityViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<ViewToken<ProtocolListItem>>;
    }) => {
      const visibleProtocolCount = viewableItems.filter(
        item => item.isViewable && item.item?.type !== 'loading-defi-skeleton',
      ).length;
      highCardinalityListReporterRef.current?.(
        'home-assets-defi-list-viewable-items',
        {
          itemCount: viewableItems.length,
          visibleProtocolCount,
        },
      );
    },
  ).current;
  useEffect(() => {
    if (
      !isHighCardinalityRegressionScenario ||
      !regressionScenarioRunId ||
      !regressionScenarioReport
    ) {
      return;
    }

    const stateKey = [
      regressionScenarioRunId,
      isFocused,
      isFocusing,
      protocolProjection.availability,
      protocolProjectionViewState,
      protocolIndex.protocolIds.length,
      protocolIndex.defaultVisibleProtocolCount,
      portfolioListData.length,
      showAllProtocols,
    ].join(':');
    if (lastHighCardinalityRenderStateKeyRef.current === stateKey) {
      return;
    }
    lastHighCardinalityRenderStateKeyRef.current = stateKey;

    regressionScenarioReport('perf-mark', {
      mark: 'home-assets-defi-render-state',
      isFocused,
      isFocusing,
      availability: protocolProjection.availability,
      viewState: protocolProjectionViewState,
      protocolCount: protocolIndex.protocolIds.length,
      defaultVisibleProtocolCount: protocolIndex.defaultVisibleProtocolCount,
      listItemCount: portfolioListData.length,
      showAllProtocols,
    });
  }, [
    isFocused,
    isFocusing,
    portfolioListData.length,
    protocolIndex.defaultVisibleProtocolCount,
    protocolIndex.protocolIds.length,
    protocolProjection.availability,
    protocolProjectionViewState,
    isHighCardinalityRegressionScenario,
    regressionScenarioReport,
    regressionScenarioRunId,
    showAllProtocols,
  ]);

  const lastHighCardinalityEntitySnapshotKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !isHighCardinalityRegressionScenario ||
      !regressionScenarioRunId ||
      !regressionScenarioReport ||
      !protocolIndex.protocolIds.length
    ) {
      return;
    }

    const sampledProtocolIds = protocolIndex.protocolIds.slice(0, 32);
    const valueMap = protocolEntityResourceStore.getState().valueMap;
    const resolvedCount = sampledProtocolIds.reduce(
      (count, protocolId) => count + Number(Boolean(valueMap[protocolId])),
      0,
    );
    const stateKey = [
      regressionScenarioRunId,
      protocolIndex.protocolIds.length,
      sampledProtocolIds.length,
      resolvedCount,
      Object.keys(valueMap).length,
    ].join(':');
    if (lastHighCardinalityEntitySnapshotKeyRef.current === stateKey) {
      return;
    }
    lastHighCardinalityEntitySnapshotKeyRef.current = stateKey;

    regressionScenarioReport('perf-mark', {
      mark: 'home-assets-defi-entity-snapshot',
      protocolCount: protocolIndex.protocolIds.length,
      sampleSize: sampledProtocolIds.length,
      resolvedCount,
      missingCount: sampledProtocolIds.length - resolvedCount,
      entityCount: Object.keys(valueMap).length,
    });
  }, [
    isHighCardinalityRegressionScenario,
    protocolIndex.protocolIds,
    regressionScenarioReport,
    regressionScenarioRunId,
  ]);

  const hasNotAssets = useMemo(() => {
    return protocolProjectionViewState === 'empty' && isFocused;
  }, [protocolProjectionViewState, isFocused]);

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
    isFocused,
    multiProtocolsKey,
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
      protocolProjectionViewState === 'loading'
    ) {
      return;
    }

    const visibleCount = protocolIndex.defaultVisibleProtocolCount;
    const readyKey = [
      regressionScenarioRunId,
      multiProtocolsKey,
      visibleCount,
    ].join(':');
    if (lastReadyReportKeyRef.current === readyKey) {
      return;
    }
    lastReadyReportKeyRef.current = readyKey;

    regressionScenarioReport('assertion', {
      assertion: 'home-assets-defi-ready',
      passed: true,
      state: visibleCount > 0 ? 'data' : 'empty-defi',
      accountCount: myTop10Addresses.length,
      visibleCount,
      selectedChain: chain || null,
    });
  }, [
    chain,
    isFocused,
    protocolProjectionViewState,
    protocolIndex.defaultVisibleProtocolCount,
    multiProtocolsKey,
    myTop10Addresses.length,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioReport,
    regressionScenarioRunId,
    scenarioReadyCheckTick,
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

  const renderItem = useCallback<ListRenderItem<ProtocolListItem>>(
    ({ item }) => {
      const { type } = item;
      switch (type) {
        case 'visible-defi':
          return (
            <ProtocolResourceRow
              protocolId={item.protocolId}
              getAccountByAddress={getAccountByAddress}
              style={styles.fullDefi}
              disableAction={isLoading}
              defaultExpand={shouldDefaultExpand}
            />
          );
        case 'toggle-defi':
          return (
            <TokenRowSectionHeader
              style={styles.tokenSectionHeader}
              str={item.data}
              fold={!showAllProtocols}
              onPressFold={() => setShowAllProtocols(visible => !visible)}
            />
          );
        case 'folded-defi':
          return (
            <ProtocolResourceRow
              protocolId={item.protocolId}
              getAccountByAddress={getAccountByAddress}
              style={styles.fullDefi}
              disableAction={isLoading}
              defaultExpand={false}
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
      styles.defiLoading,
      styles.emptyAssets,
      styles.fullDefi,
      getAccountByAddress,
      isLoading,
      showAllProtocols,
      shouldDefaultExpand,
      styles.tokenSectionHeader,
    ],
  );

  const onRefresh = useCallback(async () => {
    const balanceRefresh = triggerUpdate(true);
    const protocolRefresh = batchGetProtocols(myTop10Addresses, true);

    withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(error => {
      console.error('Refresh balance failed:', error);
    });

    try {
      await protocolRefresh;
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
        keyExtractor={getProtocolListItemId}
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
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={32}
        removeClippedSubviews={IS_ANDROID}
        {...(!IS_ANDROID && {
          maintainVisibleContentPosition: { minIndexForVisible: 0 },
        })}
        onLayout={onHighCardinalityListLayout}
        onContentSizeChange={onHighCardinalityListContentSizeChange}
        onViewableItemsChanged={onHighCardinalityViewableItemsChanged}
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
    paddingHorizontal: 12,
    paddingBottom: 48,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  defiLoading: {
    paddingHorizontal: 0,
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
