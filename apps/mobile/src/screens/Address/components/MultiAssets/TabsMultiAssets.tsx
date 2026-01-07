import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import { MemoizedTokenItemLoader, TokenList } from './TokenList';
import { MemoizedDefiItemLoader, ProtocolList } from './ProtocolList';
import {
  CollapsibleRef,
  TabBarProps,
  Tabs,
} from 'react-native-collapsible-tab-view';
import {
  HeaderHeight,
  TabsTopHeader,
} from '@/screens/Home/components/OverviewTopHeader';
import CustomLabel from '@/screens/Home/components/Tabs/CustomLabel';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { ChainSelector } from '@/screens/Home/components/AssetRenderItems/SectionHeaders';
import { isTabsSwiping, useShowReceiveAddressTip } from './hooks';
import { MemoizedNFTItemLoader, NFTList } from './NFTList';
import { Freeze } from 'react-freeze';
import { matomoRequestEvent } from '@/utils/analytics';
import { PerpsMultiAssetPosition } from '@/screens/Perps/components/PerpsMultiAssetPosition';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { useHomeTabIndex } from '@/hooks/navigation';
import { runIIFEFunc } from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';
import { useMyAccounts } from '@/hooks/account';
import { filterDirectlySignableAccounts } from '@/core/apis/account';
import { ReceiveOnNoAssets } from '@/screens/Home/components/ReceiveOnNoAssets';
import { Account } from '@/core/services/preference';

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
  OverViewComponent: React.FC<{
    // accountToShowReceiveTip?: Account | null;
  }>;
}

export const enum TabName {
  overview = 'overview',
  token = 'token',
  defi = 'defi',
  nft = 'nft',
}

const renderTabBar = (
  _props: React.ComponentProps<typeof HomeCustomMaterialTabBar>,
) => <HomeCustomMaterialTabBar {..._props} />;

function TabIndexBasedFreeze({
  ofIndex,
  children,
  ...props
}: {
  ofIndex: number;
} & Omit<React.ComponentProps<typeof Freeze>, 'freeze'>) {
  const { tabIndex } = useHomeTabIndex();
  return (
    <Freeze
      {...props}
      // freeze={ofIndex !== tabIndex}
      freeze={false}>
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

const renderLabel =
  (name: string) =>
  ({ index, indexDecimal }) =>
    <CustomLabel index={index} indexDecimal={indexDecimal} text={name} />;

const renderHeader = (props: Pick<TabBarProps<string>, 'index'>) => {
  return <TabsTopHeader indexValue={props.index} />;
};

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = ({
  onIndexChange,
  OverViewComponent,
}) => {
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

  const { accountToShowReceiveTip } = useShowReceiveAddressTip();

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
        <OverViewComponent />
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
              style={{ marginTop: TAB_HEADER_FULL_HEIGHT + 16 }}
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
