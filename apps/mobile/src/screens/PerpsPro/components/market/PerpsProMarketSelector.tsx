import RcSortArrowDown from '@/assets2024/icons/perps/PerpsProSortArrowDown.svg';
import RcSortArrowUp from '@/assets2024/icons/perps/PerpsProSortArrowUp.svg';
import { AppBottomSheetModal } from '@/components';
import { Text } from '@/components/Typography';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { NextSearchBar } from '@/components2024/SearchBar';
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
import { Pressable, useWindowDimensions, View } from 'react-native';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';
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
import {
  PerpsProMarketList,
  type PerpsProMarketListHandle,
} from './PerpsProMarketList';

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
  onSelect: (market: PerpsProMarket) => void;
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
>(({ currentMarketKey, onClose, onSelect }, ref) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors2024, isLight, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const listRef = useRef<PerpsProMarketListHandle>(null);
  const projectionRef = useRef(EMPTY_PERPS_PRO_MARKET_SELECTOR_PROJECTION);
  const [query, setQuery] = useState('');
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
  const tabs = useMemo(
    () => [
      {
        id: 'favorites',
        label: t('page.perps.pro.marketSelector.favorites'),
      },
      { id: 'all', label: t('page.perps.pro.marketSelector.all') },
      ...visibleCategories,
    ],
    [t, visibleCategories],
  );
  const visibleSlotOrders = useMemo(
    () =>
      buildPerpsProMarketSlotOrders(
        {
          orders: projection.orders,
          recordsByKey: projection.recordsByKey,
        },
        activeTab,
        favoriteMarkets,
        query,
      ),
    [
      activeTab,
      favoriteMarkets,
      projection.orders,
      projection.recordsByKey,
      query,
    ],
  );
  const visibleSlots = visibleSlotOrders[sort.field][sort.direction];
  const favoriteSet = useMemo(
    () => new Set(favoriteMarkets.map(item => item.toUpperCase())),
    [favoriteMarkets],
  );
  const snapPoint = getPerpsProMarketSelectorSnapPoint({
    topInset: insets.top,
    windowHeight: height,
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToTopIfNeeded();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, query, sort.direction, sort.field]);

  useEffect(() => {
    setPerpsProSessionSort(sort.field, sort.direction);
  }, [sort.direction, sort.field]);

  const present = useCallback(() => {
    modalRef.current?.present();
  }, []);
  useImperativeHandle(ref, () => ({ present }), [present]);
  const handleDismiss = useCallback(() => {
    setQuery('');
    setActiveTab('all');
    onClose?.();
  }, [onClose]);
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
      onSelect(market);
      modalRef.current?.dismiss();
    },
    [onSelect],
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
  return (
    <AppBottomSheetModal
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      onDismiss={handleDismiss}
      ref={modalRef}
      snapPoints={[snapPoint]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <View style={styles.sheet}>
        <NextSearchBar
          as="BottomSheetTextInput"
          noCancel
          onChangeText={setQuery}
          placeholder={t('page.perps.pro.marketSelector.search')}
          style={styles.search}
          value={query}
        />
        <GestureHandlerScrollView
          contentContainerStyle={styles.tabsContent}
          horizontal
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}>
          {tabs.map(tab => {
            const active = tab.id === activeTab;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveTab(tab.id)}
                style={styles.tab}>
                <Text style={active ? styles.activeTabText : styles.tabText}>
                  {tab.label}
                </Text>
                {active ? <View style={styles.activeTabIndicator} /> : null}
              </Pressable>
            );
          })}
        </GestureHandlerScrollView>
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
        <PerpsProMarketList
          bottomInset={insets.bottom}
          currentMarketKey={currentMarketKey}
          data={visibleSlots}
          favoriteSet={favoriteSet}
          marketDataStatus={marketDataStatus}
          onSelect={selectMarket}
          onToggleFavorite={toggleFavorite}
          ref={listRef}
        />
      </View>
    </AppBottomSheetModal>
  );
});

PerpsProMarketSelectorComponent.displayName = 'PerpsProMarketSelector';

export const PerpsProMarketSelector = React.memo(
  PerpsProMarketSelectorComponent,
);

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheet: {
    flex: 1,
    paddingTop: 8,
  },
  search: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  tabs: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    flexGrow: 0,
    marginTop: 10,
  },
  tabsContent: {
    gap: 14,
    paddingLeft: 16,
    paddingRight: 20,
  },
  tab: {
    alignItems: 'center',
    height: 40,
    paddingTop: 12,
  },
  tabText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  activeTabText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  activeTabIndicator: {
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 2,
    bottom: 0,
    height: 4,
    left: '50%',
    marginLeft: -10,
    position: 'absolute',
    width: 20,
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
    fontFamily: 'SF Pro Rounded',
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
