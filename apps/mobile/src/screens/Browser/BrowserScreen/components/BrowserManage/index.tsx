import { PillsSwitch } from '@/components2024/PillsSwitch';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BrowserBookmarkList } from './BrowserBookmarkList';
import { BrowserHistoryList } from './BrowserHistoryList';
import { BrowserTabList } from './BrowserTabList';
import { BrowserSearch } from '../BrowserSearch';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useMemoizedFn } from 'ahooks';

export function BrowserManage(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const [searchState, setSearchState] = useState({
    isShowSearch: false,
    searchText: '',
  });

  const { openTab } = useBrowser();

  const [activeTab, setActiveTab] = useState('tab');
  const { t } = useTranslation();

  const options = useMemo(() => {
    return [
      {
        label: t('page.browserManage.option.tab'),
        key: 'tab',
      },
      {
        label: t('page.browserManage.option.recent'),
        key: 'history',
      },
      {
        label: t('page.browserManage.option.favorites'),
        key: 'favorites',
      },
    ];
  }, [t]);

  // todo fix any
  const tabRef = React.useRef<any>();
  // const navigation = useRabbyAppNavigation();

  const handleNewTab = useMemoizedFn(() => {
    setSearchState({
      isShowSearch: true,
      searchText: '',
    });
  });

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.navbarContainer}>
          <PillsSwitch
            options={options}
            value={activeTab}
            onTabChange={key => {
              setActiveTab(key);
              tabRef.current?.jumpToTab(key);
            }}
            optionsStyle={styles.navbar}
            itemStyle={styles.navbarItem}
            activeItemStyle={styles.navbarItemActive}
            itemTextStyle={styles.navbarItemText}
            activeItemTextStyle={styles.navbarItemTextActive}
          />
        </View>
      </View>
      {activeTab === 'tab' ? (
        <View style={styles.tabList}>
          <BrowserTabList onNewTab={handleNewTab} />
        </View>
      ) : null}
      {activeTab === 'history' ? (
        <View style={styles.historyList}>
          <BrowserHistoryList onNewTab={handleNewTab} />
        </View>
      ) : null}
      {activeTab === 'favorites' ? (
        <View style={styles.favoritesList}>
          <BrowserBookmarkList onNewTab={handleNewTab} />
        </View>
      ) : null}
      {searchState.isShowSearch ? (
        <BrowserSearch
          style={{
            paddingTop: 18,
          }}
          searchText={searchState.searchText}
          setSearchText={v => {
            setSearchState(prev => {
              return {
                ...prev,
                searchText: v,
              };
            });
          }}
          onClose={() => {
            setSearchState({
              isShowSearch: false,
              searchText: '',
            });
          }}
          onOpenURL={url => {
            openTab(url);
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
}));
