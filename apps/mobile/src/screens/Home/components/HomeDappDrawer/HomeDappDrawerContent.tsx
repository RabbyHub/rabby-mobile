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
  Platform,
  FlatList as RNFlatList,
  View,
} from 'react-native';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
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
import { useSafeSizes } from '@/hooks/useAppLayout';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import CustomLabel from '@/screens/TokenDetail/components/CustomLabel';
import RcIconDelete from '@/assets2024/icons/common/delete-cc.svg';
import {
  GestureDetector,
  NativeGesture,
  TouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
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
import RcIconEmpty from '@/assets/icons/dapp/dapp-favorite-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-favorite-empty-dark.svg';
import { IS_ANDROID } from '@/core/native/utils';
import { Button } from '@/components2024/Button';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { DappInfoPopup } from './HomeDappDrawerPopup';
import { useMemoizedFn } from 'ahooks';
import { dappService } from '@/core/services';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useValueFromSharedValue } from '@/hooks/reanimated';

type HotDappListItem = (typeof dappList)[number];

const mapHotDappListToDappInfo = (
  list: HotDappListItem[],
  lang: string,
): DappInfo[] => {
  const isZh = lang.toLowerCase().startsWith('zh');

  return list.map(item => {
    return {
      origin: item.origin,
      icon: item.logo || '',
      name: item.name,
      chainId: undefined as unknown as DappInfo['chainId'],
      isDapp: true,
      info: {
        id: item.origin.replace(/^https?:\/\//, ''),
        name: item.name,
        logo_url: item.logo || '',
        description: isZh ? item.zh : item.en,
        user_range: '',
        tags: item.category ? [item.category] : [],
        chain_ids: [],
      },
    };
  });
};

const mergeBookmarkListWithHotDappInfo = (
  list: DappInfo[],
  hotDappInfoList: DappInfo[],
): DappInfo[] => {
  const hotDappInfoMap = new Map(
    hotDappInfoList.map(item => [item.origin, item] as const),
  );

  return list.map(item => {
    const hotDappInfo = hotDappInfoMap.get(item.origin);

    if (!hotDappInfo?.info?.description) {
      return item;
    }

    return {
      ...item,
      info: item.info
        ? {
            ...item.info,
            description: hotDappInfo.info.description,
            tags: hotDappInfo.info.tags,
          }
        : hotDappInfo.info,
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
] as const;
type TabKey = (typeof tabs)[number]['id'];
const dappTabAtom = atomByMMKV<TabKey>('@dapp.activeTab', 'favorite', {
  getOnInit: true,
});

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
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { pullPercent, isExpanded, translateY, swipeUpHintHeight } =
    homeDrawerAnimateMutable;
  const isDrawerExpanded = useValueFromSharedValue(isExpanded);
  const previousIsDrawerExpandedRef = useRef(isDrawerExpanded);
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useDappTab();
  const [isRemind, setIsRemind] = useAtom(dappRemindAtom);
  const [selectedDapp, setSelectedDapp] = useState<DappInfo>();
  const { setPartialBrowserState, openTab } = useBrowser();
  const handleDappPress = useMemoizedFn((item: DappInfo) => {
    if (isRemind) {
      setSelectedDapp(item);
      return;
    }
    openTab(item.url || item.origin, {
      isDapp: true,
    });
  });

  const handleCloseDappInfoPopup = useMemoizedFn(() => {
    setSelectedDapp(undefined);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {/* {t('page.home.DappDrawer.favorite')} */}
          Website
        </Text>
        {activeTab === 'favorite' ? (
          <TouchableOpacity
            disabled={!hasData}
            onPress={handle}
            style={[!hasData && { opacity: 0.5 }]}>
            <Text style={styles.edit}>
              {isEditing ? t('global.Done') : t('global.Edit')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Tabs.Container
        renderTabBar={renderTabBar}
        tabBarHeight={TAB_BAR_HEIGHT}
        lazy
        containerStyle={styles.container}
        headerContainerStyle={styles.tabBarWrap}
        initialTabName={activeTab}
        onTabChange={({ tabName }) => {
          console.debug('onTabChange', { tabName });
          setActiveTab(tabName as TabKey);
        }}>
        {
          tabs.map(tabItem => {
            if (tabItem.id === 'favorite') {
              return (
                <Tabs.Tab label={renderFavoriteLabel} name="favorite">
                  <View style={styles.content}>
                    <DappList
                      drawerScrollableGesture={drawerScrollableGesture}
                      drawerScrollOffsetY={drawerScrollOffsetY}
                      scrollableStatus={scrollableStatus}
                      category="favorite"
                      onDappPress={handleDappPress}
                      isEditing={isEditing}
                      bookmarkList={list}
                      onRemoveLocal={handleRemoveLocal}
                      ListEmptyComponent={
                        <View style={styles.empty}>
                          {isLight ? (
                            <RcIconEmpty style={styles.emptyIcon} />
                          ) : (
                            <RcIconEmptyDark style={styles.emptyIcon} />
                          )}
                          <Text style={styles.emptyText}>
                            {IS_ANDROID
                              ? t('page.home.DappDrawer.emptyAndroid')
                              : t('page.home.DappDrawer.empty')}
                          </Text>
                          <Button
                            title={t('page.home.DappDrawer.search')}
                            buttonStyle={styles.searchButton}
                            titleStyle={styles.searchButtonText}
                            onPress={() => {
                              setPartialBrowserState({
                                isShowBrowser: true,
                                isShowSearch: true,
                                searchText: '',
                                searchTabId: '',
                                trigger: 'home',
                              });
                            }}
                          />
                        </View>
                      }
                    />
                  </View>
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
                <View style={styles.content}>
                  <DappList
                    drawerScrollableGesture={drawerScrollableGesture}
                    drawerScrollOffsetY={drawerScrollOffsetY}
                    scrollableStatus={scrollableStatus}
                    category={tabItem.id}
                    onDappPress={handleDappPress}
                  />
                </View>
              </Tabs.Tab>
            );
          }) as unknown as React.ReactElement<any>
        }
      </Tabs.Container>
      <DappInfoPopup
        visible={!!selectedDapp}
        onClose={handleCloseDappInfoPopup}
        dappInfo={selectedDapp}
        isRemind={isRemind}
        onChangeRemind={value => {
          setIsRemind(value);
        }}
        onOpenDapp={(url: string) => {
          openTab(url, {
            isDapp: true,
          });
          handleCloseDappInfoPopup();
        }}
      />
    </View>
  );
};

const DappList: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
  category: string;
  ListEmptyComponent?: FlatListProps<DappInfo>['ListEmptyComponent'];
  isEditing?: boolean;
  onDappPress?: (item: DappInfo) => void;
  bookmarkList?: DappInfo[];
  onRemoveLocal?: (url: string) => void;
}> = ({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  category,
  ListEmptyComponent,
  onDappPress,
  bookmarkList,
  isEditing,
  onRemoveLocal,
}) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const lang = useTranslation().i18n.language;
  const hotDappInfoList = useMemo(
    () => mapHotDappListToDappInfo(dappList, lang),
    [lang],
  );

  const favoriteList = useMemo(
    () => mergeBookmarkListWithHotDappInfo(bookmarkList || [], hotDappInfoList),
    [bookmarkList, hotDappInfoList],
  );
  const list = useMemo(() => {
    if (category === 'favorite') {
      return favoriteList;
    }
    if (category === 'all') {
      return hotDappInfoList;
    }
    return hotDappInfoList.filter(item => item.info?.tags?.includes(category));
  }, [favoriteList, category, hotDappInfoList]);

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
              {isEditing ? (
                <TouchableOpacity
                  onPress={() => {
                    onRemoveLocal?.(item.origin);
                  }}>
                  <RcIconDelete width={20} height={20} />
                </TouchableOpacity>
              ) : null}
              <View style={styles.listItemContent}>
                <TouchableOpacity onPress={() => onDappPress?.(item)}>
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
        ListEmptyComponent={ListEmptyComponent}
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
      // backgroundColor: colors2024['neutral-bg-1'],
    },
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
    list: {
      paddingTop: 8,
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
      fontSize: 13,
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
