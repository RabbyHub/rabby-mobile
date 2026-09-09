import RcSortArrowDown from '@/assets2024/icons/perps/PerpsProSortArrowDown.svg';
import RcSortArrowUp from '@/assets2024/icons/perps/PerpsProSortArrowUp.svg';
import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { uiRefreshTimeout } from '@/core/apis/autoLock';
import { IS_IOS } from '@/core/native/utils';
import {
  addFavoriteMarket,
  perpsStore,
  removeFavoriteMarket,
  type PerpsState,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { useAppLanguage } from '@/hooks/lang';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  TouchableOpacity as BottomSheetTouchableOpacity,
} from '@gorhom/bottom-sheet';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { getPerpsProMarketSelectorSnapPoint } from '../../model/layout';
import {
  buildVisiblePerpsProCategoriesFromIds,
  getNextPerpsProSort,
  type PerpsProMarket,
  type PerpsProSortDirection,
  type PerpsProMarketTab,
} from '../../model/market';
import {
  buildPerpsProMarketSlotOrders,
  EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION,
  reconcilePerpsProMarketSelectorProjection,
  resolvePerpsProMarketFromLatestData,
} from '../../model/marketSelectorProjection';
import {
  getPerpsProMarketSession,
  setPerpsProSessionSort,
} from '../../session/perpsProMarketSession';
import { snapPerpsProTabIndicator } from '../common/PerpsProTabIndicator';
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import {
  PerpsProMarketList,
  type PerpsProMarketListHandle,
} from './PerpsProMarketList';
import {
  PerpsProMarketPager,
  type PerpsProMarketPagerHandle,
} from './PerpsProMarketPager';
import { PerpsProMarketTabs } from './PerpsProMarketTabs';
import {
  PerpsProMarketSearchBar,
  type PerpsProMarketSearchBarHandle,
} from './PerpsProMarketSearchBar';
import {
  PerpsProMarketSelectorDismissProvider,
  PerpsProMarketSelectorGestureContainer,
  usePerpsProMarketSelectorDismiss,
} from './usePerpsProMarketSelectorDismiss';

const PerpsProSortIcon: React.FC<{
  active: boolean;
  direction: PerpsProSortDirection;
}> = ({ active, direction }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.sortIcon}>
      <RcSortArrowUp
        color={
          active && direction === 'asc'
            ? colors2024['brand-default']
            : colors2024['neutral-info']
        }
        height={3.76008}
        width={4.24671}
      />
      <RcSortArrowDown
        color={
          active && direction === 'desc'
            ? colors2024['brand-default']
            : colors2024['neutral-info']
        }
        height={3.76008}
        width={4.24675}
      />
    </View>
  );
};

export type PerpsProMarketSelectorHandle = {
  present: () => void;
};

type PerpsProMarketSelectorProps = {
  currentMarketKey: string | null;
  onClose?: () => void;
  onPrefetch?: (coin: string) => void;
  onRealtimeIntentCancel?: (marketKey: string) => void;
  onRealtimeIntentStart?: (market: PerpsProMarket) => void;
  onSelect: (
    market: PerpsProMarket,
  ) => boolean | void | Promise<boolean | void>;
};

type PendingMarketTabPageRequest = {
  frameId: number | null;
  generation: number;
  targetIndex: number;
};

type PerpsProMarketTabSessionHandle = {
  snapToPage: (position: number) => void;
};

// Numeric progress is meaningful only within one tab sequence. Initialize it
// alongside the keyed Tabs/Pager, before their first render reads the value.
const PerpsProMarketTabSession = forwardRef<
  PerpsProMarketTabSessionHandle,
  {
    initialPage: number;
    children: (position: SharedValue<number>) => React.ReactNode;
  }
>(({ children, initialPage }, ref) => {
  const position = useSharedValue(initialPage);
  useImperativeHandle(
    ref,
    () => ({
      snapToPage: index => snapPerpsProTabIndicator(position, index),
    }),
    [position],
  );
  return <>{children(position)}</>;
});

PerpsProMarketTabSession.displayName = 'PerpsProMarketTabSession';

const createProjectionSelector = () => {
  let previousMarketData: PerpsState['marketData'] | null = null;
  let projection = EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION;

  return (state: PerpsState) => {
    if (state.marketData !== previousMarketData) {
      const nextProjection = reconcilePerpsProMarketSelectorProjection(
        state.marketData,
        projection,
      );
      previousMarketData = state.marketData;
      projection = nextProjection;
    }
    return projection;
  };
};

const PerpsProMarketSelectorComponent = forwardRef<
  PerpsProMarketSelectorHandle,
  PerpsProMarketSelectorProps
>(
  (
    {
      currentMarketKey,
      onClose,
      onPrefetch,
      onRealtimeIntentCancel,
      onRealtimeIntentStart,
      onSelect,
    },
    ref,
  ) => {
    const { height, width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { currentLanguage } = useAppLanguage();
    const { t } = useTranslation();
    const modalRef = useRef<AppBottomSheetModal>(null);
    const pagerRef = useRef<PerpsProMarketPagerHandle>(null);
    const listRefs = useRef(
      new Map<PerpsProMarketTab | 'search', PerpsProMarketListHandle>(),
    );
    const searchRef = useRef<PerpsProMarketSearchBarHandle>(null);
    const projectionRef = useRef(EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION);
    const selectionRequestRef = useRef(0);
    const pendingTabPageRequestRef = useRef<PendingMarketTabPageRequest | null>(
      null,
    );
    const tabPageRequestGenerationRef = useRef(0);
    const tabSessionRef = useRef<PerpsProMarketTabSessionHandle>(null);
    const [query, setQuery] = useState('');
    const [inputFocused, setInputFocused] = useState(false);
    const [tabPresentation, setTabPresentation] = useState<{
      activeTab: PerpsProMarketTab;
      previewTab: PerpsProMarketTab | null;
    }>({ activeTab: 'all', previewTab: null });
    const { activeTab, previewTab } = tabPresentation;
    const [sort, setSort] = useState(() => {
      const initialSort = getPerpsProMarketSession();
      return {
        direction: initialSort.sortDirection,
        field: initialSort.sortField,
      };
    });
    const { categories, favoriteMarkets, marketDataStatus } = perpsStore(
      useShallow(state => ({
        categories: state.categories,
        favoriteMarkets: state.favoriteMarkets,
        marketDataStatus: state.marketDataStatus,
      })),
    );
    const selectProjection = useMemo(createProjectionSelector, []);
    const projection = perpsStore(selectProjection);

    const cancelPendingTabPageRequest = useCallback(() => {
      tabPageRequestGenerationRef.current += 1;
      const pendingRequest = pendingTabPageRequestRef.current;
      pendingTabPageRequestRef.current = null;
      if (pendingRequest && pendingRequest.frameId !== null) {
        cancelAnimationFrame(pendingRequest.frameId);
      }
    }, []);

    useEffect(
      () => () => {
        cancelPendingTabPageRequest();
      },
      [cancelPendingTabPageRequest],
    );

    useLayoutEffect(() => {
      projectionRef.current = projection;
    }, [projection]);
    const visibleCategories = useMemo(
      () =>
        buildVisiblePerpsProCategoriesFromIds(
          categories,
          projection.categoryIds,
          currentLanguage,
        ),
      [categories, currentLanguage, projection.categoryIds],
    );
    const favoriteSet = useMemo(
      () => new Set(favoriteMarkets.map(item => item.toUpperCase())),
      [favoriteMarkets],
    );
    const hasVisibleFavorites = useMemo(() => {
      for (const record of projection.recordsByKey.values()) {
        if (favoriteSet.has(record.canonicalCoin.toUpperCase())) {
          return true;
        }
      }
      return false;
    }, [favoriteSet, projection.recordsByKey]);
    const tabs = useMemo(
      () => [
        ...(hasVisibleFavorites
          ? [
              {
                id: 'favorites',
                label: t('page.perps.pro.marketSelector.favorites'),
              },
            ]
          : []),
        { id: 'all', label: t('page.perps.pro.marketSelector.all') },
        ...visibleCategories,
      ],
      [hasVisibleFavorites, t, visibleCategories],
    );
    const validTabIds = useMemo(() => new Set(tabs.map(tab => tab.id)), [tabs]);
    const resolvedActiveTab = validTabIds.has(activeTab) ? activeTab : 'all';
    const resolvedPreviewTab =
      previewTab && validTabIds.has(previewTab) ? previewTab : null;
    const displayedTab = resolvedPreviewTab ?? resolvedActiveTab;
    const isSearchMode = inputFocused || !!query.trim();
    const tabIdsKey = tabs.map(tab => tab.id).join('\u0000');
    const tabLayoutKey = `${tabIdsKey}\u0002${tabs
      .map(tab => tab.label)
      .join('\u0000')}\u0002${width}`;
    const activeTabIndex = Math.max(
      0,
      tabs.findIndex(tab => tab.id === resolvedActiveTab),
    );
    const preparedTabIndex =
      IS_IOS && resolvedPreviewTab
        ? Math.max(
            0,
            tabs.findIndex(tab => tab.id === resolvedPreviewTab),
          )
        : activeTabIndex;
    const preparedTabIds = useMemo(() => {
      const tabIds = tabIdsKey.split('\u0000') as PerpsProMarketTab[];
      const result = new Set<PerpsProMarketTab>();
      for (
        let index = Math.max(0, preparedTabIndex - 1);
        index <= Math.min(tabIds.length - 1, preparedTabIndex + 1);
        index += 1
      ) {
        const tabId = tabIds[index];
        if (tabId) {
          result.add(tabId);
        }
      }
      return result;
    }, [preparedTabIndex, tabIdsKey]);
    const searchSlotOrders = useMemo(
      () =>
        buildPerpsProMarketSlotOrders(
          {
            orders: projection.orders,
            recordsByKey: projection.recordsByKey,
          },
          'all',
          favoriteMarkets,
          query,
        ),
      [favoriteMarkets, projection.orders, projection.recordsByKey, query],
    );
    const slotOrdersByPreparedTab = useMemo(() => {
      const result = new Map<
        PerpsProMarketTab,
        ReturnType<typeof buildPerpsProMarketSlotOrders>
      >();
      preparedTabIds.forEach(tab => {
        const slotOrders = buildPerpsProMarketSlotOrders(
          {
            orders: projection.orders,
            recordsByKey: projection.recordsByKey,
          },
          tab,
          favoriteMarkets,
          '',
        );
        result.set(tab, slotOrders);
      });
      return result;
    }, [
      favoriteMarkets,
      preparedTabIds,
      projection.orders,
      projection.recordsByKey,
    ]);
    const searchSlots = searchSlotOrders.volume.desc;
    const dismissSelector = useCallback(() => {
      Keyboard.dismiss();
      modalRef.current?.dismiss();
    }, []);
    const { markDismissed, markPresent, stableWindowHeight } =
      usePerpsProMarketSelectorDismiss({
        dismiss: dismissSelector,
        windowHeight: height,
      });
    const snapPoint = getPerpsProMarketSelectorSnapPoint({
      topInset: insets.top,
      windowHeight: stableWindowHeight,
    });
    const handleBackdropPress = useCallback(() => {
      uiRefreshTimeout();
      Keyboard.dismiss();
    }, []);
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          onPress={handleBackdropPress}
          opacity={0.3}
          pressBehavior="close"
          style={styles.backdrop}
        />
      ),
      [handleBackdropPress, styles.backdrop],
    );

    useEffect(() => {
      if (resolvedActiveTab !== activeTab) {
        setTabPresentation(current => ({
          ...current,
          activeTab: resolvedActiveTab,
        }));
      }
    }, [activeTab, resolvedActiveTab]);

    useEffect(() => {
      cancelPendingTabPageRequest();
      setTabPresentation(current =>
        current.previewTab === null
          ? current
          : { ...current, previewTab: null },
      );
    }, [cancelPendingTabPageRequest, isSearchMode, tabIdsKey]);

    useEffect(() => {
      const frame = requestAnimationFrame(() => {
        listRefs.current.forEach(list => list.scrollToTopIfNeeded());
      });
      return () => cancelAnimationFrame(frame);
    }, [query, resolvedActiveTab, sort.direction, sort.field]);

    useEffect(() => {
      setPerpsProSessionSort(sort.field, sort.direction);
    }, [sort.direction, sort.field]);

    const present = useCallback(() => {
      if (!modalRef.current) {
        return;
      }
      markPresent();
      modalRef.current.present();
    }, [markPresent]);
    useImperativeHandle(ref, () => ({ present }), [present]);
    const handleDismiss = useCallback(() => {
      selectionRequestRef.current += 1;
      cancelPendingTabPageRequest();
      markDismissed();
      Keyboard.dismiss();
      searchRef.current?.clear();
      searchRef.current?.blur();
      const allTabIndex = Math.max(
        0,
        tabs.findIndex(tab => tab.id === 'all'),
      );
      tabSessionRef.current?.snapToPage(allTabIndex);
      if (resolvedActiveTab !== 'all' || previewTab) {
        pagerRef.current?.setPageWithoutAnimation(allTabIndex);
      }
      setQuery('');
      setInputFocused(false);
      setTabPresentation({ activeTab: 'all', previewTab: null });
      onClose?.();
    }, [
      cancelPendingTabPageRequest,
      markDismissed,
      onClose,
      previewTab,
      resolvedActiveTab,
      tabs,
    ]);
    const selectSort = useCallback((field: 'name' | 'volume') => {
      setSort(current =>
        getNextPerpsProSort(current.field, current.direction, field),
      );
    }, []);
    const selectMarket = useCallback(
      (marketKey: string) => {
        const market = resolvePerpsProMarketFromLatestData(
          projectionRef.current,
          perpsStore.getState().marketDataMap,
          marketKey,
        );
        if (!market) {
          return;
        }
        const request = ++selectionRequestRef.current;
        const result = onSelect(market);
        if (result && typeof result === 'object' && 'then' in result) {
          Promise.resolve(result).then(
            committed => {
              if (
                request === selectionRequestRef.current &&
                committed !== false
              ) {
                dismissSelector();
              }
            },
            () => undefined,
          );
          return;
        }
        if (result !== false) {
          dismissSelector();
        }
      },
      [dismissSelector, onSelect],
    );
    const startRealtimeIntent = useCallback(
      (marketKey: string) => {
        const market = resolvePerpsProMarketFromLatestData(
          projectionRef.current,
          perpsStore.getState().marketDataMap,
          marketKey,
        );
        if (market) {
          onRealtimeIntentStart?.(market);
        }
      },
      [onRealtimeIntentStart],
    );
    const toggleFavorite = useCallback((marketKey: string) => {
      const market = resolvePerpsProMarketFromLatestData(
        projectionRef.current,
        perpsStore.getState().marketDataMap,
        marketKey,
      );
      if (!market) {
        return;
      }
      const currentFavoriteMarkets = perpsStore.getState().favoriteMarkets;
      const canonicalCoin = market.canonicalCoin.toUpperCase();
      if (
        currentFavoriteMarkets.some(
          item => item.toUpperCase() === canonicalCoin,
        )
      ) {
        removeFavoriteMarket(market.canonicalCoin);
      } else {
        addFavoriteMarket(market.canonicalCoin);
      }
    }, []);
    const setListRef = useCallback(
      (
        tab: PerpsProMarketTab | 'search',
        handle: PerpsProMarketListHandle | null,
      ) => {
        if (handle) {
          listRefs.current.set(tab, handle);
        } else {
          listRefs.current.delete(tab);
        }
      },
      [],
    );
    const selectTab = useCallback(
      (tab: PerpsProMarketTab) => {
        const targetIndex = tabs.findIndex(item => item.id === tab);
        if (targetIndex < 0) {
          return;
        }
        if (targetIndex === activeTabIndex) {
          if (pendingTabPageRequestRef.current?.targetIndex === targetIndex) {
            return;
          }
          setTabPresentation(current =>
            current.previewTab === null
              ? current
              : { ...current, previewTab: null },
          );
          return;
        }
        cancelPendingTabPageRequest();
        const distance = Math.abs(targetIndex - activeTabIndex);
        setTabPresentation({ activeTab: tab, previewTab: null });
        const requestGeneration = tabPageRequestGenerationRef.current;
        const pendingRequest: PendingMarketTabPageRequest = {
          frameId: null,
          generation: requestGeneration,
          targetIndex,
        };
        pendingTabPageRequestRef.current = pendingRequest;
        // A second press before the next frame supersedes this native command.
        pendingRequest.frameId = requestAnimationFrame(() => {
          if (
            pendingTabPageRequestRef.current !== pendingRequest ||
            requestGeneration !== tabPageRequestGenerationRef.current
          ) {
            return;
          }
          pendingRequest.frameId = null;
          if (distance === 1) {
            pagerRef.current?.setPage(targetIndex);
          } else {
            pagerRef.current?.setPageWithoutAnimation(targetIndex);
          }
          if (pendingTabPageRequestRef.current === pendingRequest) {
            pendingTabPageRequestRef.current = null;
          }
        });
      },
      [activeTabIndex, cancelPendingTabPageRequest, tabs],
    );
    const handlePagePreview = useCallback(
      (position: number | null) => {
        const pendingRequest = pendingTabPageRequestRef.current;
        if (
          pendingRequest &&
          position !== null &&
          position !== pendingRequest.targetIndex
        ) {
          return;
        }
        if (position === null) {
          setTabPresentation(current =>
            current.previewTab === null
              ? current
              : { ...current, previewTab: null },
          );
          return;
        }
        const nextPreviewTab = tabs[position]?.id ?? null;
        setTabPresentation(current =>
          current.previewTab === nextPreviewTab
            ? current
            : { ...current, previewTab: nextPreviewTab },
        );
      },
      [tabs],
    );
    const handlePageSelected = useCallback(
      (position: number) => {
        const pendingRequest = pendingTabPageRequestRef.current;
        if (pendingRequest && position !== pendingRequest.targetIndex) {
          return;
        }
        if (pendingRequest) {
          cancelPendingTabPageRequest();
        }
        const selectedTab = tabs[position];
        if (selectedTab) {
          setTabPresentation({
            activeTab: selectedTab.id,
            previewTab: null,
          });
          return;
        }
        setTabPresentation(current => ({ ...current, previewTab: null }));
      },
      [cancelPendingTabPageRequest, tabs],
    );
    return (
      <PerpsProMarketSelectorDismissProvider onDismiss={dismissSelector}>
        <AppBottomSheetModal
          android_keyboardInputMode="adjustPan"
          backdropComponent={renderBackdrop}
          containerComponent={PerpsProMarketSelectorGestureContainer}
          enableContentPanningGesture={false}
          enableDynamicSizing={false}
          enablePanDownToClose
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          onDismiss={handleDismiss}
          ref={modalRef}
          snapPoints={[snapPoint]}
          {...makeBottomSheetProps({
            colors: colors2024,
            linearGradientType: 'bg1',
          })}
          backgroundStyle={styles.background}
          handleIndicatorStyle={styles.handleIndicator}
          handleStyle={styles.handle}
          style={styles.modal}>
          <View style={styles.sheet} testID="perps-pro-market-selector-content">
            <PerpsProMarketSearchBar
              onChangeText={setQuery}
              onFocusChange={setInputFocused}
              placeholder={t('page.perps.pro.marketSelector.search')}
              ref={searchRef}
              style={styles.search}
              value={query}
            />
            {isSearchMode ? (
              <View
                style={styles.searchResults}
                testID="perps-pro-market-search-results">
                <PerpsProMarketList
                  bottomInset={insets.bottom}
                  currentMarketKey={currentMarketKey}
                  data={searchSlots}
                  favoriteSet={favoriteSet}
                  marketDataStatus={marketDataStatus}
                  onPrefetch={onPrefetch}
                  onRealtimeIntentCancel={onRealtimeIntentCancel}
                  onRealtimeIntentStart={startRealtimeIntent}
                  onSelect={selectMarket}
                  onToggleFavorite={toggleFavorite}
                  pageTab="search"
                  ref={handle => setListRef('search', handle)}
                  renderProfile="active"
                  searchMode
                />
              </View>
            ) : (
              <PerpsProMarketTabSession
                initialPage={activeTabIndex}
                key={tabIdsKey}
                ref={tabSessionRef}>
                {tabIndicatorPosition => (
                  <>
                    <PerpsProMarketTabs
                      activeTab={displayedTab}
                      indicatorPosition={tabIndicatorPosition}
                      key={tabLayoutKey}
                      onChange={selectTab}
                      tabs={tabs}
                    />
                    <View
                      style={styles.columnHeader}
                      testID="perps-pro-market-column-header">
                      <View style={styles.sortGroup}>
                        <BottomSheetTouchableOpacity
                          activeOpacity={1}
                          accessibilityLabel={t(
                            'page.perps.pro.marketSelector.name',
                          )}
                          accessibilityRole="button"
                          onPress={() => selectSort('name')}
                          style={[styles.sortControl, styles.nameSortControl]}
                          testID="perps-pro-market-sort-name">
                          <View style={styles.sortControlContent}>
                            <Text
                              style={[
                                styles.columnText,
                                sort.field === 'name'
                                  ? styles.activeColumnText
                                  : null,
                              ]}>
                              {t('page.perps.pro.marketSelector.name')}
                            </Text>
                            <PerpsProSortIcon
                              active={sort.field === 'name'}
                              direction={sort.direction}
                            />
                          </View>
                        </BottomSheetTouchableOpacity>
                        <View style={styles.sortSeparator} />
                        <BottomSheetTouchableOpacity
                          activeOpacity={1}
                          accessibilityLabel={t(
                            'page.perps.pro.marketSelector.volume',
                          )}
                          accessibilityRole="button"
                          onPress={() => selectSort('volume')}
                          style={styles.sortControl}
                          testID="perps-pro-market-sort-volume">
                          <View
                            style={[
                              styles.sortControlContent,
                              styles.volumeSortContent,
                            ]}>
                            <Text
                              style={[
                                styles.columnText,
                                sort.field === 'volume'
                                  ? styles.activeColumnText
                                  : null,
                              ]}>
                              {t('page.perps.pro.marketSelector.volume')}
                            </Text>
                            <PerpsProSortIcon
                              active={sort.field === 'volume'}
                              direction={sort.direction}
                            />
                          </View>
                        </BottomSheetTouchableOpacity>
                      </View>
                    </View>
                    <PerpsProMarketPager
                      indicatorPosition={tabIndicatorPosition}
                      initialPage={activeTabIndex}
                      key={tabIdsKey}
                      onPagePreview={handlePagePreview}
                      onPageSelected={handlePageSelected}
                      pageWidth={width}
                      ref={pagerRef}
                      style={styles.pager}
                      testID="perps-pro-market-pager">
                      {tabs.map(tab => {
                        const slotOrders = slotOrdersByPreparedTab.get(tab.id);
                        const slots = slotOrders?.[sort.field][sort.direction];
                        return (
                          <View
                            collapsable={false}
                            key={tab.id}
                            style={styles.page}
                            testID={`perps-pro-market-page-${tab.id}`}>
                            {slots ? (
                              <PerpsProMarketList
                                bottomInset={insets.bottom}
                                currentMarketKey={currentMarketKey}
                                data={slots}
                                favoriteSet={favoriteSet}
                                marketDataStatus={marketDataStatus}
                                onPrefetch={onPrefetch}
                                onRealtimeIntentCancel={onRealtimeIntentCancel}
                                onRealtimeIntentStart={startRealtimeIntent}
                                onSelect={selectMarket}
                                onToggleFavorite={toggleFavorite}
                                pageTab={tab.id}
                                ref={handle => setListRef(tab.id, handle)}
                                renderProfile={
                                  tab.id === resolvedActiveTab
                                    ? 'active'
                                    : 'prepared'
                                }
                                searchMode={false}
                              />
                            ) : null}
                          </View>
                        );
                      })}
                    </PerpsProMarketPager>
                  </>
                )}
              </PerpsProMarketTabSession>
            )}
          </View>
        </AppBottomSheetModal>
      </PerpsProMarketSelectorDismissProvider>
    );
  },
);

PerpsProMarketSelectorComponent.displayName = 'PerpsProMarketSelector';

export const PerpsProMarketSelector = React.memo(
  PerpsProMarketSelectorComponent,
);

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const chrome = getPerpsProBottomSheetChromeStyles(colors2024);
  return {
    ...chrome,
    handle: {
      ...chrome.handle,
      paddingTop: 10,
      paddingBottom: 40 - 10 - 6.272816181182861,
    },
    handleIndicator: {
      ...chrome.handleIndicator,
      width: 50.18252944946289,
      height: 6.272816181182861,
      borderRadius: 6.272816181182861 / 2,
    },
    backdrop: {
      flex: 1,
    },
    sheet: {
      flex: 1,
      paddingTop: 0,
    },
    pager: {
      flex: 1,
    },
    page: {
      flex: 1,
    },
    search: {
      marginLeft: 20,
      marginRight: 16,
      marginTop: 0,
    },
    searchResults: {
      flex: 1,
      paddingTop: 16,
    },
    columnHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      // The last 4pt of the tab strip only paint its divider/indicator.
      // Borrow that space for 44pt sort targets; the first row stays at y=180.
      height: 44,
      marginTop: -4,
      paddingHorizontal: 9,
    },
    sortGroup: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
      flex: 1,
      height: 44,
      paddingLeft: 7,
    },
    sortControl: {
      height: 44,
      minWidth: 44,
      paddingTop: 18,
      // Expand touch bounds without widening the visible label/arrow gaps.
      paddingHorizontal: 9,
      marginHorizontal: -9,
    },
    nameSortControl: {
      paddingHorizontal: 7,
      marginHorizontal: -7,
    },
    volumeSortContent: {
      gap: 5,
    },
    sortControlContent: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    sortSeparator: {
      backgroundColor: colors2024['neutral-line'],
      height: 12,
      marginTop: 20,
      width: 1,
    },
    columnText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    activeColumnText: {
      color: colors2024['brand-default'],
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
    },
    sortIcon: {
      height: 8.52016,
      justifyContent: 'space-between',
      width: 4.24675,
    },
  };
});
