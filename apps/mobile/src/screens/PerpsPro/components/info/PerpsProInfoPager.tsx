import type { PerpsProInfoTab } from '@/core/services/perpsService';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactElement,
} from 'react';
import {
  Animated,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PagerView, {
  type PageScrollStateChangedNativeEvent,
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import Reanimated, {
  runOnJS,
  useEvent,
  useSharedValue,
} from 'react-native-reanimated';

import { usePerpsProPagerPreviewSession } from '../common/usePerpsProPagerPreviewSession';

import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';
import {
  getPerpsProInfoScrollTarget,
  interruptPerpsProInfoScrollBridge,
  type PerpsProInfoScrollBridgeController,
} from './usePerpsProInfoScrollBridge';
import {
  type PerpsProInfoListHandle,
  usePerpsProInfoPageOffsetLifecycle,
} from './usePerpsProInfoPageOffsetLifecycle';

export { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';
export { getPerpsProInfoPagePreparedOffset } from './usePerpsProInfoPageOffsetLifecycle';

export const getPreparedPerpsProInfoTabs = (
  activeTab: PerpsProInfoTab,
  requestedTab: PerpsProInfoTab | null,
) => {
  const activeIndex = PERPS_PRO_INFO_TABS.indexOf(activeTab);
  const result = new Set<PerpsProInfoTab>([activeTab]);

  const previousTab = PERPS_PRO_INFO_TABS[activeIndex - 1];
  const nextTab = PERPS_PRO_INFO_TABS[activeIndex + 1];
  if (previousTab) {
    result.add(previousTab);
  }
  if (nextTab) {
    result.add(nextTab);
  }
  if (requestedTab) {
    result.add(requestedTab);
  }

  return result;
};

export type PerpsProInfoPagerHandle = {
  scrollActiveToOffset: (offset: number, animated?: boolean) => void;
  setPage: (tab: PerpsProInfoTab) => void;
  setPageWithoutAnimation: (tab: PerpsProInfoTab) => void;
};

type PerpsProInfoPagerProps<Row> = {
  activeTab: PerpsProInfoTab;
  contentContainerStyle: Record<PerpsProInfoTab, StyleProp<ViewStyle>>;
  data: Record<PerpsProInfoTab, readonly Row[]>;
  getActiveScrollOffset: () => number;
  onActivateOffset: (offset: number) => void;
  onActiveScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onPageDragStart: () => void;
  onPagePreview: (tab: PerpsProInfoTab | null) => void;
  onPageSelected: (tab: PerpsProInfoTab) => void;
  renderItem: ListRenderItem<Row>;
  renderListHeader: (tab: PerpsProInfoTab, active: boolean) => ReactElement;
  requestedTab: PerpsProInfoTab | null;
  scrollBridge?: PerpsProInfoScrollBridgeController;
  stickyOffset: number;
  style?: StyleProp<ViewStyle>;
};

const PerpsProInfoPagerInner = <Row,>(
  {
    activeTab,
    contentContainerStyle,
    data,
    getActiveScrollOffset,
    onActivateOffset,
    onActiveScroll,
    onLayout,
    onPageDragStart,
    onPagePreview,
    onPageSelected,
    renderItem,
    renderListHeader,
    requestedTab,
    scrollBridge,
    stickyOffset,
    style,
  }: PerpsProInfoPagerProps<Row>,
  ref: React.ForwardedRef<PerpsProInfoPagerHandle>,
) => {
  const pagerRef = useRef<PagerView>(null);
  const lastRequestedTabRef = useRef<PerpsProInfoTab | null>(null);
  const selectedIndexRef = useRef(PERPS_PRO_INFO_TABS.indexOf(activeTab));
  const settledPagePosition = useSharedValue(selectedIndexRef.current);
  const isPreviewGestureActive = useSharedValue(false);
  const previewGestureSessionId = useSharedValue(0);
  const previewPagePosition = useSharedValue(selectedIndexRef.current);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const preparedTabs = useMemo(
    () => getPreparedPerpsProInfoTabs(activeTab, requestedTab),
    [activeTab, requestedTab],
  );

  const getSelectedTab = useCallback(
    () => PERPS_PRO_INFO_TABS[selectedIndexRef.current] ?? activeTabRef.current,
    [],
  );

  const handlePreparedTransition = useCallback(
    (tab: PerpsProInfoTab, animated: boolean) => {
      const targetIndex = PERPS_PRO_INFO_TABS.indexOf(tab);
      if (
        targetIndex < 0 ||
        targetIndex === selectedIndexRef.current ||
        !pagerRef.current
      ) {
        if (scrollBridge) {
          scrollBridge.pageGestureActive.value = false;
        }
        return false;
      }
      if (animated && Math.abs(targetIndex - selectedIndexRef.current) === 1) {
        pagerRef.current.setPage(targetIndex);
      } else {
        pagerRef.current.setPageWithoutAnimation(targetIndex);
      }
      return true;
    },
    [scrollBridge],
  );

  const pageOffsetLifecycle = usePerpsProInfoPageOffsetLifecycle({
    getActiveScrollOffset,
    getSelectedTab,
    onActivateOffset,
    onPreparedTransition: handlePreparedTransition,
    stickyOffset,
  });
  const {
    activatePage,
    cancelPendingTransition: cancelPendingOffsetTransition,
    getPageMaxOffset,
    preparePages,
    recordActualOffset,
    recordContentHeight: recordPageContentHeight,
    recordViewportHeight: recordPageViewportHeight,
    requestPage: requestOffsetPage,
    scrollActiveToOffset: scrollActivePageToOffset,
    setListRef,
  } = pageOffsetLifecycle;

  const updateBridgeMaxOffset = useCallback(
    (tab: PerpsProInfoTab) => {
      if (!scrollBridge) {
        return;
      }
      const target = getPerpsProInfoScrollTarget(scrollBridge, tab);
      if (!target) {
        return;
      }
      target.maxOffset.value = getPageMaxOffset(tab);
    },
    [getPageMaxOffset, scrollBridge],
  );

  const publishPagePreview = useCallback(
    (position: number | null) => {
      onPagePreview(
        position == null ? null : PERPS_PRO_INFO_TABS[position] ?? null,
      );
    },
    [onPagePreview],
  );

  const {
    beginPreviewSession,
    finishPreviewSession,
    publishPreview,
    resetPreviewSession,
  } = usePerpsProPagerPreviewSession({
    gestureSessionId: previewGestureSessionId,
    isGestureActive: isPreviewGestureActive,
    onPreview: publishPagePreview,
  });

  const clearPagePreview = useCallback(() => {
    previewPagePosition.value = settledPagePosition.value;
    resetPreviewSession();
  }, [previewPagePosition, resetPreviewSession, settledPagePosition]);

  const cancelPendingTransition = useCallback(
    (releasePageGesture = true) => {
      cancelPendingOffsetTransition();
      if (releasePageGesture && scrollBridge && !isPreviewGestureActive.value) {
        scrollBridge.pageGestureActive.value = false;
      }
    },
    [cancelPendingOffsetTransition, isPreviewGestureActive, scrollBridge],
  );

  const requestPage = useCallback(
    (tab: PerpsProInfoTab, animated: boolean) => {
      clearPagePreview();
      const targetIndex = PERPS_PRO_INFO_TABS.indexOf(tab);
      if (targetIndex < 0 || targetIndex === selectedIndexRef.current) {
        cancelPendingTransition();
        return;
      }

      if (scrollBridge) {
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = true;
      }
      requestOffsetPage(tab, animated);
    },
    [
      cancelPendingTransition,
      clearPagePreview,
      requestOffsetPage,
      scrollBridge,
    ],
  );

  const scrollActiveToOffset = useCallback(
    (rawOffset: number, animated = true) => {
      const tab = activeTabRef.current;
      if (scrollBridge) {
        scrollBridge.epoch.value += 1;
      }
      scrollActivePageToOffset(tab, rawOffset, animated);
    },
    [scrollActivePageToOffset, scrollBridge],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollActiveToOffset,
      setPage: tab => requestPage(tab, true),
      setPageWithoutAnimation: tab => requestPage(tab, false),
    }),
    [requestPage, scrollActiveToOffset],
  );

  useEffect(() => {
    if (requestedTab === lastRequestedTabRef.current) {
      return;
    }
    lastRequestedTabRef.current = requestedTab;
    if (requestedTab == null) {
      cancelPendingTransition();
      return;
    }
    requestPage(requestedTab, true);
  }, [cancelPendingTransition, requestPage, requestedTab]);

  useEffect(() => {
    const activeIndex = PERPS_PRO_INFO_TABS.indexOf(activeTab);
    if (scrollBridge && activeIndex >= 0) {
      scrollBridge.activeIndex.value = activeIndex;
      scrollBridge.epoch.value += 1;
      scrollBridge.pageGestureActive.value = false;
    }
    if (activeIndex < 0 || activeIndex === selectedIndexRef.current) {
      return;
    }
    cancelPendingTransition();
    clearPagePreview();
    selectedIndexRef.current = activeIndex;
    settledPagePosition.value = activeIndex;
    previewPagePosition.value = activeIndex;
    pagerRef.current?.setPageWithoutAnimation(activeIndex);
  }, [
    activeTab,
    cancelPendingTransition,
    clearPagePreview,
    previewPagePosition,
    scrollBridge,
    settledPagePosition,
  ]);

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const position = event.nativeEvent.position;
      const tab = PERPS_PRO_INFO_TABS[position];
      if (!tab) {
        return;
      }
      const changed = position !== selectedIndexRef.current;
      const shouldCommit = changed || tab !== activeTabRef.current;
      if (scrollBridge) {
        scrollBridge.activeIndex.value = position;
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = false;
      }
      const sessionId = previewGestureSessionId.value;
      isPreviewGestureActive.value = false;
      settledPagePosition.value = position;
      previewPagePosition.value = position;
      finishPreviewSession(sessionId, !shouldCommit);
      selectedIndexRef.current = position;
      onActivateOffset(activatePage(tab));
      if (shouldCommit) {
        onPageSelected(tab);
      }
    },
    [
      activatePage,
      isPreviewGestureActive,
      onActivateOffset,
      onPageSelected,
      finishPreviewSession,
      previewGestureSessionId,
      previewPagePosition,
      scrollBridge,
      settledPagePosition,
    ],
  );

  const beginPageDrag = useCallback(
    (sessionId: number) => {
      cancelPendingTransition(false);
      beginPreviewSession(sessionId);
      preparePages();
      onPageDragStart();
    },
    [
      beginPreviewSession,
      cancelPendingTransition,
      onPageDragStart,
      preparePages,
    ],
  );

  const handlePageScrollStateChanged =
    useEvent<PageScrollStateChangedNativeEvent>(
      event => {
        'worklet';
        if (event.pageScrollState === 'dragging') {
          if (isPreviewGestureActive.value) {
            return;
          }
          const sessionId = previewGestureSessionId.value + 1;
          previewGestureSessionId.value = sessionId;
          isPreviewGestureActive.value = true;
          if (scrollBridge) {
            scrollBridge.epoch.value += 1;
            scrollBridge.pageGestureActive.value = true;
          }
          previewPagePosition.value = settledPagePosition.value;
          runOnJS(beginPageDrag)(sessionId);
          return;
        }
        if (event.pageScrollState === 'idle') {
          const sessionId = previewGestureSessionId.value;
          const shouldFinishPreviewSession = isPreviewGestureActive.value;
          isPreviewGestureActive.value = false;
          if (scrollBridge) {
            scrollBridge.pageGestureActive.value = false;
          }
          if (shouldFinishPreviewSession) {
            runOnJS(finishPreviewSession)(sessionId, false);
          }
        }
      },
      ['onPageScrollStateChanged'],
      true,
    );

  const handlePageScroll = useEvent<PagerViewOnPageScrollEvent>(
    event => {
      'worklet';
      if (!isPreviewGestureActive.value) {
        return;
      }
      const nextPosition = Math.max(
        0,
        Math.min(
          PERPS_PRO_INFO_TABS.length - 1,
          Math.round(event.position + event.offset),
        ),
      );
      if (nextPosition === previewPagePosition.value) {
        return;
      }
      previewPagePosition.value = nextPosition;
      runOnJS(publishPreview)(previewGestureSessionId.value, nextPosition);
    },
    ['onPageScroll'],
    true,
  );

  const recordScrollEnd = useCallback(
    (tab: PerpsProInfoTab, event: NativeSyntheticEvent<NativeScrollEvent>) =>
      recordActualOffset(tab, event.nativeEvent.contentOffset.y),
    [recordActualOffset],
  );

  const recordInactiveScroll = useCallback(
    (tab: PerpsProInfoTab, event: NativeSyntheticEvent<NativeScrollEvent>) =>
      recordActualOffset(tab, event.nativeEvent.contentOffset.y),
    [recordActualOffset],
  );

  const recordContentHeight = useCallback(
    (tab: PerpsProInfoTab, height: number) => {
      recordPageContentHeight(tab, height);
      updateBridgeMaxOffset(tab);
    },
    [recordPageContentHeight, updateBridgeMaxOffset],
  );

  const recordViewportHeight = useCallback(
    (tab: PerpsProInfoTab, event: LayoutChangeEvent, active: boolean) => {
      const height = event.nativeEvent.layout.height;
      recordPageViewportHeight(tab, height);
      updateBridgeMaxOffset(tab);
      if (active) {
        onLayout(event);
      }
    },
    [onLayout, recordPageViewportHeight, updateBridgeMaxOffset],
  );

  return (
    <ReanimatedPagerView
      initialPage={selectedIndexRef.current}
      onPageScroll={handlePageScroll}
      onPageScrollStateChanged={handlePageScrollStateChanged}
      onPageSelected={handlePageSelected}
      ref={pagerRef}
      style={style}
      testID="perps-pro-info-pager">
      {PERPS_PRO_INFO_TABS.map(tab => {
        const active = tab === activeTab;
        return (
          <View
            accessibilityElementsHidden={!active}
            collapsable={false}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
            key={tab}
            pointerEvents={active ? 'auto' : 'none'}
            style={styles.page}
            testID={`perps-pro-info-page-${tab}`}>
            {preparedTabs.has(tab) ? (
              <Animated.FlatList
                ListHeaderComponent={renderListHeader(tab, active)}
                contentContainerStyle={contentContainerStyle[tab]}
                data={data[tab] as never}
                initialNumToRender={6}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item, index) =>
                  String((item as { key?: string }).key ?? index)
                }
                onContentSizeChange={(_width, height) =>
                  recordContentHeight(tab, height)
                }
                onLayout={event => recordViewportHeight(tab, event, active)}
                onMomentumScrollEnd={event => recordScrollEnd(tab, event)}
                onScroll={
                  active
                    ? onActiveScroll
                    : event => recordInactiveScroll(tab, event)
                }
                onScrollBeginDrag={
                  active && scrollBridge
                    ? () => interruptPerpsProInfoScrollBridge(scrollBridge)
                    : undefined
                }
                onScrollEndDrag={event => recordScrollEnd(tab, event)}
                ref={list => {
                  setListRef(
                    tab,
                    list as unknown as PerpsProInfoListHandle | null,
                  );
                  if (scrollBridge) {
                    getPerpsProInfoScrollTarget(scrollBridge, tab)?.ref(
                      list as never,
                    );
                  }
                }}
                renderItem={renderItem}
                scrollEnabled={active}
                scrollEventThrottle={16}
                scrollsToTop={active}
                showsVerticalScrollIndicator={false}
                style={styles.list}
                testID={active ? 'perps-pro-scroll' : `perps-pro-scroll-${tab}`}
              />
            ) : null}
          </View>
        );
      })}
    </ReanimatedPagerView>
  );
};

export const PerpsProInfoPager = forwardRef(PerpsProInfoPagerInner) as <Row>(
  props: PerpsProInfoPagerProps<Row> & {
    ref?: React.ForwardedRef<PerpsProInfoPagerHandle>;
  },
) => ReactElement;

const styles = {
  list: { flex: 1 },
  page: { flex: 1 },
};

const ReanimatedPagerView = Reanimated.createAnimatedComponent(PagerView);
