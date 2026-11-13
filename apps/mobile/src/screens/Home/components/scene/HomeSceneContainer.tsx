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
  useWindowDimensions,
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
  type LinkedScenePage,
  type LinkedScenePageContext,
  type LinkedScenePagerHandle,
  type LinkedScenePath,
} from '@rabby-wallet/rn-collapsible-scene-view';

import { apisHomeTabIndex, HomeTabName } from '@/hooks/navigation';
import { isNonPublicProductionEnv } from '@/constant';
import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';
import { isTabsSwiping } from '@/screens/Address/components/MultiAssets/hooks';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { logger } from '@/utils/logger';

import {
  HOME_SCENE_CHROME_BOTTOM,
  HOME_SCENE_CONTENT_TOP,
  HOME_SCENE_HEADER_HEIGHT,
  HOME_SCENE_TAB_BAR_HEIGHT,
  HOME_SCENE_TAB_BAR_TOP,
  HOME_SCENE_TABS,
} from './homeSceneLayout';
import {
  bindHomePagerDebugLive,
  recordHomePagerCommittedPage,
  recordHomePagerDebugEvent,
} from './homePagerDiagnostics';

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
  chromeBackdrop,
  onTabSelected,
}: {
  pages: Record<HomeTabName, React.ReactNode>;
  tabBar: React.ReactNode;
  header: React.ReactNode;
  /**
   * Painted behind the fixed chrome. List rows scroll underneath the header
   * and tab strip, so this has to stay opaque (screen gradient + top image).
   */
  chromeBackdrop?: React.ReactNode;
  onTabSelected?: (index: number) => void;
}) {
  const isScreenFocused = useIsFocused();
  const controller = useCollapsibleSceneController();
  const pagerRef = useRef<LinkedScenePagerHandle>(null);
  const indicatorPosition = useSharedValue(0);
  const gestureActive = useSharedValue(false);
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  const handlePagerDiagnostic = useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof LinkedScenePager>['onDiagnosticEvent']
        >
      >[0],
    ) => {
      const emit = (
        kind: Parameters<typeof recordHomePagerDebugEvent>[0],
        text: string,
      ) => {
        recordHomePagerDebugEvent(kind, text);
        // Also goes to the app log file, so a hand-driven session can be
        // reviewed afterwards (files/applogs on the device).
        logger.debug(`[home-pager] ${text}`);
      };
      if (event.type === 'mount') {
        emit('mount', `mount root=${event.rootIndex} key=${event.activeKey}`);
        return;
      }
      if (event.type === 'begin') {
        emit(
          'begin',
          `begin start=${event.start}${
            event.snappedFrom !== null
              ? ` snap ${event.snappedFrom.toFixed(2)}→${event.start}`
              : ''
          }`,
        );
        return;
      }
      if (event.type === 'end') {
        emit(
          'end',
          `end ${event.axis} pos=${event.position.toFixed(2)} start=${
            event.start
          } Δ=${(event.position - event.start).toFixed(
            2,
          )} v=${event.velocityPages.toFixed(2)}`,
        );
        return;
      }
      if (event.type === 'settle') {
        emit(
          'settle',
          `settle ${event.axis} pos=${event.position.toFixed(2)} start=${
            event.start
          } Δ=${(event.position - event.start).toFixed(2)} → ${
            event.target
          } v=${event.velocityPages.toFixed(2)}`,
        );
        return;
      }
      if (event.type === 'commit') {
        emit(
          'commit',
          `commit → ${event.rootIndex}${
            event.childIndex === undefined ? '' : `/${event.childIndex}`
          }${event.changed ? '' : ' (same)'}`,
        );
        recordHomePagerCommittedPage(event.rootIndex);
        return;
      }
      emit(
        event.applied ? 'jump' : 'jump-ignored',
        `jump req=${event.requested} ${
          event.applied
            ? `applied${
                event.from === undefined ? '' : ` from=${event.from.toFixed(2)}`
              }`
            : `ignored(${event.reason})`
        }`,
      );
    },
    [],
  );

  React.useEffect(
    () =>
      bindHomePagerDebugLive({
        track: indicatorPosition,
        gesturing: gestureActive,
      }),
    [gestureActive, indicatorPosition],
  );

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

  // The opaque backdrop belongs to the tab strip. Its top part is shared by
  // every page and stays at the overview's content edge; the extra band that
  // assets pages need rides in horizontally with the tab strip instead of
  // growing downwards over the overview card.
  const chromeExtensionHeight =
    HOME_SCENE_CHROME_BOTTOM.assets - HOME_SCENE_CHROME_BOTTOM.overview;

  const chromeExtensionWindowStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(indicatorPosition.value, 0), 1);
    return {
      transform: [{ translateX: (1 - progress) * winWidth }],
    };
  }, [winWidth]);

  // Counter-translate the replica so it keeps matching the screen backdrop
  // while the clip window moves: only the visible band travels with the pager.
  const chromeExtensionContentStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(indicatorPosition.value, 0), 1);
    return {
      transform: [{ translateX: -(1 - progress) * winWidth }],
    };
  }, [winWidth]);

  const handlePathChange = useCallback(
    (path: LinkedScenePath) => {
      const next = path.key as HomeTabName;
      activeTabRef.current = next;
      setActiveTab(next);
      const index = tabIndex(next);
      // The pager already settled here; only publish the index. Calling
      // setTabIndex would command the same pager again from its own commit
      // callback, which can overwrite a newer drag or settle.
      apisHomeTabIndex.publishSettledIndex(index);
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
            onDiagnosticEvent={
              isNonPublicProductionEnv ? handlePagerDiagnostic : undefined
            }
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
                {chromeBackdrop ? (
                  <>
                    <View
                      pointerEvents="none"
                      style={[
                        styles.chromeBackdropLayer,
                        { height: HOME_SCENE_CHROME_BOTTOM.overview },
                      ]}
                      testID="home-scene-chrome-backdrop">
                      {chromeBackdrop}
                    </View>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.chromeBackdropExtensionWindow,
                        {
                          top: HOME_SCENE_CHROME_BOTTOM.overview,
                          height: chromeExtensionHeight,
                        },
                        chromeExtensionWindowStyle,
                      ]}
                      testID="home-scene-chrome-backdrop-extension">
                      <Animated.View
                        style={[
                          styles.chromeBackdropExtensionContent,
                          {
                            top: -HOME_SCENE_CHROME_BOTTOM.overview,
                            width: winWidth,
                            height: winHeight,
                          },
                          chromeExtensionContentStyle,
                        ]}>
                        {chromeBackdrop}
                      </Animated.View>
                    </Animated.View>
                  </>
                ) : null}
                <View
                  pointerEvents="box-none"
                  style={styles.tabBarLayer}
                  testID="home-scene-tab-bar">
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chromeBackdropLayer: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  chromeBackdropExtensionWindow: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  chromeBackdropExtensionContent: {
    left: 0,
    position: 'absolute',
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
});
