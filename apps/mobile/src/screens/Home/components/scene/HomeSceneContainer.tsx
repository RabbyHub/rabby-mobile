import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  InteractionManager,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import {
  CollapsibleSceneProvider,
  LinkedScenePager,
  useCollapsibleSceneController,
  useCollapsibleScene,
  type LinkedScenePage,
  type LinkedScenePageContext,
  type LinkedScenePagerHandle,
  type LinkedScenePath,
} from '@rabby-wallet/rn-collapsible-scene-view';

import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';
import { isTabsSwiping } from '@/screens/Address/components/MultiAssets/hooks';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { useTheme2024 } from '@/hooks/theme';

import {
  getHomeSceneContentInset,
  HOME_SCENE_CONTENT_TOP,
  HOME_SCENE_HEADER_HEIGHT,
  HOME_SCENE_TAB_BAR_HEIGHT,
  HOME_SCENE_TAB_BAR_TOP,
  HOME_SCENE_TABS,
} from './homeSceneLayout';

const SCENE_PAGES: readonly LinkedScenePage[] = HOME_SCENE_TABS.map(key => ({
  key,
}));

const tabIndex = (tab: HomeTabName) =>
  Math.max(HOME_SCENE_TABS.indexOf(tab), 0);

/**
 * One vertical scene for the whole home first floor: a single collapsing
 * header, one pinned tab strip, and four horizontally linked pages that each
 * own their vertical scroll surface but share the scene offset.
 */
export function HomeSceneContainer({
  pages,
  tabBar,
  header,
  onTabSelected,
}: {
  pages: Record<HomeTabName, React.ReactNode>;
  tabBar: React.ReactNode;
  header: React.ReactNode;
  onTabSelected?: (index: number) => void;
}) {
  const isScreenFocused = useIsFocused();
  const controller = useCollapsibleSceneController();
  const pagerRef = useRef<LinkedScenePagerHandle>(null);
  const indicatorPosition = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  const [activeTab, setActiveTab] = useState<HomeTabName>(HomeTabName.overview);
  const activeTabRef = useRef<HomeTabName>(HomeTabName.overview);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [visited, setVisited] = useState<HomeTabName[]>([HomeTabName.overview]);
  const [eagerMount, setEagerMount] = useState(false);

  activeTabRef.current = activeTab;

  // Expose the pager through the legacy home-tab API so navigation helpers,
  // deep links and regression actions keep working unchanged.
  useEffect(() => {
    const handle = {
      getCurrentIndex: () => tabIndex(activeTabRef.current),
      setIndex: (index: number) => {
        const next =
          HOME_SCENE_TABS[
            Math.min(Math.max(index, 0), HOME_SCENE_TABS.length - 1)
          ];
        if (next !== undefined) {
          pagerRef.current?.jumpTab(next);
        }
      },
    };
    apisHomeTabIndex.homeTabScrollerRef.current = handle;
    return () => {
      if (apisHomeTabIndex.homeTabScrollerRef.current === handle) {
        apisHomeTabIndex.homeTabScrollerRef.current = null;
      }
    };
  }, []);

  // The tab strip indicator and the legacy shared index both follow the live
  // horizontal position, so they never wait for a JS commit.
  useAnimatedReaction(
    () => indicatorPosition.value,
    value => {
      apisHomeTabIndex.svTabIndexDecimal.value = value;
      const settled = Math.round(value);
      const name = HOME_SCENE_TABS[settled];
      if (name === undefined) {
        return;
      }
      if (apisHomeTabIndex.svTabName.value !== name) {
        apisHomeTabIndex.svTabName.value = name;
      }
    },
  );
  useAnimatedReaction(
    () => gestureActive.value,
    value => {
      isTabsSwiping.value = value;
    },
  );

  useEffect(() => {
    if (visited.includes(activeTab)) {
      return;
    }
    setVisited(current =>
      current.includes(activeTab) ? current : [...current, activeTab],
    );
  }, [activeTab, visited]);

  // Mount the remaining pages once the screen is idle. The first swipe then
  // never pays a cold list mount.
  useEffect(() => {
    if (!isScreenFocused || eagerMount) {
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        if (!cancelled) {
          setEagerMount(true);
        }
      });
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [eagerMount, isScreenFocused]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (height <= 0) {
      return;
    }
    setViewportHeight(current => (current === height ? current : height));
  }, []);

  const activePath = useMemo(() => ({ key: activeTab }), [activeTab]);

  const handlePathChange = useCallback(
    (path: LinkedScenePath) => {
      const next = path.key as HomeTabName;
      activeTabRef.current = next;
      setActiveTab(next);
      const index = tabIndex(next);
      apisHomeTabIndex.setTabIndex(index);
      onTabSelected?.(index);
    },
    [onTabSelected],
  );

  const renderLeaf = useCallback(
    (path: LinkedScenePath, context: LinkedScenePageContext) => {
      const tab = path.key as HomeTabName;
      const shouldRender =
        context.active || eagerMount || visited.includes(tab);
      return (
        <HomeScenePage
          active={context.active}
          height={context.viewportHeight}
          tab={tab}>
          {shouldRender ? pages[tab] : null}
        </HomeScenePage>
      );
    },
    [eagerMount, pages, visited],
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {viewportHeight > 0 ? (
        <CollapsibleSceneProvider
          activeTab={activeTab}
          controller={controller}
          headerHeight={HOME_SCENE_HEADER_HEIGHT}
          syncOffsetOnActivate={false}
          tabs={HOME_SCENE_TABS}>
          <LinkedScenePager
            ref={pagerRef}
            activePath={activePath}
            activityEnabled={isScreenFocused}
            contentTop={HOME_SCENE_CONTENT_TOP}
            fillViewport
            gestureActive={gestureActive}
            indicatorPosition={indicatorPosition}
            onPathChange={handlePathChange}
            pages={SCENE_PAGES}
            settleMode="snap"
            pinnedHeight={HOME_SCENE_TAB_BAR_HEIGHT}
            renderLeaf={renderLeaf}
            scrollOffset={controller.scrollY}
            testID="home-scene"
            viewportHeight={viewportHeight}
            overlay={
              <>
                <View
                  pointerEvents="box-none"
                  style={styles.tabBarLayer}
                  testID="home-scene-tab-bar">
                  <PinnedTabBarSurface />
                  {tabBar}
                </View>
                <View
                  pointerEvents="box-none"
                  style={styles.headerLayer}
                  testID="home-scene-header">
                  <RenderActivityBoundary
                    active={isScreenFocused}
                    label="home-multi-assets-header">
                    {header}
                  </RenderActivityBoundary>
                </View>
              </>
            }
          />
        </CollapsibleSceneProvider>
      ) : null}
    </View>
  );
}

function HomeScenePage({
  active,
  children,
  height,
  tab,
}: {
  active: boolean;
  children: React.ReactNode;
  height: number;
  tab: HomeTabName;
}) {
  const isScreenFocused = useIsFocused();
  const regressionScenario = useRegressionScenario<'Home'>();
  const lastRegressionStateKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !regressionScenario.active ||
      regressionScenario.scenario !== 'high-cardinality-assets'
    ) {
      return;
    }
    const stateKey = [
      regressionScenario.runId,
      tab,
      active ? tab : 'none',
      isScreenFocused,
      active,
    ].join(':');
    if (lastRegressionStateKeyRef.current === stateKey) {
      return;
    }
    lastRegressionStateKeyRef.current = stateKey;
    regressionScenario.report('perf-mark', {
      mark: 'home-tab-activity-boundary',
      tabName: tab,
      focusedTab: active ? tab : null,
      isScreenFocused,
      active,
    });
  }, [active, isScreenFocused, regressionScenario, tab]);

  return (
    <RenderActivityBoundary active={active} label={`home-multi-assets-${tab}`}>
      <View style={{ height }}>{children}</View>
    </RenderActivityBoundary>
  );
}

/**
 * Once the tab strip pins, rows scroll underneath it: fade in a matching
 * surface so the chrome never sits directly on top of list content.
 */
function PinnedTabBarSurface() {
  const { colors2024 } = useTheme2024();
  const { headerHeight, scrollY } = useCollapsibleScene();
  const fadeStyle = useAnimatedStyle(() => {
    const range = Math.max(headerHeight, 1);
    return { opacity: Math.min(Math.max(scrollY.value / range, 0), 1) };
  }, [headerHeight]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tabBarSurface,
        { backgroundColor: colors2024['neutral-bg-1'] },
        fadeStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerLayer: {
    height: HOME_SCENE_HEADER_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 3,
  },
  tabBarLayer: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: HOME_SCENE_TAB_BAR_TOP,
    zIndex: 2,
  },
  tabBarSurface: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: -HOME_SCENE_TAB_BAR_TOP,
  },
});
