import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import { appMMKVInstance, atomByMMKV } from '@/core/storage/mmkv';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { Tabs } from 'react-native-collapsible-tab-view';
import type { TabBarProps } from 'react-native-collapsible-tab-view';

import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import type { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import CustomLabel from '@/screens/TokenDetail/components/CustomLabel';
import type { NativeGesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import type { SCROLLABLE_STATUS } from '../../hooks/useHomeDrawerAnimate';
import { homeDrawerAnimateMutable } from '../../hooks/useHomeDrawerAnimate';

import { useAtom } from 'jotai';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useMemoizedFn } from 'ahooks';
import {
  addDappSync,
  ensureDappServiceReady,
  getDappSnapshot,
  updateDappSync,
} from '@/core/serviceApi/dapp';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { triggerImpact } from '@/utils/common';
import { DappFavoriteList } from './DappFavoriteList';
import { IS_ANDROID } from '@/core/native/utils';
import {
  HomeDappDrawerAndroidTabs,
  type HomeDappDrawerAndroidTab,
} from './HomeDappDrawerAndroidTabs';
import { DappList } from './DappList';
import {
  homeFeatureLayoutApi,
  useHasMoreHomeFeatures,
  useIsHomeFeatureEditing,
} from '../../hooks/homeFeatureLayout';
import {
  DRAWER_CATEGORY_BAR_HEIGHT,
  DRAWER_WEBSITES_CONTENT_TOP,
} from './constants';
import {
  HomeDrawerTabBar,
  type HomeDrawerTabBarAction,
} from './HomeDrawerTabBar';
import { HomeMoreFeatures } from './HomeMoreFeatures';

const TAB_GAP = 8;
const FIRST_TAB_GAP = 12;
const TAB_BAR_HEIGHT = DRAWER_CATEGORY_BAR_HEIGHT;

/** A website category page. */
type TabKey =
  | 'favorite'
  | 'all'
  | 'DeFi'
  | 'RWA'
  | 'Perps'
  | 'Predict'
  | 'DEX'
  | 'NFT';

/** First page of the drawer's pager, ahead of every website category. */
const MORE_TAB = 'more';
type DrawerTabKey = typeof MORE_TAB | TabKey;
/** Longer than either platform's animated page change. */
const JUMP_SETTLE_TIMEOUT_MS = 800;

const FavoriteTabLabel = ({
  index,
  indexDecimal,
  activeColor,
  inactiveColor,
  tabLabelStyle,
  containerStyle,
}: {
  index: number;
  indexDecimal: Animated.SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  tabLabelStyle: React.ComponentProps<typeof CustomLabel>['style'];
  containerStyle: React.ComponentProps<typeof CustomLabel>['containerStyle'];
}) => {
  const indexDecimalValue = useValueFromSharedValue(indexDecimal);
  const isActive = Math.abs(index - indexDecimalValue) < 0.5;

  return (
    <CustomLabel
      index={index}
      indexDecimal={indexDecimal}
      text=""
      style={tabLabelStyle}
      containerStyle={containerStyle}
      icon={
        <RcIconFavorite
          width={18}
          height={18}
          color={isActive ? activeColor : inactiveColor}
        />
      }
    />
  );
};

const DAPP_ACTIVE_TAB_STORAGE_KEY = '@dapp.activeTab';
const dappTabAtom = atomByMMKV<TabKey>(DAPP_ACTIVE_TAB_STORAGE_KEY, 'all', {
  getOnInit: true,
});

const useDappTab = ({
  hasBookmarks,
  bookmarksHydrated,
}: {
  hasBookmarks: boolean;
  bookmarksHydrated: boolean;
}) => {
  const [storedActiveTab, setStoredActiveTab] = useAtom(dappTabAtom);
  const shouldResolveInitialDappTabRef = useRef(
    !appMMKVInstance.contains(DAPP_ACTIVE_TAB_STORAGE_KEY),
  );
  const { t } = useTranslation();
  useEffect(() => {
    if (!shouldResolveInitialDappTabRef.current || !bookmarksHydrated) {
      return;
    }
    shouldResolveInitialDappTabRef.current = false;
    if (hasBookmarks) {
      setStoredActiveTab('favorite');
    }
  }, [bookmarksHydrated, hasBookmarks, setStoredActiveTab]);

  const setActiveTab = useCallback(
    (tab: TabKey) => {
      shouldResolveInitialDappTabRef.current = false;
      setStoredActiveTab(tab);
    },
    [setStoredActiveTab],
  );
  const tabs = useMemo(
    () =>
      [
        {
          id: 'favorite',
          label: t('page.home.DappDrawer.tabs.favorite'),
        },
        {
          id: 'all',
          label: t('page.home.DappDrawer.tabs.all'),
        },
        {
          id: 'DeFi',
          label: t('page.home.DappDrawer.tabs.defi'),
        },
        {
          id: 'RWA',
          label: t('page.home.DappDrawer.tabs.rwa'),
        },
        {
          id: 'Perps',
          label: t('page.home.DappDrawer.tabs.perps'),
        },
        {
          id: 'Predict',
          label: t('page.home.DappDrawer.tabs.predict'),
        },
        {
          id: 'DEX',
          label: t('page.home.DappDrawer.tabs.dex'),
        },
        {
          id: 'NFT',
          label: t('page.home.DappDrawer.tabs.nft'),
        },
      ] as const,
    [t],
  );
  const activeTab = useMemo(
    () =>
      tabs.some(tab => tab.id === storedActiveTab)
        ? storedActiveTab
        : 'favorite',
    [storedActiveTab, tabs],
  );

  return {
    tabs,
    activeTab,
    setActiveTab,
  };
};

export const HomeDappDrawerContent: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
}> = ({ drawerScrollableGesture, drawerScrollOffsetY, scrollableStatus }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { isExpanded } = homeDrawerAnimateMutable;
  const { t } = useTranslation();
  const { bookmarkList, bookmarkStore, removeBookmark } = useBrowserBookmark();
  // `activeTab` is the website category to come back to; the page actually on
  // screen is `currentTab`, which can also be "More Features".
  const { activeTab, setActiveTab, tabs } = useDappTab({
    hasBookmarks: bookmarkList.length > 0,
    bookmarksHydrated: bookmarkStore.hydrated,
  });
  const [currentTab, setCurrentTab] = useState<DrawerTabKey>(MORE_TAB);
  const currentTabRef = useRef<DrawerTabKey>(MORE_TAB);
  const isFeatureEditing = useIsHomeFeatureEditing();
  const hasMoreFeatures = useHasMoreHomeFeatures();
  /** The pager's own "go to this page" command, handed over by its tab bar. */
  const pagerJumpRef = useRef<((tab: string) => void) | null>(null);
  /** The last page the pager reported, whether or not it was acted on. */
  const lastReportedTabRef = useRef<DrawerTabKey>(MORE_TAB);
  // A commanded jump animates across every page in between and the pager
  // reports each one. Only the destination is the user's choice.
  const pendingJumpRef = useRef<{
    target: DrawerTabKey;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const { openTab } = useBrowser();
  const handleDappPress = useMemoizedFn(async (item: DappInfo) => {
    try {
      await ensureDappServiceReady();
      const dapp = getDappSnapshot(item.origin);
      if (!dapp) {
        addDappSync(item);
      } else if (!dapp.isDapp) {
        updateDappSync({
          ...dapp,
          origin: item.origin,
          isDapp: true,
        });
      }
    } catch (error) {
      console.error('[HomeDappDrawer] persist dapp failed', error);
    } finally {
      openTab(item.url || item.origin, {
        isDapp: true,
        isRemindOpen: true,
      });
    }
  });

  const applyTab = useCallback(
    (tab: DrawerTabKey) => {
      currentTabRef.current = tab;
      setCurrentTab(tab);

      if (tab === MORE_TAB) {
        return;
      }
      setActiveTab(tab);
      // The cards are edited on the Home and on "More Features" only, so
      // moving on to the websites ends the session.
      homeFeatureLayoutApi.stopEditing();
    },
    [setActiveTab],
  );

  const clearPendingJump = useCallback(() => {
    if (pendingJumpRef.current) {
      clearTimeout(pendingJumpRef.current.timer);
      pendingJumpRef.current = null;
    }
  }, []);
  useEffect(() => clearPendingJump, [clearPendingJump]);

  const handleTabChange = useCallback(
    (tab: DrawerTabKey) => {
      lastReportedTabRef.current = tab;

      const pendingJump = pendingJumpRef.current;
      if (pendingJump) {
        if (tab !== pendingJump.target) {
          return;
        }
        clearPendingJump();
      }
      applyTab(tab);
    },
    [applyTab, clearPendingJump],
  );

  const jumpToTab = useCallback(
    (tab: DrawerTabKey) => {
      clearPendingJump();
      if (tab !== currentTabRef.current) {
        pendingJumpRef.current = {
          target: tab,
          // If the jump is cut short (the user grabs the pager mid-flight),
          // fall back to wherever the pager actually came to rest.
          timer: setTimeout(() => {
            pendingJumpRef.current = null;
            if (lastReportedTabRef.current !== currentTabRef.current) {
              applyTab(lastReportedTabRef.current);
            }
          }, JUMP_SETTLE_TIMEOUT_MS),
        };
      }
      pagerJumpRef.current?.(tab);
    },
    [applyTab, clearPendingJump],
  );

  // Editing can start on the Home while this pager was left on a website
  // category: bring it back, so swiping up lands on the cards being edited.
  useEffect(() => {
    if (isFeatureEditing && currentTabRef.current !== MORE_TAB) {
      jumpToTab(MORE_TAB);
    }
  }, [isFeatureEditing, jumpToTab]);

  const renderFavoriteLabel = useCallback(
    ({ index, indexDecimal }: any) => (
      <FavoriteTabLabel
        index={index}
        indexDecimal={indexDecimal}
        activeColor={colors2024['orange-default']}
        inactiveColor={colors2024['neutral-info']}
        tabLabelStyle={styles.tabLabel}
        containerStyle={styles.favoriteLabelContainer}
      />
    ),
    [colors2024, styles.favoriteLabelContainer, styles.tabLabel],
  );

  const renderCategoryLabel = useMemoizedFn(
    ({ index, indexDecimal, label }) => (
      <CustomLabel
        index={index}
        style={styles.tabLabel}
        containerStyle={styles.categoryLabelContainer}
        indexDecimal={indexDecimal}
        text={label}
      />
    ),
  );

  const androidTabs = useMemo<
    readonly HomeDappDrawerAndroidTab<DrawerTabKey>[]
  >(
    () => [
      { id: MORE_TAB },
      ...tabs.map(tabItem => {
        if (tabItem.id === 'favorite') {
          return {
            ...tabItem,
            label: renderFavoriteLabel,
          };
        }

        return {
          ...tabItem,
          label: (props: any) =>
            renderCategoryLabel({ ...props, label: tabItem.label }),
        };
      }),
    ],
    [renderCategoryLabel, renderFavoriteLabel, tabs],
  );

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

  // Subscribe on the UI thread instead of mirroring `isExpanded` into React
  // state: a React mirror re-rendered this whole dapp list on every
  // open/close transition (~150ms hitch on Android), only to reset an editing
  // flag that is usually already clear.
  useAnimatedReaction(
    () => isExpanded.value,
    (expanded, previousExpanded) => {
      if (previousExpanded === true && expanded === false) {
        runOnJS(resetEditing)();
      }
    },
  );

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

  const handleToggleFeatureEditing = useCallback(() => {
    triggerImpact();
    if (homeFeatureLayoutApi.isEditing()) {
      homeFeatureLayoutApi.stopEditing();
    } else {
      homeFeatureLayoutApi.startEditing();
    }
  }, []);

  // The right-hand text button belongs to the page on screen: the feature
  // cards on "More Features", the bookmarks on the favorites category.
  const tabBarAction = useMemo<HomeDrawerTabBarAction | null>(() => {
    if (currentTab === MORE_TAB) {
      // Nothing to edit from here once every card lives on the Home.
      return hasMoreFeatures || isFeatureEditing
        ? {
            label: isFeatureEditing ? t('global.Done') : t('global.Edit'),
            onPress: handleToggleFeatureEditing,
          }
        : null;
    }
    if (currentTab === 'favorite') {
      return {
        label: isEditing ? t('global.Done') : t('global.Edit'),
        disabled: !hasData,
        onPress: handle,
      };
    }
    return null;
  }, [
    currentTab,
    handle,
    handleToggleFeatureEditing,
    hasData,
    hasMoreFeatures,
    isEditing,
    isFeatureEditing,
    t,
  ]);

  const handlePressMoreTab = useCallback(() => {
    jumpToTab(MORE_TAB);
  }, [jumpToTab]);
  const handlePressWebsitesTab = useCallback(() => {
    if (currentTabRef.current === MORE_TAB) {
      jumpToTab(activeTab);
    }
  }, [activeTab, jumpToTab]);
  const handlePressCategoryTab = useCallback(
    (tab: string) => {
      jumpToTab(tab as DrawerTabKey);
    },
    [jumpToTab],
  );

  const renderTabBar = useCallback(
    (props: TabBarProps<string>) => {
      pagerJumpRef.current = props.onTabPress;

      return (
        <HomeDrawerTabBar
          {...props}
          onTabPress={handlePressCategoryTab}
          moreTitle={t('page.home.moreFeatures.title')}
          websitesTitle={t('page.home.DappDrawer.websites')}
          action={tabBarAction}
          onPressMore={handlePressMoreTab}
          onPressWebsites={handlePressWebsitesTab}
          categoryBarStyle={styles.materialTabsBar}
          categoryBarContentStyle={styles.materialTabsBarContent}
          categoryIndicatorStyle={styles.indicator}
          categoryTabStyle={styles.tabBar}
        />
      );
    },
    [
      handlePressCategoryTab,
      handlePressMoreTab,
      handlePressWebsitesTab,
      styles.indicator,
      styles.materialTabsBar,
      styles.materialTabsBarContent,
      styles.tabBar,
      t,
      tabBarAction,
    ],
  );

  const renderTabContent = useMemoizedFn((tabKey: DrawerTabKey) => {
    if (tabKey === MORE_TAB) {
      return (
        <HomeMoreFeatures
          drawerScrollableGesture={drawerScrollableGesture}
          drawerScrollOffsetY={drawerScrollOffsetY}
          scrollableStatus={scrollableStatus}
          isActive={currentTab === tabKey}
        />
      );
    }

    if (tabKey === 'favorite') {
      return (
        <View style={styles.content}>
          <DappFavoriteList
            drawerScrollableGesture={drawerScrollableGesture}
            drawerScrollOffsetY={drawerScrollOffsetY}
            scrollableStatus={scrollableStatus}
            isEditing={isEditing}
            isActive={currentTab === tabKey}
            bookmarkList={list}
            onRemoveLocal={handleRemoveLocal}
            onDappPress={handleDappPress}
          />
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <DappList
          drawerScrollableGesture={drawerScrollableGesture}
          drawerScrollOffsetY={drawerScrollOffsetY}
          scrollableStatus={scrollableStatus}
          category={tabKey}
          isActive={currentTab === tabKey}
          onDappPress={handleDappPress}
        />
      </View>
    );
  });

  return (
    <View style={styles.container}>
      {IS_ANDROID ? (
        <HomeDappDrawerAndroidTabs
          tabs={androidTabs}
          initialTabName={MORE_TAB}
          drawerScrollableGesture={drawerScrollableGesture}
          renderTabBar={renderTabBar}
          onTabChange={handleTabChange}
          renderTabContent={renderTabContent}
        />
      ) : (
        <Tabs.Container
          renderTabBar={renderTabBar}
          tabBarHeight={DRAWER_WEBSITES_CONTENT_TOP}
          lazy
          containerStyle={styles.tabContainer}
          headerContainerStyle={styles.tabBarWrap}
          initialTabName={MORE_TAB}
          onTabChange={({ tabName }) => {
            handleTabChange(tabName as DrawerTabKey);
          }}>
          {
            [
              <Tabs.Tab key={MORE_TAB} name={MORE_TAB} label={renderNoLabel}>
                {renderTabContent(MORE_TAB)}
              </Tabs.Tab>,
              ...tabs.map(tabItem => {
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

                return (
                  <Tabs.Tab
                    key={tabItem.id}
                    label={label =>
                      renderCategoryLabel({
                        ...label,
                        label: tabItem.label,
                      })
                    }
                    name={tabItem.id}>
                    {renderTabContent(tabItem.id)}
                  </Tabs.Tab>
                );
              }),
            ] as unknown as React.ReactElement<any>
          }
        </Tabs.Container>
      )}
    </View>
  );
};

/** "More Features" has no entry in the category strip. */
const renderNoLabel = () => null;

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

    // The pager's top container now also holds the title row and the
    // indicator, so the category strip draws its own bottom line instead of
    // this box drawing one across the "More Features" page as well.
    tabBarWrap: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
      backgroundColor: bgColor,
    },
    tabBar: {
      height: TAB_BAR_HEIGHT,
      width: 'auto',
      flexShrink: 0,
      flex: 0,
      paddingHorizontal: 0,
      marginHorizontal: 4,
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
    materialTabsBar: {
      height: TAB_BAR_HEIGHT,
      maxHeight: TAB_BAR_HEIGHT,
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: bgColor,
      borderBottomWidth: 1,
      borderBottomColor: colors2024['neutral-bg-5'],
    },
    materialTabsBarContent: {
      paddingLeft: 20,
      backgroundColor: bgColor,
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
    // The tab bar floats over the pager on both platforms, so every website
    // page starts below it.
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: DRAWER_WEBSITES_CONTENT_TOP,
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
