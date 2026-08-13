import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { ListRenderItem, ViewStyle } from 'react-native';
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
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

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

  const registerMultiAssets =
    useProtocolListComputedStore.getState().registerMultiProtocols;

  const protocolIndex = useActivityStore(
    useProtocolListComputedStore,
    useShallow(
      state =>
        state.multiProtocolsIndexCache[multiProtocolsKey] ||
        EMPTY_PROTOCOL_ASSETS_INDEX_RESULT,
    ),
    Object.is,
    { storeLabel: 'home-multi-assets-defi-computed-index' },
  );

  const isLoading = useActivityStore(
    useProtocols,
    state => state.isLoading,
    Object.is,
    { storeLabel: 'home-multi-assets-defi-loading' },
  );

  const shouldDefaultExpand = useMemo(
    () => protocolIndex.unFoldIds.length <= 5,
    [protocolIndex.unFoldIds.length],
  );

  const portfolioListData = useMemo(() => {
    const unfoldDeFiList: ProtocolListItem[] = protocolIndex.unFoldIds.map(
      protocolId => ({
        type: 'unfold_defi',
        protocolId,
      }),
    );
    const foldDeFiList: ProtocolListItem[] = protocolIndex.foldIds.map(
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
        data: unfoldDeFiList,
      },
      {
        show: !!foldDeFiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
            data: protocolIndex.foldDeFiValue,
          },
          ...(foldDefi ? [] : foldDeFiList),
        ],
      },
      {
        show:
          !!isLoading &&
          !protocolIndex.unFoldIds.length &&
          !protocolIndex.foldIds.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: index.toString(),
        })),
      },
      {
        show:
          !isLoading &&
          protocolIndex.unFoldIds.length === 0 &&
          protocolIndex.foldIds.length === 0,
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
    protocolIndex.foldDeFiValue,
    protocolIndex.foldIds,
    protocolIndex.unFoldIds,
    t,
  ]);

  const hasNotAssets = useMemo(() => {
    return (
      protocolIndex.unFoldIds.length === 0 &&
      protocolIndex.foldIds.length === 0 &&
      !isLoading &&
      isFocused
    );
  }, [
    protocolIndex.foldIds.length,
    protocolIndex.unFoldIds.length,
    isLoading,
    isFocused,
  ]);

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
      isLoading
    ) {
      return;
    }

    const visibleCount = protocolIndex.unFoldIds.length;
    const foldedCount = protocolIndex.foldIds.length;
    const readyKey = [
      regressionScenarioRunId,
      multiProtocolsKey,
      visibleCount,
      foldedCount,
    ].join(':');
    if (lastReadyReportKeyRef.current === readyKey) {
      return;
    }
    lastReadyReportKeyRef.current = readyKey;

    regressionScenarioReport('assertion', {
      assertion: 'home-assets-defi-ready',
      passed: true,
      state: visibleCount + foldedCount > 0 ? 'data' : 'empty-defi',
      accountCount: myTop10Addresses.length,
      visibleCount,
      foldedCount,
      selectedChain: chain || null,
    });
  }, [
    chain,
    isFocused,
    isLoading,
    protocolIndex.foldIds.length,
    protocolIndex.unFoldIds.length,
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
        case 'unfold_defi':
        case 'fold_defi':
          return (
            <ProtocolResourceRow
              protocolId={item.protocolId}
              getAccountByAddress={getAccountByAddress}
              style={styles.fullDefi}
              disableAction={isLoading}
              defaultExpand={type === 'fold_defi' ? false : shouldDefaultExpand}
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
