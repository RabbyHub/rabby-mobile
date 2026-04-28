import { Text } from '@/components/Typography';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TouchableOpacity, View } from 'react-native';

import { atomByMMKV } from '@/core/storage/mmkv';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { MaterialTabBar, Tabs } from 'react-native-collapsible-tab-view';

import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import CustomLabel from '@/screens/TokenDetail/components/CustomLabel';
import {
  Gesture,
  GestureDetector,
  NativeGesture,
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import {
  homeDrawerAnimateMutable,
  SCROLLABLE_STATUS,
} from '../../hooks/useHomeDrawerAnimate';

import { useAtom } from 'jotai';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useMemoizedFn } from 'ahooks';
import { browserService, dappService } from '@/core/services';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { DappFavoriteList } from './DappFavoriteList';
import { IS_ANDROID } from '@/core/native/utils';
import {
  HomeDappDrawerAndroidTabs,
  type HomeDappDrawerAndroidTab,
} from './HomeDappDrawerAndroidTabs';
import { DappList } from './DappList';
import i18n from '@/utils/i18n';

const TAB_GAP = 8;
const FIRST_TAB_GAP = 12;
export const TAB_BAR_HEIGHT = 28;

const tabs = [
  {
    id: 'favorite',
    label: i18n.t('page.home.DappDrawer.tabs.favorite'),
  },
  {
    id: 'all',
    label: i18n.t('page.home.DappDrawer.tabs.all'),
  },
  {
    id: 'DeFi',
    label: i18n.t('page.home.DappDrawer.tabs.defi'),
  },
  {
    id: 'RWA',
    label: i18n.t('page.home.DappDrawer.tabs.rwa'),
  },
  {
    id: 'Perps',
    label: i18n.t('page.home.DappDrawer.tabs.perps'),
  },
  {
    id: 'Predict',
    label: i18n.t('page.home.DappDrawer.tabs.predict'),
  },
  {
    id: 'DEX',
    label: i18n.t('page.home.DappDrawer.tabs.dex'),
  },
  {
    id: 'NFT',
    label: i18n.t('page.home.DappDrawer.tabs.nft'),
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
  const { openTab } = useBrowser();
  const handleDappPress = useMemoizedFn((item: DappInfo) => {
    openTab(item.url || item.origin, {
      isDapp: true,
      isRemindOpen: true,
    });
    const dapp = dappService.getDapp(item.origin);
    if (!dapp) {
      dappService.addDapp(item);
    } else if (!dapp.isDapp) {
      dappService.updateDapp({
        ...dapp,
        origin: item.origin,
        isDapp: true,
      });
    }
  });

  const renderTabBar = useMemoizedFn((props: any) => {
    return (
      <MaterialTabBar
        {...props}
        scrollEnabled={true}
        keepActiveTabCentered
        style={styles.materialTabsBar}
        contentContainerStyle={styles.materialTabsBarContent}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
      />
    );
  });

  const renderFavoriteLabel = useCallback(
    ({ index, indexDecimal }: any) => (
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

  const androidTabs = useMemo<readonly HomeDappDrawerAndroidTab<TabKey>[]>(
    () =>
      tabs.map(tabItem => {
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
    [renderCategoryLabel, renderFavoriteLabel],
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

  const headerGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(IS_ANDROID)
        .activeOffsetX([-6, 6])
        .failOffsetY([-8, 8]),
    [],
  );

  const renderTabContent = useMemoizedFn(
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
  );

  return (
    <View style={styles.container}>
      <GestureDetector gesture={headerGesture}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('page.home.DappDrawer.websites')}</Text>
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
      </GestureDetector>
      {IS_ANDROID ? (
        <HomeDappDrawerAndroidTabs
          tabs={androidTabs}
          initialTabName={activeTab}
          drawerScrollableGesture={drawerScrollableGesture}
          renderTabBar={renderTabBar}
          onTabChange={setActiveTab}
          renderTabContent={tabKey => renderTabContent(tabKey, true)}
        />
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
            }) as unknown as React.ReactElement<any>
          }
        </Tabs.Container>
      )}
    </View>
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
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: TAB_BAR_HEIGHT,
    },
    androidTabContent: {
      paddingTop: 0,
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
