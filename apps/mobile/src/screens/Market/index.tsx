import React, { useCallback, useEffect, useMemo } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { RcNextSearchCC } from '@/assets/icons/common';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { atomByMMKV } from '@/core/storage/mmkv';
import { useTheme2024 } from '@/hooks/theme';
import { getMarketTabViewAction } from '@/screens/Market/analytics';
import { matomoRequestEvent } from '@/utils/analytics';
import { createGetStyles2024 } from '@/utils/styles';
import { useAtom } from 'jotai';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';

import CustomLabel from '../TokenDetail/components/CustomLabel';
import { DynamicCustomMaterialTabBar } from '../TokenDetail/components/CustomTabBar';
import { WatchlistContent } from '../Watchlist/WatchlistContent';
import { MarketCategoryContent } from './components/MarketCategoryContent';
import { useMarketVisibleTokenPriceRefresh } from './hooks/useMarketVisibleTokenPriceRefresh';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useSafeSizes } from '@/hooks/useAppLayout';

const isAndroid = Platform.OS === 'android';

type MarketTabKey = 'watchlist' | string;
const TAB_GAP = 8;
const FIRST_TAB_GAP = 12;
export const TAB_BAR_HEIGHT = 28;

const marketTabAtom = atomByMMKV<MarketTabKey>(
  '@market.activeTab',
  'watchlist',
  {
    getOnInit: true,
  },
);

const MARKET_TABS: { id: string; name: string; sort_fields: string[] }[] = [
  {
    id: 'hot',
    name: 'Top',
    sort_fields: ['fdv', 'price_change_24h'],
  },
  {
    id: 'meme',
    name: 'Memecoin',
    sort_fields: ['volume_24h', 'fdv', 'price_change_24h'],
  },
  {
    id: 'stock',
    name: 'Stock',
    sort_fields: ['price_change_24h'],
  },
  {
    id: 'commodities',
    name: 'Commodities',
    sort_fields: ['price_change_24h'],
  },
] as const;

const VALID_MARKET_TABS = new Set<MarketTabKey>([
  'watchlist',
  ...MARKET_TABS.map(tab => tab.id),
]);

export default function MarketScreen() {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { safeOffHeader } = useSafeSizes();

  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const [storedActiveTab, setStoredActiveTab] = useAtom(marketTabAtom);
  const activeTab = useMemo(
    () =>
      VALID_MARKET_TABS.has(storedActiveTab) ? storedActiveTab : 'watchlist',
    [storedActiveTab],
  );
  const handleVisibleUuidsChange = useMarketVisibleTokenPriceRefresh(activeTab);

  const renderHeaderRight = useCallback(
    () => (
      <Pressable
        hitSlop={10}
        style={styles.headerRight}
        onPress={() => {
          navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
            screen: RootNames.Search,
            params: {},
          });
        }}>
        <RcNextSearchCC
          width={20}
          height={20}
          color={colors2024['neutral-title-1']}
        />
      </Pressable>
    ),
    [colors2024, navigation, styles.headerRight],
  );

  useEffect(() => {
    setNavigationOptions({
      headerRight: renderHeaderRight,
    });
  }, [renderHeaderRight, setNavigationOptions]);

  useEffect(() => {
    const action = getMarketTabViewAction(storedActiveTab);

    if (!action) {
      return;
    }

    const timer = setTimeout(() => {
      matomoRequestEvent({
        category: 'Rabby Market',
        action,
      });
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [storedActiveTab]);

  const tabs = useMemo(
    () => [
      {
        key: 'watchlist',
        label: t('page.market.tabs.watchlist'),
      },
      ...MARKET_TABS.map(category => ({
        key: category.id,
        label: category.name,
        sortFields: category.sort_fields,
      })),
    ],
    [t],
  );

  const initialTabItemsLayout = useMemo(() => {
    let x = 20;
    return tabs.map((tab, index) => {
      const width = Math.max(60, tab.label.length * 12 + 20);
      const item = { x, width };
      x += width + (index === 0 ? FIRST_TAB_GAP : TAB_GAP);
      return item;
    });
  }, [tabs]);

  const renderTabBar = useCallback(
    (props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ...props,
          tabStyle: styles.tabBar,
        }}
        containerStyle={styles.tabsBarContainer}
        indicatorStyle={styles.indicator}
        initialTabItemsLayout={initialTabItemsLayout}
        initPaddingLeft={styles.tabsBarContainer?.paddingLeft ?? 0}
        getTabItemStyle={index =>
          index === 0 ? styles.firstTabBar : styles.restTabBar
        }
      />
    ),
    [
      initialTabItemsLayout,
      styles.firstTabBar,
      styles.indicator,
      styles.restTabBar,
      styles.tabBar,
      styles.tabsBarContainer,
    ],
  );

  const renderWatchlistLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text=""
        style={styles.tabLabel}
        containerStyle={styles.watchlistLabelContainer}
        icon={
          <RcIconFavorite
            width={18}
            height={18}
            color={
              Math.abs(index - indexDecimal.value) < 0.5
                ? colors2024['orange-default']
                : colors2024['neutral-info']
            }
          />
        }
      />
    ),
    [colors2024, styles.watchlistLabelContainer, styles.tabLabel],
  );

  return (
    <NormalScreenContainer2024
      type="bg1"
      overwriteStyle={[
        styles.overwriteStyle,
        {
          // 收窄范围
          paddingTop: safeOffHeader - (isAndroid ? 0 : 10),
        },
      ]}>
      <Tabs.Container
        renderTabBar={renderTabBar}
        tabBarHeight={TAB_BAR_HEIGHT}
        lazy
        containerStyle={styles.container}
        headerContainerStyle={styles.tabBarWrap}
        initialTabName={activeTab}
        onTabChange={({ tabName }) => {
          setStoredActiveTab(tabName);
        }}>
        <Tabs.Tab label={renderWatchlistLabel} name="watchlist">
          <WatchlistContent
            onVisibleUuidsChange={handleVisibleUuidsChange}
            visibleUuidsTabId="watchlist"
          />
        </Tabs.Tab>
        {
          MARKET_TABS.map(category => {
            const renderCategoryLabel = ({ index, indexDecimal }) => (
              <CustomLabel
                index={index}
                style={styles.tabLabel}
                containerStyle={styles.categoryLabelContainer}
                indexDecimal={indexDecimal}
                text={category.name}
              />
            );

            return (
              <Tabs.Tab
                key={category.id}
                label={renderCategoryLabel}
                name={category.id}>
                <View style={styles.content}>
                  <MarketCategoryContent
                    categoryId={category.id}
                    sortFields={category.sort_fields}
                    headerSpacerHeight={0}
                    onVisibleUuidsChange={handleVisibleUuidsChange}
                  />
                </View>
              </Tabs.Tab>
            );
          }) as unknown as React.ReactElement<any>
        }
      </Tabs.Container>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const bgColor = colors2024['neutral-bg-1'];
  return {
    overwriteStyle: {
      position: 'relative',
      backgroundColor: bgColor,
    },
    container: {
      flex: 1,
    },
    headerRight: {
      paddingRight: 4,
      paddingVertical: 4,
    },
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
    },
    firstTabBar: {
      marginRight: FIRST_TAB_GAP,
    },
    restTabBar: {
      marginRight: TAB_GAP,
    },
    tabsBarContainer: {
      display: 'flex',
      paddingLeft: 20,
      position: 'relative',
      height: TAB_BAR_HEIGHT,
      backgroundColor: bgColor,
      overflow: 'hidden',
    },
    indicator: {
      backgroundColor: colors2024['neutral-body'],
      height: 4,
      borderRadius: 100,
    },
    content: {
      flex: 1,
    },
    categoryLabelContainer: {
      height: TAB_BAR_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    watchlistLabelContainer: {
      height: TAB_BAR_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabLabel: {
      marginTop: 0,
    },
  };
});
