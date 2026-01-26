import React, { useCallback } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { perfEvents } from '@/core/utils/perf';
import { runIIFEFunc } from '@/core/utils/store';
import { apisHomeTabIndex, useHomeTabIndex } from '@/hooks/navigation';
import {
  HOME_INDICATOR_HEIGHT,
  HomeCustomMaterialTabBar,
} from '@/screens/Home/components/CustomTabBar';
import { TabsTopHeader } from '@/screens/Home/components/OverviewTopHeader';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import CustomLabel from '@/screens/Home/components/Tabs/CustomLabel';
import { homeDrawerAnimateMutable } from '@/screens/Home/hooks/useHomeDrawerAnimate';
import { matomoRequestEvent } from '@/utils/analytics';
import { Freeze } from 'react-freeze';
import { Container, Tabs } from 'react-native-collapsible-tab-view';
import { isTabsSwiping } from './hooks';
import { MemoizedNFTItemLoader, NFTList } from './NFTList';
import { MemoizedDefiItemLoader, ProtocolList } from './ProtocolList';
import { MemoizedTokenItemLoader, TokenList } from './TokenList';
import { IS_IOS } from '@/core/native/utils';
import { HomeOverview } from '@/screens/Home/components/HomeOverview';

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
  HOME_TOP_HEADER_SIZES.headerHeight + HOME_TOP_HEADER_SIZES.tabItemHeight;

interface TabMultiAssetsProps {}

export const enum TabName {
  overview = 'overview',
  token = 'token',
  defi = 'defi',
  nft = 'nft',
}

function TabIndexBasedFreeze({
  ofIndex,
  children,
  ...props
}: {
  ofIndex: number;
} & Omit<React.ComponentProps<typeof Freeze>, 'freeze'>) {
  // const { tabIndex } = useHomeTabIndex();
  return (
    <Freeze
      {...props}
      // freeze={ofIndex !== tabIndex}
      freeze={false}>
      {children}
    </Freeze>
  );
}

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

const renderTabHeader: React.ComponentProps<typeof Container>['renderHeader'] &
  object = props => <TabsTopHeader indexDecimalValue={props.indexDecimal} />;
const renderTabBar: React.ComponentProps<typeof Container>['renderTabBar'] &
  object = props => <HomeCustomMaterialTabBar {...props} />;

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { tabIndex } = useHomeTabIndex();

  const renderLabel = useCallback(
    (name: string) =>
      // eslint-disable-next-line react/no-unstable-nested-components
      ({ index, indexDecimal }) =>
        <CustomLabel index={index} indexDecimal={indexDecimal} text={name} />,
    [],
  );

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

  React.useEffect(() => {
    const currentIndex = homeTabScrollerRef.current?.getCurrentIndex?.();
    if (typeof currentIndex !== 'number' || currentIndex === tabIndex) {
      return;
    }
    homeTabScrollerRef.current?.setIndex(tabIndex);
  }, [tabIndex]);

  useRendererDetect({ name: 'TabsMultiAssets' });

  return (
    <Tabs.Container
      ref={homeTabScrollerRef}
      onIndexChange={onIndexChange}
      renderHeader={renderTabHeader}
      onTabChange={handleTabChange}
      renderTabBar={renderTabBar}
      headerHeight={HOME_TOP_HEADER_SIZES.headerHeight}
      minHeaderHeight={HOME_TOP_HEADER_SIZES.headerHeight}
      tabBarHeight={HOME_TOP_HEADER_SIZES.tabItemHeight + HOME_INDICATOR_HEIGHT}
      allowHeaderOverscroll={IS_IOS}
      lazy={false}
      cancelLazyFadeIn
      pagerProps={{
        onPageScrollStateChanged: event => {
          isTabsSwiping.value = event?.nativeEvent?.pageScrollState !== 'idle';
        },
        // scrollEnabled: !accountToShowReceiveTip,
      }}
      containerStyle={styles.container}
      headerContainerStyle={styles.headerContainer}>
      <Tabs.Tab
        key={TabName.overview}
        name={TabName.overview}
        label={() => null}>
        <HomeOverview />
      </Tabs.Tab>

      <Tabs.Tab
        key={TabName.token}
        name={TabName.token}
        label={renderLabel('Token')}>
        <TabIndexBasedFreeze
          ofIndex={1}
          placeholder={
            <MemoizedTokenItemLoader
              style={{ marginTop: TAB_HEADER_FULL_HEIGHT }}
            />
          }>
          <TokenList />
        </TabIndexBasedFreeze>
      </Tabs.Tab>
      <Tabs.Tab
        key={TabName.defi}
        name={TabName.defi}
        label={renderLabel('DeFi')}>
        <TabIndexBasedFreeze
          ofIndex={2}
          placeholder={
            <MemoizedDefiItemLoader
              style={{ marginTop: TAB_HEADER_FULL_HEIGHT }}
            />
          }>
          <ProtocolList />
        </TabIndexBasedFreeze>
      </Tabs.Tab>
      <Tabs.Tab key={TabName.nft} name={TabName.nft} label={renderLabel('NFT')}>
        <TabIndexBasedFreeze
          ofIndex={3}
          placeholder={
            <MemoizedNFTItemLoader
              style={{ marginTop: TAB_HEADER_FULL_HEIGHT }}
            />
          }>
          <NFTList />
        </TabIndexBasedFreeze>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const getStyles = createGetStyles2024(({ safeAreaInsets }) => ({
  container: {
    flex: 1,
    marginTop: safeAreaInsets.top,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
}));
