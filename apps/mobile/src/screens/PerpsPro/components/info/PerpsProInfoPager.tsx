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
import { getPerpsProInfoPagerPreviewPosition } from './perpsProInfoPagerPreview';
import {
  getPerpsProInfoScrollTarget,
  interruptPerpsProInfoScrollBridge,
  PERPS_PRO_INFO_TOUCH_INTENT,
  type PerpsProInfoScrollBridgeController,
} from './usePerpsProInfoScrollBridge';

export { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';

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

export const getPerpsProInfoPagePreparedOffset = ({
  activeOffset,
  storedOffset,
  stickyOffset,
}: {
  activeOffset: number;
  storedOffset: number;
  stickyOffset: number;
}) => {
  const safeActiveOffset = Number.isFinite(activeOffset)
    ? Math.max(0, activeOffset)
    : 0;
  const safeStoredOffset = Number.isFinite(storedOffset)
    ? Math.max(0, storedOffset)
    : 0;
  const safeStickyOffset = Number.isFinite(stickyOffset)
    ? Math.max(0, stickyOffset)
    : 0;

  return safeActiveOffset < safeStickyOffset
    ? safeActiveOffset
    : Math.max(safeStoredOffset, safeStickyOffset);
};

export type PerpsProInfoPagerHandle = {
  scrollActiveToOffset: (offset: number, animated?: boolean) => void;
  setPage: (tab: PerpsProInfoTab) => void;
  setPageWithoutAnimation: (tab: PerpsProInfoTab) => void;
};

type PerpsProInfoPagerProps<Row> = {
  activeTab: PerpsProInfoTab;
  authorizeNativePageGestures?: boolean;
  contentContainerStyle: Record<PerpsProInfoTab, StyleProp<ViewStyle>>;
  data: Record<PerpsProInfoTab, readonly Row[]>;
  getActiveScrollOffset: () => number;
  nativeVerticalScrollEnabled?: boolean;
  onActivateOffset: (offset: number) => void;
  onActiveScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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

type PerpsProInfoListHandle = {
  scrollToOffset: (params: { animated?: boolean; offset: number }) => void;
};

const isPerpsProInfoHorizontalTouchAuthorized = (
  controller?: PerpsProInfoScrollBridgeController,
) => {
  'worklet';
  if (!controller) {
    return false;
  }
  const touchSessionId = controller.touchSessionId.value;
  return (
    controller.touchIntent.value === PERPS_PRO_INFO_TOUCH_INTENT.horizontal &&
    touchSessionId > 0 &&
    controller.horizontalTouchSessionId.value === touchSessionId
  );
};

const PerpsProInfoPagerInner = <Row,>(
  {
    activeTab,
    authorizeNativePageGestures = false,
    contentContainerStyle,
    data,
    getActiveScrollOffset,
    nativeVerticalScrollEnabled = true,
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
  const listRefs = useRef<
    Partial<Record<PerpsProInfoTab, PerpsProInfoListHandle | null>>
  >({});
  const desiredOffsetsRef = useRef<Record<PerpsProInfoTab, number>>({
    account: 0,
    positions: 0,
    openOrders: 0,
  });
  const contentHeightsRef = useRef<Record<PerpsProInfoTab, number>>({
    account: 0,
    positions: 0,
    openOrders: 0,
  });
  const viewportHeightsRef = useRef<Record<PerpsProInfoTab, number>>({
    account: 0,
    positions: 0,
    openOrders: 0,
  });
  const selectedIndexRef = useRef(PERPS_PRO_INFO_TABS.indexOf(activeTab));
  const programmaticTargetIndexRef = useRef<number | null>(null);
  const pendingActiveCorrectionRef = useRef<{
    offset: number;
    tab: PerpsProInfoTab;
  } | null>(null);
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

  const recordDesiredOffset = useCallback(
    (tab: PerpsProInfoTab, rawOffset: number) => {
      if (!Number.isFinite(rawOffset)) {
        return;
      }
      desiredOffsetsRef.current[tab] = Math.max(0, rawOffset);
    },
    [],
  );

  const updateBridgeMaxOffset = useCallback(
    (tab: PerpsProInfoTab) => {
      if (!scrollBridge) {
        return;
      }
      const target = getPerpsProInfoScrollTarget(scrollBridge, tab);
      if (!target) {
        return;
      }
      target.maxOffset.value = Math.max(
        0,
        contentHeightsRef.current[tab] - viewportHeightsRef.current[tab],
      );
    },
    [scrollBridge],
  );

  const applyPendingActiveCorrection = useCallback(
    (tab: PerpsProInfoTab) => {
      const pending = pendingActiveCorrectionRef.current;
      if (
        !pending ||
        pending.tab !== tab ||
        activeTabRef.current !== tab ||
        !listRefs.current[tab] ||
        contentHeightsRef.current[tab] <= 0 ||
        viewportHeightsRef.current[tab] <= 0
      ) {
        return;
      }

      const maxOffset = Math.max(
        0,
        contentHeightsRef.current[tab] - viewportHeightsRef.current[tab],
      );
      const offset = Math.min(Math.max(pending.offset, 0), maxOffset);
      pendingActiveCorrectionRef.current = null;
      recordDesiredOffset(tab, offset);
      listRefs.current[tab]?.scrollToOffset({ animated: false, offset });
    },
    [recordDesiredOffset],
  );

  const preparePages = useCallback(() => {
    const currentTab = activeTabRef.current;
    const nativeActiveOffset =
      scrollBridge?.targets[selectedIndexRef.current]?.offset.value;
    const rawActiveOffset = Number.isFinite(nativeActiveOffset)
      ? nativeActiveOffset
      : getActiveScrollOffset();
    const activeOffset = Math.max(0, rawActiveOffset ?? 0);
    recordDesiredOffset(currentTab, activeOffset);

    for (const tab of PERPS_PRO_INFO_TABS) {
      if (tab === currentTab) {
        continue;
      }
      const offset = getPerpsProInfoPagePreparedOffset({
        activeOffset,
        stickyOffset,
        storedOffset: desiredOffsetsRef.current[tab],
      });
      recordDesiredOffset(tab, offset);
      listRefs.current[tab]?.scrollToOffset({ animated: false, offset });
    }
  }, [getActiveScrollOffset, recordDesiredOffset, scrollBridge, stickyOffset]);

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

  const setPage = useCallback(
    (tab: PerpsProInfoTab, animated: boolean) => {
      clearPagePreview();
      const targetIndex = PERPS_PRO_INFO_TABS.indexOf(tab);
      if (targetIndex < 0 || targetIndex === selectedIndexRef.current) {
        programmaticTargetIndexRef.current = null;
        return;
      }
      programmaticTargetIndexRef.current = targetIndex;
      if (scrollBridge) {
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = true;
      }
      preparePages();
      if (animated && Math.abs(targetIndex - selectedIndexRef.current) === 1) {
        pagerRef.current?.setPage(targetIndex);
      } else {
        pagerRef.current?.setPageWithoutAnimation(targetIndex);
      }
    },
    [clearPagePreview, preparePages, scrollBridge],
  );

  const scrollActiveToOffset = useCallback(
    (rawOffset: number, animated = true) => {
      const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
      const tab = activeTabRef.current;
      if (scrollBridge) {
        scrollBridge.epoch.value += 1;
      }
      recordDesiredOffset(tab, offset);
      listRefs.current[tab]?.scrollToOffset({ animated, offset });
      onActivateOffset(offset);
    },
    [onActivateOffset, recordDesiredOffset, scrollBridge],
  );

  useImperativeHandle(
    ref,
    () => ({
      scrollActiveToOffset,
      setPage: tab => setPage(tab, true),
      setPageWithoutAnimation: tab => setPage(tab, false),
    }),
    [scrollActiveToOffset, setPage],
  );

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
    clearPagePreview();
    selectedIndexRef.current = activeIndex;
    settledPagePosition.value = activeIndex;
    previewPagePosition.value = activeIndex;
    programmaticTargetIndexRef.current = activeIndex;
    pagerRef.current?.setPageWithoutAnimation(activeIndex);
  }, [
    activeTab,
    clearPagePreview,
    previewPagePosition,
    scrollBridge,
    settledPagePosition,
  ]);

  useEffect(() => {
    applyPendingActiveCorrection(activeTab);
  }, [activeTab, applyPendingActiveCorrection]);

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      const position = event.nativeEvent.position;
      const tab = PERPS_PRO_INFO_TABS[position];
      if (!tab) {
        return;
      }
      const changed = position !== selectedIndexRef.current;
      const sessionId = previewGestureSessionId.value;
      const programmaticAuthorized =
        programmaticTargetIndexRef.current === position;
      const gestureAuthorized =
        !authorizeNativePageGestures ||
        isPerpsProInfoHorizontalTouchAuthorized(scrollBridge);

      if (changed && !programmaticAuthorized && !gestureAuthorized) {
        isPreviewGestureActive.value = false;
        previewPagePosition.value = settledPagePosition.value;
        finishPreviewSession(sessionId, true);
        if (scrollBridge) {
          scrollBridge.pageGestureActive.value = false;
          scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
          scrollBridge.horizontalTouchSessionId.value = 0;
        }
        pagerRef.current?.setPageWithoutAnimation(selectedIndexRef.current);
        return;
      }

      const shouldCommit = changed || tab !== activeTabRef.current;
      if (scrollBridge) {
        scrollBridge.activeIndex.value = position;
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = false;
        scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
        scrollBridge.horizontalTouchSessionId.value = 0;
      }
      isPreviewGestureActive.value = false;
      settledPagePosition.value = position;
      previewPagePosition.value = position;
      finishPreviewSession(sessionId, !shouldCommit);
      selectedIndexRef.current = position;
      if (programmaticAuthorized) {
        programmaticTargetIndexRef.current = null;
      }

      const rawActualOffset =
        scrollBridge?.targets[position]?.offset.value ?? 0;
      const actualOffset = Number.isFinite(rawActualOffset)
        ? Math.max(0, rawActualOffset)
        : 0;
      const desiredOffset = desiredOffsetsRef.current[tab];
      pendingActiveCorrectionRef.current =
        Math.abs(desiredOffset - actualOffset) > 0.5
          ? { offset: desiredOffset, tab }
          : null;
      onActivateOffset(actualOffset);
      if (shouldCommit) {
        onPageSelected(tab);
      }
    },
    [
      authorizeNativePageGestures,
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
      beginPreviewSession(sessionId);
      preparePages();
      onPageDragStart();
    },
    [beginPreviewSession, onPageDragStart, preparePages],
  );

  const handlePageScrollStateChanged =
    useEvent<PageScrollStateChangedNativeEvent>(
      event => {
        'worklet';
        if (event.pageScrollState === 'dragging') {
          if (isPreviewGestureActive.value) {
            return;
          }
          if (
            authorizeNativePageGestures &&
            !isPerpsProInfoHorizontalTouchAuthorized(scrollBridge)
          ) {
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
        if (
          !authorizeNativePageGestures ||
          !isPerpsProInfoHorizontalTouchAuthorized(scrollBridge)
        ) {
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
      }
      const nextPosition = getPerpsProInfoPagerPreviewPosition({
        maximumPosition: PERPS_PRO_INFO_TABS.length - 1,
        pagePosition: event.position + event.offset,
        previewPosition: previewPagePosition.value,
        settledPosition: settledPagePosition.value,
      });
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
      recordDesiredOffset(tab, event.nativeEvent.contentOffset.y),
    [recordDesiredOffset],
  );

  const recordContentHeight = useCallback(
    (tab: PerpsProInfoTab, height: number) => {
      contentHeightsRef.current[tab] = Math.max(0, height);
      updateBridgeMaxOffset(tab);
      applyPendingActiveCorrection(tab);
    },
    [applyPendingActiveCorrection, updateBridgeMaxOffset],
  );

  const recordViewportHeight = useCallback(
    (tab: PerpsProInfoTab, event: LayoutChangeEvent, active: boolean) => {
      viewportHeightsRef.current[tab] = Math.max(
        0,
        event.nativeEvent.layout.height,
      );
      updateBridgeMaxOffset(tab);
      applyPendingActiveCorrection(tab);
      if (active) {
        onLayout(event);
      }
    },
    [applyPendingActiveCorrection, onLayout, updateBridgeMaxOffset],
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
                onScroll={active ? onActiveScroll : undefined}
                onScrollBeginDrag={
                  active && nativeVerticalScrollEnabled && scrollBridge
                    ? () => interruptPerpsProInfoScrollBridge(scrollBridge)
                    : undefined
                }
                onScrollEndDrag={event => recordScrollEnd(tab, event)}
                ref={list => {
                  listRefs.current[tab] =
                    list as unknown as PerpsProInfoListHandle;
                  if (scrollBridge) {
                    getPerpsProInfoScrollTarget(scrollBridge, tab)?.ref(
                      list as never,
                    );
                  }
                  applyPendingActiveCorrection(tab);
                }}
                renderItem={renderItem}
                scrollEnabled={active && nativeVerticalScrollEnabled}
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
