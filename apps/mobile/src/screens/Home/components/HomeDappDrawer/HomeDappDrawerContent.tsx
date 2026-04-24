import { Text } from '@/components/Typography';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatListProps,
  FlatList as RNFlatList,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

import { atomByMMKV } from '@/core/storage/mmkv';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Tabs } from 'react-native-collapsible-tab-view';

// import CustomLabel from '../TokenDetail/components/CustomLabel';
import { DynamicCustomMaterialTabBar } from '../../../TokenDetail/components/CustomTabBar';
// import { WatchlistContent } from '../Watchlist/WatchlistContent';
// import { MarketCategoryContent } from './components/MarketCategoryContent';
// import { useMarketVisibleTokenPriceRefresh } from './hooks/useMarketVisibleTokenPriceRefresh';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import CustomLabel from '@/screens/TokenDetail/components/CustomLabel';
import {
  Gesture,
  GestureDetector,
  NativeGesture,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  homeDrawerAnimateMutable,
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
} from '../../hooks/useHomeDrawerAnimate';

import dappList from '@/constant/hot-dapp.json';
import { useAtom } from 'jotai';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useMemoizedFn } from 'ahooks';
import { browserService } from '@/core/services';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { useDapps } from '@/hooks/useDapps';
import { DappFavoriteList } from './DappFavoriteList';
import { matomoRequestEvent } from '@/utils/analytics';
import { IS_ANDROID } from '@/core/native/utils';

type HotDappListItem = (typeof dappList)[number];

const mapHotDappListToDappInfo = ({
  dapps,
  list,
  lang,
}: {
  dapps: Record<string, DappInfo>;
  list: HotDappListItem[];
  lang: string;
}): DappInfo[] => {
  const isZh = lang.toLowerCase().startsWith('zh');

  return list.map(item => {
    const dapp = dapps[item.origin];
    return {
      ...dapp,
      origin: item.origin,
      icon: dapp?.icon || item.logo || '',
      name: item.name,
      chainId: undefined as unknown as DappInfo['chainId'],
      isDapp: true,
      info: {
        ...dapp?.info,
        id: item.origin.replace(/^https?:\/\//, ''),
        name: item.name,
        logo_url: dapp?.icon || item.logo || '',
        description: isZh ? item.zh : item.en,
        user_range: '',
        tags: item.category ? [item.category] : [],
        chain_ids: [],
      },
    };
  });
};

const AnimatedFlatList =
  Animated.createAnimatedComponent<FlatListProps<DappInfo>>(RNFlatList);

const TAB_GAP = 8;
const FIRST_TAB_GAP = 12;
export const TAB_BAR_HEIGHT = 28;

const tabs = [
  {
    id: 'favorite',
    label: 'Favorite',
  },
  {
    id: 'all',
    label: 'All',
  },
  {
    id: 'DeFi',
    label: 'DeFi',
  },
  {
    id: 'RWA',
    label: 'RWA',
  },
  {
    id: 'Perps',
    label: 'Perps',
  },
  {
    id: 'Predict',
    label: 'Predict',
  },
  {
    id: 'DEX',
    label: 'DEX',
  },
  {
    id: 'NFTxx',
    label: 'NFTssss',
  },
  {
    id: 'NFTx',
    label: 'NFT',
  },
  {
    id: 'NFT',
    label: 'NFT',
  },
] as const;
type TabKey = (typeof tabs)[number]['id'];
const dappTabAtom = atomByMMKV<TabKey>(
  '@dapp.activeTab',
  browserService.bookmark.selectors.selectTotal() ? 'favorite' : 'all',
  {
    getOnInit: true,
  },
);

export const dappRemindAtom = atomByMMKV<boolean>('@dapp.remind', true, {
  getOnInit: true,
});

const useDappTab = () => {
  const [storedActiveTab, setStoredActiveTab] = useAtom(dappTabAtom);
  const activeTab = useMemo(
    () =>
      tabs.some(tab => tab.id === storedActiveTab)
        ? storedActiveTab
        : 'favorite',
    [storedActiveTab],
  );

  return {
    activeTab,
    setActiveTab: setStoredActiveTab,
  };
};

export const HomeDappDrawerContent: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
}> = ({ drawerScrollableGesture, drawerScrollOffsetY, scrollableStatus }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { isExpanded } = homeDrawerAnimateMutable;
  const isDrawerExpanded = useValueFromSharedValue(isExpanded);
  const previousIsDrawerExpandedRef = useRef(isDrawerExpanded);
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useDappTab();
  const activeTabIndex = useMemo(
    () => tabs.findIndex(tab => tab.id === activeTab),
    [activeTab],
  );
  const { openTab } = useBrowser();
  const handleDappPress = useMemoizedFn((item: DappInfo) => {
    openTab(item.url || item.origin, {
      isDapp: true,
      isRemindOpen: true,
    });
  });

  const initialTabItemsLayout = useMemo(() => {
    let x = 20;
    return tabs.map((tab, index) => {
      const width = Math.max(60, tab.label.length * 12 + 20);
      const item = { x, width };
      x += width + (index === 0 ? FIRST_TAB_GAP : TAB_GAP);
      return item;
    });
  }, []);

  const renderTabBar = useCallback(
    (props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ...props,
          scrollEnabled: true,
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

  const renderFavoriteLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text=""
        style={styles.tabLabel}
        containerStyle={styles.favoriteLabelContainer}
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
    [colors2024, styles.favoriteLabelContainer, styles.tabLabel],
  );

  const { bookmarkList, removeBookmark } = useBrowserBookmark();
  const [_isEditing, setIsEditing] = React.useState(false);
  const [removedItems, setRemovedItems] = useState<string[]>([]);
  const list = useMemo(() => {
    return bookmarkList.filter(
      item =>
        !removedItems.find(
          url => safeGetOrigin(url) === safeGetOrigin(item.origin),
        ),
    );
  }, [bookmarkList, removedItems]);

  const hasData = bookmarkList.length > 0;
  const isEditing = _isEditing && hasData;

  const startEditing = useCallback(() => {
    if (!hasData) {
      return;
    }
    setIsEditing(true);
    setRemovedItems([]);
  }, [hasData]);

  const resetEditing = useCallback(() => {
    setIsEditing(false);
    setRemovedItems([]);
  }, []);

  useEffect(() => {
    if (previousIsDrawerExpandedRef.current && !isDrawerExpanded) {
      resetEditing();
    }

    previousIsDrawerExpandedRef.current = isDrawerExpanded;
  }, [isDrawerExpanded, resetEditing]);

  const completeEditing = useCallback(() => {
    setIsEditing(false);
    removedItems.forEach(url => {
      removeBookmark(url);
    });
    setRemovedItems([]);
  }, [removedItems, removeBookmark]);

  const handleRemoveLocal = useCallback((url: string) => {
    setRemovedItems(prev => [...prev, url]);
  }, []);

  const handle = useCallback(() => {
    if (isEditing) {
      completeEditing();
    } else {
      startEditing();
    }
  }, [completeEditing, isEditing, startEditing]);

  const androidSwipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-16, 16])
        .failOffsetY([-12, 12])
        .onEnd(event => {
          'worklet';

          const SWIPE_DISTANCE = 48;
          const SWIPE_VELOCITY = 600;
          const shouldSwipeLeft =
            event.translationX < -SWIPE_DISTANCE ||
            event.velocityX < -SWIPE_VELOCITY;
          const shouldSwipeRight =
            event.translationX > SWIPE_DISTANCE ||
            event.velocityX > SWIPE_VELOCITY;

          if (shouldSwipeLeft && activeTabIndex < tabs.length - 1) {
            runOnJS(setActiveTab)(tabs[activeTabIndex + 1].id);
            return;
          }

          if (shouldSwipeRight && activeTabIndex > 0) {
            runOnJS(setActiveTab)(tabs[activeTabIndex - 1].id);
          }
        }),
    [activeTabIndex, setActiveTab],
  );

  const renderTabContent = useCallback(
    (tabKey: TabKey, isAndroidTab = false) => {
      const contentStyle = isAndroidTab
        ? [styles.content, styles.androidTabContent]
        : styles.content;

      if (tabKey === 'favorite') {
        return (
          <View style={contentStyle}>
            <DappFavoriteList
              drawerScrollableGesture={drawerScrollableGesture}
              drawerScrollOffsetY={drawerScrollOffsetY}
              scrollableStatus={scrollableStatus}
              isEditing={isEditing}
              bookmarkList={list}
              onRemoveLocal={handleRemoveLocal}
              onDappPress={handleDappPress}
            />
          </View>
        );
      }

      return (
        <View style={contentStyle}>
          <DappList
            drawerScrollableGesture={drawerScrollableGesture}
            drawerScrollOffsetY={drawerScrollOffsetY}
            scrollableStatus={scrollableStatus}
            category={tabKey}
            onDappPress={handleDappPress}
          />
        </View>
      );
    },
    [
      drawerScrollOffsetY,
      drawerScrollableGesture,
      handleDappPress,
      handleRemoveLocal,
      isEditing,
      list,
      scrollableStatus,
      styles.androidTabContent,
      styles.content,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {/* {t('page.home.DappDrawer.favorite')} */}
          Websites
        </Text>
        {activeTab === 'favorite' ? (
          <TouchableOpacity
            disabled={!hasData}
            onPress={handle}
            style={!hasData ? styles.editDisabled : undefined}>
            <Text style={styles.edit}>
              {isEditing ? t('global.Done') : t('global.Edit')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {IS_ANDROID ? (
        <>
          <View style={styles.tabBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.androidTabsBarContainer}>
              {tabs.map((tabItem, index) => {
                const isActive = activeTab === tabItem.id;

                return (
                  <TouchableOpacity
                    key={tabItem.id}
                    onPress={() => setActiveTab(tabItem.id)}
                    style={[
                      styles.androidTabButton,
                      index === 0
                        ? styles.androidFirstTabButton
                        : styles.androidRestTabButton,
                      isActive
                        ? styles.androidTabButtonActive
                        : styles.androidTabButtonInactive,
                    ]}>
                    {tabItem.id === 'favorite' ? (
                      <View style={styles.favoriteLabelContainer}>
                        <RcIconFavorite
                          width={18}
                          height={18}
                          color={
                            isActive
                              ? colors2024['orange-default']
                              : colors2024['neutral-info']
                          }
                        />
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.androidTabLabel,
                          isActive
                            ? styles.androidTabLabelActive
                            : styles.androidTabLabelInactive,
                        ]}>
                        {tabItem.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.androidContent}>
            <GestureDetector gesture={androidSwipeGesture}>
              <View style={styles.androidPagerPage}>
                {renderTabContent(activeTab, true)}
              </View>
            </GestureDetector>
          </View>
        </>
      ) : (
        <Tabs.Container
          renderTabBar={renderTabBar}
          tabBarHeight={TAB_BAR_HEIGHT}
          lazy
          containerStyle={styles.tabContainer}
          headerContainerStyle={styles.tabBarWrap}
          initialTabName={activeTab}
          onTabChange={({ tabName }) => {
            setActiveTab(tabName as TabKey);
          }}>
          {
            tabs.map(tabItem => {
              if (tabItem.id === 'favorite') {
                return (
                  <Tabs.Tab
                    key={tabItem.id}
                    label={renderFavoriteLabel}
                    name="favorite">
                    {renderTabContent(tabItem.id)}
                  </Tabs.Tab>
                );
              }
              const renderCategoryLabel = ({ index, indexDecimal }) => (
                <CustomLabel
                  index={index}
                  style={styles.tabLabel}
                  containerStyle={styles.categoryLabelContainer}
                  indexDecimal={indexDecimal}
                  text={tabItem.label}
                />
              );

              return (
                <Tabs.Tab
                  key={tabItem.id}
                  label={renderCategoryLabel}
                  name={tabItem.id}>
                  {renderTabContent(tabItem.id)}
                </Tabs.Tab>
              );
            }) as unknown as React.ReactElement<any>
          }
        </Tabs.Container>
      )}
    </View>
  );
};

const DappList: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
  category: string;
  onDappPress?: (item: DappInfo) => void;
}> = ({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  category,
  onDappPress,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const lang = useTranslation().i18n.language;
  const { dapps } = useDapps();
  const hotDappInfoList = useMemo(
    () => mapHotDappListToDappInfo({ dapps, list: dappList, lang }),
    [dapps, lang],
  );

  const list = useMemo(() => {
    if (category === 'all') {
      return hotDappInfoList;
    }
    return hotDappInfoList.filter(item => item.info?.tags?.includes(category));
  }, [category, hotDappInfoList]);

  const scrollableRef = useAnimatedRef<Animated.FlatList<DappInfo>>();

  const animatedProps = useAnimatedProps(() => ({
    decelerationRate:
      SCROLLABLE_DECELERATION_RATE_MAPPER[scrollableStatus.value],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
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
          styles.listContentContainer,
          list.length ? null : styles.emptyListContentContainer,
        ]}
        ref={scrollableRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        animatedProps={animatedProps}
        renderItem={({ item }) => {
          return (
            <View style={styles.listItem}>
              <View style={styles.listItemContent}>
                <TouchableOpacity
                  onPress={() => {
                    onDappPress?.(item);
                    matomoRequestEvent({
                      category: 'Websites Usage',
                      action: 'Website_Visit_Other',
                      label: item.origin,
                    });
                  }}>
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
            </View>
          );
        }}
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
    tabContainer: {},
    headerRight: {
      paddingRight: 4,
      paddingVertical: 4,
    },

    header: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      lineHeight: 20,
      fontWeight: '800',
    },
    edit: {
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 18,
    },
    editDisabled: {
      opacity: 0.5,
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

    favoriteLabelContainer: {
      height: TAB_BAR_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 4,
    },

    categoryLabelContainer: {
      height: TAB_BAR_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
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
    androidContent: {
      flex: 1,
    },
    androidPagerPage: {
      flex: 1,
    },
    androidTabContent: {
      paddingTop: 0,
    },
    androidTabsBarContainer: {
      paddingLeft: 20,
      paddingRight: 20,
    },
    androidTabButton: {
      minWidth: 60,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 4,
      height: TAB_BAR_HEIGHT,
      paddingBottom: 4,
    },
    androidFirstTabButton: {
      marginRight: FIRST_TAB_GAP,
    },
    androidRestTabButton: {
      marginRight: TAB_GAP,
    },
    androidTabButtonActive: {
      borderBottomColor: colors2024['neutral-body'],
    },
    androidTabButtonInactive: {
      borderBottomColor: 'transparent',
    },
    androidTabLabel: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
    },
    androidTabLabelActive: {
      color: colors2024['neutral-title-1'],
    },
    androidTabLabelInactive: {
      color: colors2024['neutral-info'],
    },
    list: {},
    listContentContainer: {
      flexGrow: 1,
      paddingTop: 8,
      paddingBottom: 8,
    },
    emptyListContentContainer: {
      justifyContent: 'center',
    },

    // -------- dapp card --------

    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      width: '100%',
    },
    listItemContent: {
      width: '100%',
      flex: 1,
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
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-secondary'],
    },

    // -------- empty --------
    empty: {
      paddingVertical: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,

      marginHorizontal: 4,

      marginTop: -100,
    },
    emptyIcon: {
      width: 163,
      height: 126,
    },
    emptyText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['neutral-secondary'],
      textAlign: 'center',
    },
    searchButton: {
      marginTop: 16,
      height: 42,
      width: 143,
      borderRadius: 6,
    },
    searchButtonText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
