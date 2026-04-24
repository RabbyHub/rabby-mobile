import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  MaterialTabBar,
  Tabs,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { GetNestedScreenRouteProp } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { naviReplace } from '@/utils/navigation';
import {
  NextSearchBar,
  NextSearchBarMethods,
} from '@/components2024/SearchBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcNextLeftCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';

import CustomLabel from '../TokenDetail/components/CustomLabel';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsCategoryId } from '../Perps/constants/perpsCategories';
import { usePerpsGroupedMarketData } from '../Perps/hooks/usePerpsGroupedMarketData';
import { PerpsSearchTabContent } from './components/PerpsSearchTabContent';
import { PerpsSearchFilteredList } from './components/PerpsSearchFilteredList';

const TAB_GAP = 8;
const TAB_BAR_HEIGHT = 28;

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

export const PerpsSearchScreen: React.FC = () => {
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'PerpsSearch'>
    >();
  const params = route.params || {};
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
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
    if (params.initialTab && visibleTabIds.includes(params.initialTab)) {
      return params.initialTab;
    }
    if (visibleTabIds.includes('topVolume')) {
      return 'topVolume';
    }
    return visibleTabIds[0] ?? 'topVolume';
  }, [params.initialTab, visibleTabIds]);

  const handleSelect = useCallback(
    (coin: string) => {
      const openFromSource = params.openFromSource;
      naviReplace(RootNames.StackTransaction, {
        screen: RootNames.PerpsMarketDetail,
        params: {
          market: coin,
          fromSource: openFromSource,
          showOpenPosition: openFromSource === 'openPosition',
          direction: params.direction ?? 'Long',
        },
      });
    },
    [params.direction, params.openFromSource],
  );

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
    if (params.autoFocus) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [params.autoFocus]);

  const handleGoBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const isSearching = search.trim().length > 0;

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <View style={styles.header}>
        <TouchableOpacity hitSlop={12} onPress={handleGoBack}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} width={24} />
        </TouchableOpacity>
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
          onSelect={handleSelect}
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
                <CustomLabel
                  index={i}
                  indexDecimal={indexDecimal}
                  text={isFav ? '' : tab.cfg.label}
                  style={styles.tabLabel}
                  containerStyle={styles.tabLabelContainer}
                  icon={isFav ? <FavoriteTabIcon /> : undefined}
                />
              );
              return (
                <Tabs.Tab key={tab.id} name={tab.id} label={renderLabel}>
                  <PerpsSearchTabContent
                    categoryId={tab.id}
                    items={tab.items}
                    showRank={tab.cfg.showRankOnSearch}
                    onSelect={handleSelect}
                  />
                </Tabs.Tab>
              );
            }) as unknown as React.ReactElement<any>
          }
        </Tabs.Container>
      )}
    </NormalScreenContainer2024>
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
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    indicator: {
      backgroundColor: colors2024['neutral-body'],
      height: 4,
      borderRadius: 100,
    },
    tabLabelContainer: {
      height: TAB_BAR_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabLabel: { marginTop: 0 },
  };
});
