import { RcNextLeftCC } from '@/assets/icons/common';
import { PillsSwitch } from '@/components2024/PillsSwitch';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { BrowserBookmarkList } from './components/BrowserBookmarkList';
import { BrowserHistoryList } from './components/BrowserHistoryList';
import { BrowserTabList } from './components/BrowserTabList';

export function BrowserManageScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  // const renderTabBar = useMemoizedFn((props: TabBarProps<TabName>) => {
  //   return null;
  // });

  const [activeTab, setActiveTab] = useState('tab');
  const { t } = useTranslation();

  const options = useMemo(() => {
    return [
      {
        label: t('page.browserManage.option.tab'),
        key: 'tab',
      },
      {
        label: t('page.browserManage.option.history'),
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
  const navigation = useRabbyAppNavigation();

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.page} noHeader>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navbarLeft}
          onPress={() => {
            navigation.goBack();
          }}>
          <RcNextLeftCC color={colors2024['neutral-title-1']} />
        </TouchableOpacity>
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
        <View style={styles.navbarRight} />
      </View>
      {activeTab === 'tab' ? (
        <View style={styles.tabList}>
          <BrowserTabList />
        </View>
      ) : null}
      {activeTab === 'history' ? (
        <View style={styles.historyList}>
          <BrowserHistoryList />
        </View>
      ) : null}
      {activeTab === 'favorites' ? (
        <View style={styles.favoritesList}>
          <BrowserBookmarkList />
        </View>
      ) : null}
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    backgroundColor: 'transparent',
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
  },
  navbarContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
  },

  navbar: {
    height: 32,
    backgroundColor: colors2024['neutral-bg-4'],
  },
  navbarItem: {
    height: 24,
    borderRadius: 12,
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
    paddingTop: 16,
    flex: 1,
  },
  historyList: {
    paddingTop: 14,
    flex: 1,
  },
  favoritesList: {
    paddingTop: 14,
    flex: 1,
  },
}));
