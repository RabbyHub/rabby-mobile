import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  View,
  FlatList as RNFlatList,
  FlatListProps,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@/components/Typography';

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

// import CustomLabel from '../TokenDetail/components/CustomLabel';
import { DynamicCustomMaterialTabBar } from '../../TokenDetail/components/CustomTabBar';
// import { WatchlistContent } from '../Watchlist/WatchlistContent';
// import { MarketCategoryContent } from './components/MarketCategoryContent';
// import { useMarketVisibleTokenPriceRefresh } from './hooks/useMarketVisibleTokenPriceRefresh';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useSafeSizes } from '@/hooks/useAppLayout';
import CustomLabel from '@/screens/TokenDetail/components/CustomLabel';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import Animated, {
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  scrollTo,
} from 'react-native-reanimated';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { DappInfoPopup } from './HomeDappDrawerPopup';
import {
  GestureDetector,
  NativeGesture,
  PanGesture,
} from 'react-native-gesture-handler';
import {
  getPullThreshold,
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
  homeDrawerAnimateMutable,
  getScrollContainerPb,
} from '../hooks/useHomeDrawerAnimate';
const AnimatedFlatList =
  Animated.createAnimatedComponent<FlatListProps<DappInfo>>(RNFlatList);

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

export const HomeDappDrawerContent: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
}> = ({ drawerScrollableGesture, drawerScrollOffsetY, scrollableStatus }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { safeOffHeader } = useSafeSizes();

  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  // const [storedActiveTab, setStoredActiveTab] = useAtom(marketTabAtom);
  const [storedActiveTab, setStoredActiveTab] = useState('favorite');
  const activeTab = useMemo(
    () =>
      VALID_MARKET_TABS.has(storedActiveTab) ? storedActiveTab : 'watchlist',
    [storedActiveTab],
  );
  // const handleVisibleUuidsChange = useMarketVisibleTokenPriceRefresh(activeTab);

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

  // useEffect(() => {
  //   setNavigationOptions({
  //     headerRight: renderHeaderRight,
  //   });
  // }, [renderHeaderRight, setNavigationOptions]);

  // useEffect(() => {
  //   const action = getMarketTabViewAction(storedActiveTab);

  //   if (!action) {
  //     return;
  //   }

  //   const timer = setTimeout(() => {
  //     matomoRequestEvent({
  //       category: 'Rabby Market',
  //       action,
  //     });
  //   }, 150);

  //   return () => {
  //     clearTimeout(timer);
  //   };
  // }, [storedActiveTab]);

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

  console.log('render HomeDappDrawerContent', activeTab);
  const { bookmarkList, removeBookmark } = useBrowserBookmark();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* <Text style={styles.title}>{t('page.home.DappDrawer.favorite')}</Text> */}
        <TouchableOpacity
        // disabled={!hasData}
        // onPress={handle}
        // style={[!hasData && { opacity: 0.5 }]}
        >
          <Text style={styles.edit}>
            {/* {isEditing ? t('global.Done') : t('global.Edit')} */}
          </Text>
        </TouchableOpacity>
      </View>
      <Tabs.Container
        // renderTabBar={renderTabBar}
        tabBarHeight={TAB_BAR_HEIGHT}
        lazy
        containerStyle={styles.container}
        headerContainerStyle={styles.tabBarWrap}
        initialTabName={activeTab}
        onTabChange={({ tabName }) => {
          console.log('HomeDappDrawerContent onTabChange', tabName);
          // setStoredActiveTab(tabName);
        }}>
        <Tabs.Tab label={renderWatchlistLabel} name="watchlist">
          <View style={styles.content}>
            <DappList
              drawerScrollableGesture={drawerScrollableGesture}
              drawerScrollOffsetY={drawerScrollOffsetY}
              scrollableStatus={scrollableStatus}
            />
          </View>
          {/* <Text>Watchlist Content</Text> */}
          {/* <WatchlistContent
            onVisibleUuidsChange={handleVisibleUuidsChange}
            visibleUuidsTabId="watchlist"
          /> */}
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
                  <DappList
                    drawerScrollableGesture={drawerScrollableGesture}
                    drawerScrollOffsetY={drawerScrollOffsetY}
                    scrollableStatus={scrollableStatus}
                  />
                  {/* <Text>hello</Text> */}
                  {/* <MarketCategoryContent
                    categoryId={category.id}
                    sortFields={category.sort_fields}
                    headerSpacerHeight={0}
                    onVisibleUuidsChange={handleVisibleUuidsChange}
                  /> */}
                </View>
              </Tabs.Tab>
            );
          }) as unknown as React.ReactElement<any>
        }
      </Tabs.Container>
      <DappInfoPopup
        visible={true}
        onClose={() => {}}
        dappInfo={bookmarkList[0]}
      />
    </View>
  );
};

const DappList: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
}> = ({ drawerScrollableGesture, drawerScrollOffsetY, scrollableStatus }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { bookmarkList, removeBookmark } = useBrowserBookmark();
  const list = bookmarkList;

  const scrollableRef = useAnimatedRef<Animated.FlatList<DappInfo>>();

  const animatedProps = useAnimatedProps(() => ({
    decelerationRate:
      SCROLLABLE_DECELERATION_RATE_MAPPER[scrollableStatus.value],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event, context) => {
      'worklet';

      if (scrollableStatus.value === SCROLLABLE_STATUS.LOCKED) {
        const lockPosition = 0;
        scrollTo(scrollableRef, 0, lockPosition, false);
        drawerScrollOffsetY.value = lockPosition;
        return;
      }
      drawerScrollOffsetY.value = event.contentOffset.y;
    },
  });

  return (
    <GestureDetector gesture={drawerScrollableGesture}>
      <AnimatedFlatList
        data={list}
        style={[styles.list]}
        keyExtractor={item => item.url || item.origin}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { flexGrow: 1 },
          list.length ? null : { justifyContent: 'center' },
        ]}
        ref={scrollableRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        animatedProps={animatedProps}
        renderItem={({ item }) => {
          return (
            <View style={styles.listItem}>
              <TouchableOpacity>
                <View style={styles.dappCard}>
                  <DappIcon
                    source={
                      item?.icon
                        ? {
                            uri: item.icon,
                          }
                        : undefined
                    }
                    origin={item.origin}
                    style={styles.dappIcon}
                  />
                  <View style={styles.dappContent}>
                    <Text style={[styles.dappTitle]} numberOfLines={1}>
                      {item?.info?.name ||
                        item.name ||
                        item.origin.split('://')[1] ||
                        item.origin}
                    </Text>
                    <Text style={styles.dappDesc} numberOfLines={1}>
                      {item.info?.description || ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
        // ListEmptyComponent={
        //   <View style={styles.empty}>
        //     {isLight ? (
        //       <RcIconEmpty style={styles.emptyIcon} />
        //     ) : (
        //       <RcIconEmptyDark style={styles.emptyIcon} />
        //     )}
        //     <Text style={styles.emptyText}>
        //       {IS_ANDROID
        //         ? t('page.home.DappDrawer.emptyAndroid')
        //         : t('page.home.DappDrawer.empty')}
        //     </Text>
        //     <Button
        //       title={t('page.home.DappDrawer.search')}
        //       buttonStyle={styles.searchButton}
        //       titleStyle={styles.searchButtonText}
        //       onPress={() => {
        //         setPartialBrowserState({
        //           isShowBrowser: true,
        //           isShowSearch: true,
        //           searchText: '',
        //           searchTabId: '',
        //           trigger: 'home',
        //         });
        //       }}
        //     />
        //   </View>
        // }
      />
    </GestureDetector>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const bgColor = 'transparent';
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

    tabLabel: {
      marginTop: 0,
    },
    //
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: TAB_BAR_HEIGHT,
    },
    list: {
      paddingTop: 8,
    },

    // -------- dapp card --------
    listItem: {
      width: '100%',
    },
    dappCard: {
      paddingVertical: 12,
      paddingLeft: 4,
      paddingRight: 8,
      minHeight: 70,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      gap: 8,
    },
    dappIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      borderCurve: 'continuous',
    },
    dappTitle: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 16,
      lineHeight: 20,
      color: colors2024['neutral-title-1'],
    },
    dappContent: {
      minWidth: 0,
      flex: 1,
    },
    dappDesc: {
      marginTop: 4,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },
  };
});
