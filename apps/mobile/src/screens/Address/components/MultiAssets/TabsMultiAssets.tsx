import React, { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import { MemoizedTokenItemLoader, TokenList } from './TokenList';
import { MemoizedDefiItemLoader, ProtocolList } from './ProtocolList';
import { CollapsibleRef, Tabs } from 'react-native-collapsible-tab-view';
import {
  HeaderHeight,
  TabsTopHeader,
} from '@/screens/Home/components/OverviewTopHeader';
import CustomLabel from '@/screens/Home/components/Tabs/CustomLabel';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { ChainSelector } from '@/screens/Home/components/AssetRenderItems/SectionHeaders';
import { isTabsSwiping } from './hooks';
import { MemoizedNFTItemLoader, NFTList } from './NFTList';
import { Freeze } from 'react-freeze';
import { matomoRequestEvent } from '@/utils/analytics';
import { PerpsMultiAssetPosition } from '@/screens/Perps/components/PerpsMultiAssetPosition';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { useHomeTabIndex } from '@/hooks/navigation';
import { runIIFEFunc } from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';

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
export const TAB_HEADER_FULL_HEIGHT = 94;
export const TAB_HEADER_MIN_HEIGHT = 44;

export interface TabMultiAssetsProps {
  onIndexChange(index: number): void;
  OverViewComponent: React.FC<{}>;
  tabsOpacity?: Animated.AnimatedInterpolation<number>;
}

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
  const { tabIndex } = useHomeTabIndex();
  return (
    <Freeze {...props} freeze={ofIndex !== tabIndex}>
      {children}
    </Freeze>
  );
}

const homeTabScrollerRef = React.createRef<CollapsibleRef<string>>();

runIIFEFunc(() => {
  perfEvents.subscribe('NAV_BACK_ON_HOME', () => {
    if (!homeTabScrollerRef.current) return;
    const currentIndex = homeTabScrollerRef.current?.getCurrentIndex() || 0;
    if (currentIndex > 0) {
      homeTabScrollerRef.current?.setIndex(Math.max(0, currentIndex - 1));
    }
  });
});

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = ({
  // tabIndex,
  onIndexChange,
  // data,
  // loading,
  // multi24HBalanceReturn,
  // overViewContent,
  OverViewComponent,
  tabsOpacity,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const renderTabBar = React.useCallback(
    (
      _props: React.ComponentProps<
        typeof HomeCustomMaterialTabBar
      >['materialTabBarProps'],
    ) => (
      <Animated.View
        style={{ opacity: tabsOpacity || 1 }}
        pointerEvents={
          (tabsOpacity as any)?.__getValue?.() < 0.1 ? 'none' : 'auto'
        }>
        <HomeCustomMaterialTabBar
          materialTabBarProps={{
            ..._props,
          }}
        />
      </Animated.View>
    ),
    [tabsOpacity],
  );

  const renderLabel = useCallback(
    (name: string) =>
      // eslint-disable-next-line react/no-unstable-nested-components
      ({ index, indexDecimal }) =>
        <CustomLabel index={index} indexDecimal={indexDecimal} text={name} />,
    [],
  );

  // const {tabIndex} = useHomeTabIndex();

  const renderHeader = useCallback<
    React.ComponentProps<typeof Tabs.Container>['renderHeader'] & object
  >(
    props => {
      return (
        <Animated.View
          style={{ opacity: tabsOpacity || 1 }}
          pointerEvents={
            (tabsOpacity as any)?.__getValue?.() < 0.1 ? 'none' : 'auto'
          }>
          <TabsTopHeader
            // data={data}
            // loading={loading}
            // showNetWorth={tabIndex !== 0}
            indexValue={props.index}
          />
        </Animated.View>
      );
    },
    [
      tabsOpacity,
      // tabIndex,
      /* data, loading */
    ],
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

  useRendererDetect({ name: 'TabsMultiAssets' });

  return (
    <Tabs.Container
      ref={homeTabScrollerRef}
      onIndexChange={onIndexChange}
      renderHeader={renderHeader}
      onTabChange={handleTabChange}
      renderTabBar={renderTabBar}
      headerHeight={HeaderHeight}
      minHeaderHeight={HeaderHeight}
      tabBarHeight={74}
      allowHeaderOverscroll
      lazy={false}
      cancelLazyFadeIn
      pagerProps={{
        onPageScrollStateChanged: event => {
          isTabsSwiping.value = event?.nativeEvent?.pageScrollState !== 'idle';
        },
      }}
      containerStyle={styles.container}
      headerContainerStyle={styles.headerContainer}>
      <Tabs.Tab
        key={TabName.overview}
        name={TabName.overview}
        label={() => null}>
        <OverViewComponent />
      </Tabs.Tab>

      <Tabs.Tab
        key={TabName.token}
        name={TabName.token}
        label={renderLabel('Token')}>
        {/* <View /> */}
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
        {/* <View /> */}
        <TabIndexBasedFreeze
          ofIndex={2}
          placeholder={
            <MemoizedDefiItemLoader
              style={{ marginTop: TAB_HEADER_FULL_HEIGHT + 16 }}
            />
          }>
          <ProtocolList />
        </TabIndexBasedFreeze>
      </Tabs.Tab>
      <Tabs.Tab key={TabName.nft} name={TabName.nft} label={renderLabel('NFT')}>
        {/* <View /> */}
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

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
    marginTop: 64,
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
}));
