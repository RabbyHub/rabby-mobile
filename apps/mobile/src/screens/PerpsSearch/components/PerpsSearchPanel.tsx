import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  MaterialTabBar,
  Tabs,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
  NextSearchBar,
  NextSearchBarMethods,
} from '@/components2024/SearchBar';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import {
  getPerpsProTabIndicatorStyle,
  PERPS_MARKET_TAB_LAYOUT,
} from '@/components2024/PerpsTab/visual';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsCategoryId } from '../../Perps/constants/perpsCategories';
import { usePerpsGroupedMarketData } from '../../Perps/hooks/usePerpsGroupedMarketData';
import { PerpsSearchTabLabel } from './PerpsSearchTabLabel';
import { PerpsSearchTabContent } from './PerpsSearchTabContent';
import { PerpsSearchFilteredList } from './PerpsSearchFilteredList';

const { gap: TAB_GAP, height: TAB_BAR_HEIGHT } = PERPS_MARKET_TAB_LAYOUT;

const FavoriteTabIcon: React.FC = () => {
  const { colors2024 } = useTheme2024();
  const focused = useFocusedTab();
  const isActive = focused === 'favorite';
  return (
    <RcIconFavorite
      width={18}
      height={18}
      color={
        isActive ? colors2024['orange-default'] : colors2024['neutral-info']
      }
    />
  );
};

/** Simple market search: shared by the full search page and the market
 * detail selector sheet, so both keep the Simple data and categories.
 */
export const PerpsSearchPanel: React.FC<{
  autoFocus?: boolean;
  initialTab?: string;
  leading?: React.ReactNode;
  onSelect: (coin: string) => void;
  style?: StyleProp<ViewStyle>;
}> = ({ autoFocus, initialTab, leading, onSelect, style }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const inputRef = useRef<NextSearchBarMethods | null>(null);

  const { marketData, favoriteMarkets, backendCategories } = perpsStore(
    useShallow(s => ({
      marketData: s.marketData,
      favoriteMarkets: s.favoriteMarkets,
      backendCategories: s.categories,
    })),
  );
  const { visibleSearchTabs } = usePerpsGroupedMarketData({
    marketData,
    favoriteMarkets,
    backendCategories,
  });

  const visibleTabIds = useMemo(
    () => visibleSearchTabs.map(tab => tab.id),
    [visibleSearchTabs],
  );

  const defaultTab: PerpsCategoryId = useMemo(() => {
    if (initialTab && visibleTabIds.includes(initialTab)) {
      return initialTab as PerpsCategoryId;
    }
    if (visibleTabIds.includes('topVolume')) {
      return 'topVolume';
    }
    return visibleTabIds[0] ?? 'topVolume';
  }, [initialTab, visibleTabIds]);

  const [search, setSearch] = useState('');

  // Remember the last user-selected tab
  const lastSelectedTabRef = useRef<PerpsCategoryId | null>(null);
  const handleTabChange = useCallback(({ tabName }: { tabName: string }) => {
    lastSelectedTabRef.current = tabName as PerpsCategoryId;
  }, []);
  const resolvedInitialTab =
    lastSelectedTabRef.current &&
    visibleTabIds.includes(lastSelectedTabRef.current)
      ? lastSelectedTabRef.current
      : defaultTab;

  const renderTabBar = useCallback(
    (props: any) => (
      <MaterialTabBar
        {...props}
        scrollEnabled
        keepActiveTabCentered
        style={styles.tabsBarContainer}
        contentContainerStyle={styles.tabsBarContent}
        tabStyle={styles.tabBar}
        indicatorStyle={styles.indicator}
      />
    ),
    [
      styles.indicator,
      styles.tabBar,
      styles.tabsBarContainer,
      styles.tabsBarContent,
    ],
  );

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const isSearching = search.trim().length > 0;

  return (
    <>
      <View style={[styles.header, style]}>
        {leading}
        <NextSearchBar
          ref={inputRef}
          style={styles.searchBar}
          placeholder={t('page.perps.search.placeholder')}
          value={search}
          onChangeText={setSearch}
          onCancel={() => setSearch('')}
          returnKeyType="done"
        />
      </View>

      {isSearching ? (
        <PerpsSearchFilteredList
          query={search}
          marketData={marketData}
          onSelect={onSelect}
        />
      ) : (
        <Tabs.Container
          key={visibleTabIds.join(',')}
          renderTabBar={renderTabBar}
          tabBarHeight={TAB_BAR_HEIGHT}
          lazy
          containerStyle={styles.container}
          headerContainerStyle={styles.tabBarWrap}
          initialTabName={resolvedInitialTab}
          onTabChange={handleTabChange}>
          {
            visibleSearchTabs.map(tab => {
              const isFav = tab.id === 'favorite';
              const renderLabel = ({ index: i, indexDecimal }: any) => (
                <PerpsSearchTabLabel
                  index={i}
                  indexDecimal={indexDecimal}
                  text={isFav ? '' : tab.cfg.label}
                  icon={isFav ? <FavoriteTabIcon /> : undefined}
                />
              );
              return (
                <Tabs.Tab key={tab.id} name={tab.id} label={renderLabel}>
                  <PerpsSearchTabContent
                    categoryId={tab.id}
                    items={tab.items}
                    showRank={tab.cfg.showRankOnSearch}
                    onSelect={onSelect}
                  />
                </Tabs.Tab>
              );
            }) as unknown as React.ReactElement<any>
          }
        </Tabs.Container>
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const bgColor = colors2024['neutral-bg-1'];
  return {
    header: {
      paddingHorizontal: 20,
      paddingLeft: 14,
      paddingTop: 6,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: bgColor,
    },
    searchBar: { flex: 1 },
    container: { flex: 1 },
    tabBarWrap: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
      borderBottomWidth: 1,
      backgroundColor: bgColor,
      borderBottomColor: colors2024['neutral-bg-5'],
    },
    tabBar: {
      height: TAB_BAR_HEIGHT,
      width: 'auto',
      flexShrink: 0,
      flex: 0,
      paddingHorizontal: 0,
      marginRight: TAB_GAP,
    },
    tabsBarContainer: {
      height: TAB_BAR_HEIGHT,
      backgroundColor: bgColor,
      flexGrow: 0,
    },
    tabsBarContent: {
      paddingHorizontal: PERPS_MARKET_TAB_LAYOUT.paddingHorizontal,
      alignItems: 'center',
    },
    indicator: getPerpsProTabIndicatorStyle(),
  };
});
