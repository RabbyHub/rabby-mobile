import RcSortArrowDown from '@/assets2024/icons/perps/PerpsProSortArrowDown.svg';
import RcSortArrowUp from '@/assets2024/icons/perps/PerpsProSortArrowUp.svg';
import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  addFavoriteMarket,
  perpsStore,
  removeFavoriteMarket,
  type PerpsState,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TouchableOpacity as BottomSheetTouchableOpacity } from '@gorhom/bottom-sheet';
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
import PagerView, {
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import { useTranslation } from 'react-i18next';
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
import { getPerpsProBottomSheetChromeStyles } from '../common/perpsProVisual';
import {
  PerpsProMarketList,
  type PerpsProMarketListHandle,
} from './PerpsProMarketList';
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
  onSelect: (
    market: PerpsProMarket,
  ) => boolean | void | Promise<boolean | void>;
};

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
>(({ currentMarketKey, onClose, onPrefetch, onSelect }, ref) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const pagerRef = useRef<PagerView>(null);
  const listRefs = useRef(
    new Map<PerpsProMarketTab | 'search', PerpsProMarketListHandle>(),
  );
  const searchRef = useRef<PerpsProMarketSearchBarHandle>(null);
  const projectionRef = useRef(EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION);
  const selectionRequestRef = useRef(0);
  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<PerpsProMarketTab>('all');
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

  useLayoutEffect(() => {
    projectionRef.current = projection;
  }, [projection]);
  const visibleCategories = useMemo(
    () =>
      buildVisiblePerpsProCategoriesFromIds(categories, projection.categoryIds),
    [categories, projection.categoryIds],
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
  const isSearchMode = inputFocused || !!query.trim();
  const tabIdsKey = tabs.map(tab => tab.id).join('\u0000');
  const activeTabIndex = Math.max(
    0,
    tabs.findIndex(tab => tab.id === resolvedActiveTab),
  );
  const preparedTabIds = useMemo(() => {
    const tabIds = tabIdsKey.split('\u0000') as PerpsProMarketTab[];
    const result = new Set<PerpsProMarketTab>();
    for (
      let index = Math.max(0, activeTabIndex - 1);
      index <= Math.min(tabIds.length - 1, activeTabIndex + 1);
      index += 1
    ) {
      const tabId = tabIds[index];
      if (tabId) {
        result.add(tabId);
      }
    }
    return result;
  }, [activeTabIndex, tabIdsKey]);
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
  const searchSlots = searchSlotOrders[sort.field][sort.direction];
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
  const backdropProps = useMemo(
    () => ({ onPress: Keyboard.dismiss, pressBehavior: 'close' as const }),
    [],
  );

  useEffect(() => {
    if (resolvedActiveTab !== activeTab) {
      setActiveTab(resolvedActiveTab);
    }
  }, [activeTab, resolvedActiveTab]);

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
    markDismissed();
    Keyboard.dismiss();
    searchRef.current?.blur();
    setQuery('');
    setInputFocused(false);
    setActiveTab('all');
    onClose?.();
  }, [markDismissed, onClose]);
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
        void Promise.resolve(result).then(
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
      currentFavoriteMarkets.some(item => item.toUpperCase() === canonicalCoin)
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
      if (targetIndex < 0 || targetIndex === activeTabIndex) {
        return;
      }
      const distance = Math.abs(targetIndex - activeTabIndex);
      setActiveTab(tab);
      requestAnimationFrame(() => {
        if (distance === 1) {
          pagerRef.current?.setPage(targetIndex);
        } else {
          pagerRef.current?.setPageWithoutAnimation(targetIndex);
        }
      });
    },
    [activeTabIndex, tabs],
  );
  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const selectedTab = tabs[event.nativeEvent.position];
      if (selectedTab) {
        setActiveTab(selectedTab.id);
      }
    },
    [tabs],
  );
  return (
    <PerpsProMarketSelectorDismissProvider onDismiss={dismissSelector}>
      <AppBottomSheetModal
        android_keyboardInputMode="adjustPan"
        backdropProps={backdropProps}
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
          {!isSearchMode ? (
            <PerpsProMarketTabs
              activeTab={resolvedActiveTab}
              onChange={selectTab}
              tabs={tabs}
            />
          ) : null}
          {!isSearchMode ? (
            <View
              style={styles.columnHeader}
              testID="perps-pro-market-column-header">
              <View style={styles.sortGroup}>
                <BottomSheetTouchableOpacity
                  activeOpacity={1}
                  accessibilityLabel={t('page.perps.pro.marketSelector.name')}
                  accessibilityRole="button"
                  onPress={() => selectSort('name')}
                  style={styles.sortControl}
                  testID="perps-pro-market-sort-name">
                  <View style={styles.sortControlContent}>
                    <Text style={styles.columnText}>
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
                  accessibilityLabel={t('page.perps.pro.marketSelector.volume')}
                  accessibilityRole="button"
                  onPress={() => selectSort('volume')}
                  style={styles.sortControl}
                  testID="perps-pro-market-sort-volume">
                  <View style={styles.sortControlContent}>
                    <Text style={styles.columnText}>
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
          ) : null}
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
                onSelect={selectMarket}
                onToggleFavorite={toggleFavorite}
                pageTab="search"
                ref={handle => setListRef('search', handle)}
                searchMode
              />
            </View>
          ) : (
            <PagerView
              initialPage={activeTabIndex}
              key={tabIdsKey}
              onPageSelected={handlePageSelected}
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
                        onSelect={selectMarket}
                        onToggleFavorite={toggleFavorite}
                        pageTab={tab.id}
                        ref={handle => setListRef(tab.id, handle)}
                        searchMode={false}
                      />
                    ) : null}
                  </View>
                );
              })}
            </PagerView>
          )}
        </View>
      </AppBottomSheetModal>
    </PerpsProMarketSelectorDismissProvider>
  );
});

PerpsProMarketSelectorComponent.displayName = 'PerpsProMarketSelector';

export const PerpsProMarketSelector = React.memo(
  PerpsProMarketSelectorComponent,
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProBottomSheetChromeStyles(colors2024),
  sheet: {
    flex: 1,
    paddingTop: 0,
  },
  pager: {
    flex: 1,
  },
  page: {
    height: '100%',
    width: '100%',
  },
  search: {
    marginLeft: 15,
    marginRight: 15,
    marginTop: 0,
  },
  searchResults: {
    flex: 1,
    paddingTop: 16,
  },
  columnHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    height: 46,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  sortGroup: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    height: 44,
  },
  sortControl: {
    height: 44,
    minWidth: 44,
    paddingTop: 16,
  },
  sortControlContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  sortSeparator: {
    backgroundColor: colors2024['neutral-line'],
    height: 14,
    marginTop: 18,
    width: 1,
  },
  columnText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  sortIcon: {
    height: 8.52016,
    justifyContent: 'space-between',
    width: 4.24675,
  },
}));
