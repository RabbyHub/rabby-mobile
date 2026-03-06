import React, { useCallback } from 'react';
import { View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';

import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { perfEvents } from '@/core/utils/perf';
import { runIIFEFunc } from '@/core/utils/store';
import {
  apisHomeTabIndex,
  HomeTabName,
  useHomeTabIndex,
} from '@/hooks/navigation';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { TabsTopHeader } from '@/screens/Home/components/OverviewTopHeader';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import CustomLabel from '@/screens/Home/components/Tabs/CustomLabel';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  Container,
  TabBarProps,
  Tabs,
} from 'react-native-collapsible-tab-view';
import { isTabsSwiping } from './hooks';
import { NFTList } from './NFTList';
import { ProtocolList } from './ProtocolList';
import { TokenList } from './TokenList';
import { IS_IOS } from '@/core/native/utils';
import { HomeOverview } from '@/screens/Home/components/HomeOverview';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

export const icons = {
  unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
  unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
  foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
  foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png'),
  pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png'),
  unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png'),
};
export const TAB_HEADER_FULL_HEIGHT =
  HOME_TOP_HEADER_SIZES.headerHeight +
  HOME_TOP_HEADER_SIZES.scrollableListTopOffset;

interface TabMultiAssetsProps {}

import { HomeTabName as TabName } from '@/hooks/navigation';
import { MultiAssetsContainer } from '@/components/customized/react-native-collapsible-tab-view/MultiAssetsContainer';
export { HomeTabName as TabName } from '@/hooks/navigation';

const homeTabScrollerRef = apisHomeTabIndex.homeTabScrollerRef;

runIIFEFunc(() => {
  perfEvents.subscribe('NAV_BACK_ON_HOME', () => {
    if (!homeTabScrollerRef.current) return;
    const currentIndex = homeTabScrollerRef.current?.getCurrentIndex() || 0;
    if (currentIndex > 0) {
      homeTabScrollerRef.current?.setIndex(Math.max(0, currentIndex - 1));
    }
  });
});

const onIndexChange = (idx: number) => {
  apisHomeTabIndex.setTabIndex(idx);
};

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const handleTabChange = useCallback(
    ({ prevIndex, index }: { prevIndex: number; index: number }) => {
      // 在前两个tab之间切换
      const isSwapBetweenOverviewAndOtherTabs =
        (prevIndex === 0 && index === 1) || (prevIndex === 1 && index === 0);
      if (isSwapBetweenOverviewAndOtherTabs) {
        matomoRequestEvent({
          category: 'HomeTab',
          action: 'HomeTab_Switch',
        });
      }
    },
    [],
  );
  useRendererDetect({ name: 'TabsMultiAssets' });

  return (
    <View style={styles.container}>
      <TabsTopHeader />
      <HomeCustomMaterialTabBar />
      <MultiAssetsContainer
        ref={homeTabScrollerRef}
        onIndexChange={onIndexChange}
        onTabChange={handleTabChange}
        // renderHeader={renderTabHeaderStub}
        workletOnIndexDecimalChange={ctx => {
          'worklet';
          apisHomeTabIndex.onTabSvsChange(
            ctx.indexDecimal,
            ctx.tabName as HomeTabName,
          );
        }}
        renderHeader={() => null}
        renderTabBar={() => null}
        // renderTabBar={renderTabBar}
        headerHeight={0}
        minHeaderHeight={0}
        tabBarHeight={0}
        allowHeaderOverscroll={IS_IOS}
        lazy={false}
        cancelLazyFadeIn
        pagerProps={{
          onPageScrollStateChanged: event => {
            isTabsSwiping.value =
              event?.nativeEvent?.pageScrollState !== 'idle';
          },
          // scrollEnabled: !accountToShowReceiveTip,
        }}
        containerStyle={styles.tabsContainer}
        headerContainerStyle={styles.headerContainer}>
        <Tabs.Tab
          key={TabName.overview}
          name={TabName.overview}
          label={() => null}>
          <HomeOverview />
        </Tabs.Tab>

        <Tabs.Tab key={TabName.token} name={TabName.token} label={() => null}>
          <TokenList />
        </Tabs.Tab>
        <Tabs.Tab key={TabName.defi} name={TabName.defi} label={() => null}>
          <ProtocolList />
        </Tabs.Tab>
        <Tabs.Tab key={TabName.nft} name={TabName.nft} label={() => null}>
          <NFTList />
        </Tabs.Tab>
      </MultiAssetsContainer>
    </View>
  );
};

const getStyles = createGetStyles2024(({ safeAreaInsets }) => ({
  container: {
    position: 'relative',
    flex: 1,
    // paddingTop: safeAreaInsets.top,
  },
  tabsContainer: {
    flex: 1,
    // marginTop: safeAreaInsets.top,
    // ...makeDebugBorder('blue'),
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
}));
