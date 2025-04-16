import { RcNextLeftCC } from '@/assets/icons/common';
import { PillsSwitch } from '@/components2024/PillsSwitch';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TabActions, useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { BrowserBookmarkList } from './components/BrowserBookmarkList';
import { BrowserHistoryList } from './components/BrowserHistoryList';
import { BrowserTabList } from './components/BrowserTabList';
import { useRabbyAppNavigation } from '@/hooks/navigation';

export function BrowserManageScreen(): JSX.Element {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });

  // const renderTabBar = useMemoizedFn((props: TabBarProps<TabName>) => {
  //   return null;
  // });

  const [activeTab, setActiveTab] = useState('tab');

  const options = useMemo(() => {
    return [
      {
        label: 'Tab',
        key: 'tab',
      },
      {
        label: 'History',
        key: 'history',
      },
      {
        label: 'Favorites',
        key: 'favorites',
      },
    ];
  }, []);

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
      {/* <Tabs.Container
        ref={tabRef}
        renderTabBar={renderTabBar}
        headerHeight={0}
        initialTabName={activeTab}
        revealHeaderOnScroll={false}
        tabBarHeight={90}
        onTabChange={data => {
          console.log('onTabchange', data);
          setActiveTab(data.tabName);
        }}>
        <Tabs.Tab name="tab" label={'Tab'}>
          <View style={styles.tabList}>
            <BrowserTabList />
          </View>
        </Tabs.Tab>
        <Tabs.Tab name="history" label={'History'}>
          <View style={styles.historyList}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>History</Text>
            </View>
            <BrowserHistoryList />
          </View>
        </Tabs.Tab>
        <Tabs.Tab name="favorites" label={'Favorites'}>
          <View style={styles.favoritesList}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>Favorites</Text>
            </View>
            <DappCardList
              data={favoriteApps}
              onFavoritePress={handleFavoriteDapp}
              onPress={handleOpenURLDebounced}
            />
          </View>
        </Tabs.Tab>
      </Tabs.Container> */}
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
