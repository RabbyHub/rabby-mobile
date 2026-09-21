import React, { useCallback, type ReactNode } from 'react';
import { InteractionManager, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { perfEvents } from '@/core/utils/perf';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { HomeCustomMaterialTabBar } from '@/screens/Home/components/CustomTabBar';
import { TabsTopHeader } from '@/screens/Home/components/OverviewTopHeader';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { matomoRequestEvent } from '@/utils/analytics';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';
import { isTabsSwiping } from './hooks';
import { NFTList } from './NFTList';
import { ProtocolList } from './ProtocolList';
import { TokenList } from './TokenList';
import { IS_IOS } from '@/core/native/utils';
import { HomeOverview } from '@/screens/Home/components/HomeOverview';
import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';

export const TAB_HEADER_FULL_HEIGHT =
  HOME_TOP_HEADER_SIZES.headerHeight +
  HOME_TOP_HEADER_SIZES.scrollableListTopOffset;

interface TabMultiAssetsProps {}

import { HomeTabName as TabName } from '@/hooks/navigation';
import { MultiAssetsContainer } from '@/components/customized/react-native-collapsible-tab-view/MultiAssetsContainer';
export { HomeTabName as TabName } from '@/hooks/navigation';

const homeTabScrollerRef = apisHomeTabIndex.homeTabScrollerRef;
type ReadableAccountStoreWarmupTarget = 'token' | 'nft' | 'protocol';
const scheduledReadableAccountStoreWarmupTargets =
  new Set<ReadableAccountStoreWarmupTarget>();

runStartupTask(() => {
  perfEvents.subscribe('NAV_BACK_ON_HOME', () => {
    if (!homeTabScrollerRef.current) {
      return;
    }
    const currentIndex = homeTabScrollerRef.current?.getCurrentIndex() || 0;
    if (currentIndex > 0) {
      homeTabScrollerRef.current?.setIndex(Math.max(0, currentIndex - 1));
    }
  });
}, STARTUP_TASKS.homeTabBackListener);

function getReadableAccountStoreWarmupTargetByIndex(
  idx: number,
): ReadableAccountStoreWarmupTarget | null {
  if (idx === 1) {
    return 'token';
  }
  if (idx === 2) {
    return 'protocol';
  }
  if (idx === 3) {
    return 'nft';
  }
  return null;
}

function scheduleReadableAccountStoreWarmupForTab(idx: number) {
  const target = getReadableAccountStoreWarmupTargetByIndex(idx);
  if (!target || scheduledReadableAccountStoreWarmupTargets.has(target)) {
    return;
  }

  scheduledReadableAccountStoreWarmupTargets.add(target);
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      import('@/setup-app-before-render')
        .then(({ startInitReadableAccountStores }) =>
          startInitReadableAccountStores(target, `home_tab_${target}`),
        )
        .catch(error => {
          scheduledReadableAccountStoreWarmupTargets.delete(target);
          console.error(
            `scheduleReadableAccountStoreWarmupForTab::${target}::error`,
            error,
          );
        });
    }, 80);
  });
}

const onIndexChange = (idx: number) => {
  apisHomeTabIndex.setTabIndex(idx);
  scheduleReadableAccountStoreWarmupForTab(idx);
};

const HomeTabActivityBoundary = ({
  children,
  name,
}: {
  children: ReactNode;
  name: HomeTabName;
}) => {
  const focusedTab = useFocusedTab();
  const isScreenFocused = useIsFocused();
  const regressionScenario = useRegressionScenario<'Home'>();
  const active = isScreenFocused && focusedTab === name;
  const lastRegressionStateKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (
      !regressionScenario.active ||
      regressionScenario.scenario !== 'high-cardinality-assets'
    ) {
      return;
    }

    const stateKey = [
      regressionScenario.runId,
      name,
      focusedTab || 'none',
      isScreenFocused,
      active,
    ].join(':');
    if (lastRegressionStateKeyRef.current === stateKey) {
      return;
    }
    lastRegressionStateKeyRef.current = stateKey;

    regressionScenario.report('perf-mark', {
      mark: 'home-tab-activity-boundary',
      tabName: name,
      focusedTab: focusedTab || null,
      isScreenFocused,
      active,
    });
  }, [active, focusedTab, isScreenFocused, name, regressionScenario]);

  return (
    <RenderActivityBoundary active={active} label={`home-multi-assets-${name}`}>
      {children}
    </RenderActivityBoundary>
  );
};

export const TabsMultiAssets: React.FC<TabMultiAssetsProps> = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const isScreenFocused = useIsFocused();

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
      <RenderActivityBoundary
        active={isScreenFocused}
        label="home-multi-assets-header">
        <TabsTopHeader />
      </RenderActivityBoundary>
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
        lazy
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
          <HomeTabActivityBoundary name={TabName.overview}>
            <HomeOverview />
          </HomeTabActivityBoundary>
        </Tabs.Tab>

        <Tabs.Tab key={TabName.token} name={TabName.token} label={() => null}>
          <HomeTabActivityBoundary name={TabName.token}>
            <TokenList />
          </HomeTabActivityBoundary>
        </Tabs.Tab>
        <Tabs.Tab key={TabName.defi} name={TabName.defi} label={() => null}>
          <HomeTabActivityBoundary name={TabName.defi}>
            <ProtocolList />
          </HomeTabActivityBoundary>
        </Tabs.Tab>
        <Tabs.Tab key={TabName.nft} name={TabName.nft} label={() => null}>
          <HomeTabActivityBoundary name={TabName.nft}>
            <NFTList />
          </HomeTabActivityBoundary>
        </Tabs.Tab>
      </MultiAssetsContainer>
    </View>
  );
};

const getStyles = createGetStyles2024(() => ({
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
