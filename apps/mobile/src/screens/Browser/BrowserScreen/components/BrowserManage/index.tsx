import { PillsSwitch } from '@/components2024/PillsSwitch';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { BrowserBookmarkList } from './BrowserBookmarkList';
import { BrowserHistoryList } from './BrowserHistoryList';
import { BrowserTabList } from './BrowserTabList';
import { BrowserSearch } from '../BrowserSearch';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useMemoizedFn, useMount } from 'ahooks';
import { TabBarProps, Tabs } from 'react-native-collapsible-tab-view';
import { TabName } from 'react-native-collapsible-tab-view/lib/typescript/src/types';
import { DropDownMenuView } from '@/components2024/DropDownMenu';
import { RcIconAddPlusCircle, ReactIconHome } from '@/assets2024/icons/browser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { matomoRequestEvent } from '@/utils/analytics';
import { useAppState } from '@react-native-community/hooks';
import { atom, useAtom } from 'jotai';

export const activeTabAtom = atom('favorites');

export function BrowserManage(): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  const [searchState, setSearchState] = useState({
    isShowSearch: false,
    searchText: '',
  });

  const { openTab, setPartialBrowserState, closeAllTabs } = useBrowser();
  const { removeAllBrowserHistory } = useBrowserHistory();

  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const { t } = useTranslation();
  const [isShowDelete, setIsShowDelete] = useState(false);

  const renderTabBar = useMemoizedFn((props: TabBarProps<TabName>) => {
    return null;
  });

  const options = useMemo(() => {
    return [
      {
        label: t('page.browserManage.option.favorites'),
        key: 'favorites',
      },
      {
        label: t('page.browserManage.option.recent'),
        key: 'history',
      },
      {
        label: t('page.browserManage.option.tab'),
        key: 'tab',
      },
    ];
  }, [t]);

  const tabRef = React.useRef<React.ComponentRef<typeof Tabs.Container>>();
  // const navigation = useRabbyAppNavigation();
  const isChangingTabRef = React.useRef(false);
  const activeTabRef = React.useRef(activeTab);

  const handleNewTab = useMemoizedFn(() => {
    setSearchState({
      isShowSearch: true,
      searchText: '',
    });
  });

  const handlePressHome = useMemoizedFn(() => {
    setPartialBrowserState({
      isShowManage: false,
      isShowBrowser: false,
    });
    matomoRequestEvent({
      category: 'Websites Usage',
      action: `Website_Exit`,
      label: 'Click Home',
    });
  });

  const [key, setKey] = useState(0);

  const appState = useAppState();

  useEffect(() => {
    if (appState === 'active') {
      setKey(prev => prev + 1);
    }
  }, [appState]);

  return (
    <View style={styles.page} key={key}>
      <View style={styles.header}>
        <View style={styles.navbarContainer}>
          <PillsSwitch
            options={options}
            value={activeTab}
            onTabChange={key => {
              setActiveTab(key);
              tabRef.current?.jumpToTab(key);
              isChangingTabRef.current = true;
              activeTabRef.current = key;
            }}
            optionsStyle={styles.navbar}
            itemStyle={styles.navbarItem}
            activeItemStyle={styles.navbarItemActive}
            itemTextStyle={styles.navbarItemText}
            activeItemTextStyle={styles.navbarItemTextActive}
          />
        </View>
      </View>

      <Tabs.Container
        ref={tabRef}
        renderTabBar={renderTabBar}
        headerHeight={0}
        initialTabName={activeTab}
        revealHeaderOnScroll={false}
        tabBarHeight={90}
        onTabChange={data => {
          if (!isChangingTabRef.current) {
            setActiveTab(data.tabName);
            activeTabRef.current = data.tabName;
          }
          if (
            isChangingTabRef.current &&
            data.tabName === activeTabRef.current
          ) {
            isChangingTabRef.current = false;
          }
        }}>
        <Tabs.Tab name="favorites" label={'Favorites'}>
          <View style={styles.favoritesList}>
            <BrowserBookmarkList isShowDelete={isShowDelete} />
          </View>
        </Tabs.Tab>
        <Tabs.Tab name="history" label={'History'}>
          <View style={styles.historyList}>
            <BrowserHistoryList />
          </View>
        </Tabs.Tab>
        <Tabs.Tab name="tab" label={'Tab'}>
          <View style={styles.tabList}>
            <BrowserTabList />
          </View>
        </Tabs.Tab>
      </Tabs.Container>
      {activeTab === 'tab' ? (
        <View style={styles.bottomArea}>
          <TouchableOpacity onPress={handlePressHome}>
            <ReactIconHome
              width={44}
              height={44}
              color={colors2024['neutral-title-1']}
              backgroundColor={colors2024['neutral-bg-5']}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNewTab}>
            <RcIconAddPlusCircle
              width={44}
              height={44}
              color={colors2024['neutral-foot']}
              borderColor={colors2024['neutral-line']}
              backgroundColor={colors2024['neutral-bg-1']}
            />
          </TouchableOpacity>

          <DropDownMenuView
            triggerProps={{ action: 'press' }}
            menuConfig={{
              menuActions: [
                {
                  title: t('page.browserManage.BrowserTabList.closeAllTabs'),
                  key: 'close_all_tabs',
                  icon: isLight
                    ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear.png')
                    : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear_dark.png'),
                  androidIconName: isLight
                    ? 'ic_rabby_menu_clear'
                    : 'ic_rabby_menu_clear_dark',
                  action: () => {
                    closeAllTabs();
                    setPartialBrowserState({
                      isShowBrowser: false,
                    });
                  },
                },
              ],
            }}>
            <TouchableOpacity>
              <Text style={styles.bottomText}>{t('global.Edit')}</Text>
            </TouchableOpacity>
          </DropDownMenuView>
        </View>
      ) : null}
      {activeTab === 'history' ? (
        <View style={styles.bottomArea}>
          <TouchableOpacity onPress={handlePressHome}>
            <ReactIconHome
              width={44}
              height={44}
              color={colors2024['neutral-title-1']}
              backgroundColor={colors2024['neutral-bg-5']}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNewTab}>
            <RcIconAddPlusCircle
              width={44}
              height={44}
              color={colors2024['neutral-foot']}
              borderColor={colors2024['neutral-line']}
              backgroundColor={colors2024['neutral-bg-1']}
            />
          </TouchableOpacity>
          <DropDownMenuView
            triggerProps={{ action: 'press' }}
            menuConfig={{
              menuActions: [
                {
                  title: t(
                    'page.browserManage.BrowserHistoryList.clearAllHistory',
                  ),
                  key: 'close_all_tabs',
                  icon: isLight
                    ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear.png')
                    : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_clear_dark.png'),
                  androidIconName: isLight
                    ? 'ic_rabby_menu_clear'
                    : 'ic_rabby_menu_clear_dark',
                  action: () => {
                    removeAllBrowserHistory();
                  },
                },
              ],
            }}>
            <TouchableOpacity>
              <Text style={styles.bottomText}>{t('global.Edit')}</Text>
            </TouchableOpacity>
          </DropDownMenuView>
        </View>
      ) : null}
      {activeTab === 'favorites' ? (
        <View style={styles.bottomArea}>
          <TouchableOpacity onPress={handlePressHome}>
            <ReactIconHome
              width={44}
              height={44}
              color={colors2024['neutral-title-1']}
              backgroundColor={colors2024['neutral-bg-5']}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNewTab}>
            <RcIconAddPlusCircle
              width={44}
              height={44}
              color={colors2024['neutral-foot']}
              borderColor={colors2024['neutral-line']}
              backgroundColor={colors2024['neutral-bg-1']}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setIsShowDelete(prev => !prev);
            }}>
            <Text style={styles.bottomText}>
              {isShowDelete ? t('global.cancel') : t('global.Edit')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {searchState.isShowSearch ? (
        <BrowserSearch
          style={styles.browserSearch}
          searchText={searchState.searchText}
          setSearchText={v => {
            setSearchState(prev => {
              return {
                ...prev,
                searchText: v,
              };
            });
          }}
          onClose={shouldClose => {
            if (shouldClose) {
              setSearchState({
                isShowSearch: false,
                searchText: '',
              });
              setPartialBrowserState({
                isShowBrowser: false,
                isShowManage: false,
              });
            } else {
              setSearchState({
                isShowSearch: false,
                searchText: '',
              });
            }
          }}
          onOpenURL={url => {
            openTab(url, {
              isDapp: true,
            });
          }}
        />
      ) : null}
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  page: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 50,
    gap: 20,
    flexShrink: 0,
    width: '100%',
  },
  navbarContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  navbar: {
    height: 32,
    backgroundColor: colors2024['neutral-bg-4'],
    width: 'auto',
  },
  navbarItem: {
    height: 24,
    borderRadius: 12,
    flex: 0,
    paddingHorizontal: 16,
    minWidth: 75,
    // minWidth: '20%',
  },
  navbarItemActive: {
    backgroundColor: colors2024['neutral-bg-1'],
  },

  navbarItemText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  navbarItemTextActive: {
    color: colors2024['neutral-title-1'],
  },

  navbarRight: { width: 24, flexShrink: 0 },
  navbarLeft: { width: 24, flexShrink: 0 },

  tabList: {
    paddingTop: 12,
    flex: 1,
  },
  historyList: {
    paddingTop: 12,
    flex: 1,
  },
  favoritesList: {
    paddingTop: 12,
    flex: 1,
  },
  bottomArea: {
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 35,
    paddingBottom: 30,
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
  },
  bottomText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    lineHeight: 24,
  },

  browserSearch: {
    paddingTop: 18,
  },
}));
