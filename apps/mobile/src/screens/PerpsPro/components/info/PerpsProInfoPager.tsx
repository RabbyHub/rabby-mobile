import type { PerpsProInfoTab } from '@/core/services/perpsService';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
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
  type SharedValue,
} from 'react-native-reanimated';

import {
  animatePerpsProTabIndicator,
  snapPerpsProTabIndicator,
} from '../common/PerpsProTabIndicator';
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
  keepAllTabsMounted = false,
) => {
  if (keepAllTabsMounted) {
    return new Set(PERPS_PRO_INFO_TABS);
  }

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
  returnToPage: (tab: PerpsProInfoTab) => void;
  scrollActiveToOffset: (offset: number, animated?: boolean) => void;
  setPage: (tab: PerpsProInfoTab) => void;
  setPageWithoutAnimation: (tab: PerpsProInfoTab) => void;
  syncPageWithoutAnimation: (tab: PerpsProInfoTab) => void;
};

type PerpsProInfoPagerProps<Row> = {
  activeTab: PerpsProInfoTab;
  authorizeNativePageGestures?: boolean;
  contentContainerStyle: Record<PerpsProInfoTab, StyleProp<ViewStyle>>;
  data: Record<PerpsProInfoTab, readonly Row[]>;
  getActiveScrollOffset: () => number;
  keepAllTabsMounted?: boolean;
  highlightedTabPosition?: SharedValue<number>;
  indicatorPosition: SharedValue<number>;
  indicatorTransitionActive?: SharedValue<boolean>;
  nativeVerticalScrollEnabled?: boolean;
  offscreenPageLimit?: number;
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
    keepAllTabsMounted = false,
    highlightedTabPosition: providedHighlightedTabPosition,
    indicatorPosition,
    indicatorTransitionActive: providedIndicatorTransitionActive,
    nativeVerticalScrollEnabled = true,
    offscreenPageLimit,
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
  const latestHandledTransitionRef = useRef(0);
  const pendingActiveCorrectionRef = useRef<{
    offset: number;
    tab: PerpsProInfoTab;
  } | null>(null);
  const settledPagePosition = useSharedValue(selectedIndexRef.current);
  const highlightedTabPosition =
    providedHighlightedTabPosition ?? indicatorPosition;
  const fallbackIndicatorTransitionActive = useSharedValue(false);
  const indicatorTransitionActive =
    providedIndicatorTransitionActive ?? fallbackIndicatorTransitionActive;
  const visualSettledPagePosition = useSharedValue(selectedIndexRef.current);
  const pageTransitionEpoch = useSharedValue(0);
  const selectedTransitionEpoch = useSharedValue(-1);
  const idleTransitionEpoch = useSharedValue(-1);
  const isPreviewGestureActive = useSharedValue(false);
  const isIndicatorScrollActive = useSharedValue(false);
  const programmaticSelectionTargetPosition = useSharedValue(-1);
  const preserveIndicatorOnSelection = useSharedValue(false);
  const transitionShouldNotifySelection = useSharedValue(true);
  const previewGestureSessionId = useSharedValue(0);
  const previewPagePosition = useSharedValue(selectedIndexRef.current);
  const activeTabRef = useRef(activeTab);

  useLayoutEffect(() => {
    indicatorTransitionActive.value = false;
    snapPerpsProTabIndicator(indicatorPosition, selectedIndexRef.current);
    snapPerpsProTabIndicator(highlightedTabPosition, selectedIndexRef.current);
  }, [highlightedTabPosition, indicatorPosition, indicatorTransitionActive]);
  activeTabRef.current = activeTab;
  const preparedTabs = useMemo(
    () =>
      getPreparedPerpsProInfoTabs(activeTab, requestedTab, keepAllTabsMounted),
    [activeTab, keepAllTabsMounted, requestedTab],
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
    (
      tab: PerpsProInfoTab,
      animated: boolean,
      shouldNotifySelection: boolean,
      shouldPreparePages = true,
    ) => {
      clearPagePreview();
      const targetIndex = PERPS_PRO_INFO_TABS.indexOf(tab);
      const currentPosition = settledPagePosition.value;
      const isReturningFromActiveTransition =
        targetIndex === currentPosition &&
        (isIndicatorScrollActive.value ||
          isPreviewGestureActive.value ||
          (programmaticSelectionTargetPosition.value >= 0 &&
            programmaticSelectionTargetPosition.value !== targetIndex));
      if (
        targetIndex < 0 ||
        (targetIndex === currentPosition && !isReturningFromActiveTransition)
      ) {
        indicatorTransitionActive.value = false;
        programmaticSelectionTargetPosition.value = -1;
        isIndicatorScrollActive.value = false;
        preserveIndicatorOnSelection.value = false;
        if (targetIndex >= 0) {
          snapPerpsProTabIndicator(indicatorPosition, targetIndex);
          snapPerpsProTabIndicator(highlightedTabPosition, targetIndex);
        }
        return;
      }
      const transitionEpoch = pageTransitionEpoch.value + 1;
      pageTransitionEpoch.value = transitionEpoch;
      indicatorTransitionActive.value = true;
      transitionShouldNotifySelection.value = shouldNotifySelection;
      selectedTransitionEpoch.value = -1;
      idleTransitionEpoch.value = -1;
      programmaticSelectionTargetPosition.value = targetIndex;
      visualSettledPagePosition.value = currentPosition;
      if (scrollBridge) {
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = !isReturningFromActiveTransition;
        if (isReturningFromActiveTransition) {
          scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
          scrollBridge.horizontalTouchSessionId.value = 0;
        }
      }
      if (shouldPreparePages) {
        preparePages();
      }
      const shouldTrackNativeProgress =
        animated && Math.abs(targetIndex - currentPosition) === 1;
      isIndicatorScrollActive.value = shouldTrackNativeProgress;
      preserveIndicatorOnSelection.value =
        animated && !shouldTrackNativeProgress;
      if (shouldTrackNativeProgress) {
        pagerRef.current?.setPage(targetIndex);
      } else {
        if (animated) {
          animatePerpsProTabIndicator(
            indicatorPosition,
            targetIndex,
            finished => {
              'worklet';
              if (finished && pageTransitionEpoch.value === transitionEpoch) {
                indicatorTransitionActive.value = false;
              }
            },
          );
          animatePerpsProTabIndicator(highlightedTabPosition, targetIndex);
        } else {
          snapPerpsProTabIndicator(indicatorPosition, targetIndex);
          snapPerpsProTabIndicator(highlightedTabPosition, targetIndex);
          indicatorTransitionActive.value = false;
        }
        pagerRef.current?.setPageWithoutAnimation(targetIndex);
      }
    },
    [
      clearPagePreview,
      highlightedTabPosition,
      idleTransitionEpoch,
      indicatorPosition,
      isIndicatorScrollActive,
      isPreviewGestureActive,
      indicatorTransitionActive,
      pageTransitionEpoch,
      preparePages,
      preserveIndicatorOnSelection,
      programmaticSelectionTargetPosition,
      selectedTransitionEpoch,
      scrollBridge,
      settledPagePosition,
      transitionShouldNotifySelection,
      visualSettledPagePosition,
    ],
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
      returnToPage: tab => setPage(tab, true, false),
      scrollActiveToOffset,
      setPage: tab => setPage(tab, true, true),
      setPageWithoutAnimation: tab => setPage(tab, false, true),
      syncPageWithoutAnimation: tab => setPage(tab, false, false),
    }),
    [scrollActiveToOffset, setPage],
  );

  const resumeSupersededProgrammaticSelection = useCallback(
    (
      observedPosition: number,
      targetPosition: number,
      transitionEpoch: number,
      shouldNotifySelection: boolean,
    ) => {
      if (
        pageTransitionEpoch.value !== transitionEpoch ||
        programmaticSelectionTargetPosition.value !== targetPosition
      ) {
        return;
      }
      const targetTab = PERPS_PRO_INFO_TABS[targetPosition];
      if (!targetTab) {
        return;
      }
      selectedIndexRef.current = observedPosition;
      setPage(targetTab, true, shouldNotifySelection, false);
    },
    [pageTransitionEpoch, programmaticSelectionTargetPosition, setPage],
  );

  useEffect(() => {
    applyPendingActiveCorrection(activeTab);
  }, [activeTab, applyPendingActiveCorrection]);

  const commitNativePageSelection = useCallback(
    (
      position: number,
      transitionEpoch: number,
      sessionId: number,
      changed: boolean,
      authorized: boolean,
      shouldNotifySelection: boolean,
    ) => {
      const tab = PERPS_PRO_INFO_TABS[position];
      if (!tab) {
        return;
      }
      if (transitionEpoch < latestHandledTransitionRef.current) {
        return;
      }
      if (!authorized && transitionEpoch !== pageTransitionEpoch.value) {
        return;
      }
      latestHandledTransitionRef.current = transitionEpoch;

      if (!authorized) {
        finishPreviewSession(sessionId, true);
        pagerRef.current?.setPageWithoutAnimation(selectedIndexRef.current);
        return;
      }

      const shouldCommit =
        shouldNotifySelection && (changed || tab !== activeTabRef.current);
      finishPreviewSession(sessionId, !shouldCommit);
      selectedIndexRef.current = position;

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
      finishPreviewSession,
      onActivateOffset,
      onPageSelected,
      pageTransitionEpoch,
      scrollBridge,
    ],
  );

  const handlePageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    event => {
      'worklet';
      const position = event.position;
      if (position < 0 || position >= PERPS_PRO_INFO_TABS.length) {
        return;
      }
      const transitionEpoch = pageTransitionEpoch.value;
      const sessionId = previewGestureSessionId.value;
      const shouldNotifySelection = transitionShouldNotifySelection.value;
      const changed = position !== settledPagePosition.value;
      const programmaticAuthorized =
        programmaticSelectionTargetPosition.value === position;
      if (
        programmaticSelectionTargetPosition.value >= 0 &&
        !programmaticAuthorized
      ) {
        if (!changed) {
          return;
        }
        const targetPosition = programmaticSelectionTargetPosition.value;
        isPreviewGestureActive.value = false;
        isIndicatorScrollActive.value = false;
        settledPagePosition.value = position;
        previewPagePosition.value = position;
        visualSettledPagePosition.value = position;
        selectedTransitionEpoch.value = -1;
        idleTransitionEpoch.value = -1;
        if (scrollBridge) {
          scrollBridge.activeIndex.value = position;
          scrollBridge.epoch.value += 1;
          scrollBridge.pageGestureActive.value = false;
          scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
          scrollBridge.horizontalTouchSessionId.value = 0;
        }
        runOnJS(resumeSupersededProgrammaticSelection)(
          position,
          targetPosition,
          transitionEpoch,
          shouldNotifySelection,
        );
        return;
      }
      const gestureAuthorized =
        !authorizeNativePageGestures ||
        isPerpsProInfoHorizontalTouchAuthorized(scrollBridge);
      const authorized =
        !changed || programmaticAuthorized || gestureAuthorized;

      if (!authorized) {
        isPreviewGestureActive.value = false;
        isIndicatorScrollActive.value = false;
        indicatorTransitionActive.value = false;
        preserveIndicatorOnSelection.value = false;
        programmaticSelectionTargetPosition.value = -1;
        previewPagePosition.value = settledPagePosition.value;
        visualSettledPagePosition.value = settledPagePosition.value;
        highlightedTabPosition.value = settledPagePosition.value;
        indicatorPosition.value = settledPagePosition.value;
        if (scrollBridge) {
          scrollBridge.pageGestureActive.value = false;
          scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
          scrollBridge.horizontalTouchSessionId.value = 0;
        }
        runOnJS(commitNativePageSelection)(
          position,
          transitionEpoch,
          sessionId,
          changed,
          false,
          false,
        );
        return;
      }

      const wasPreviewGestureActive = isPreviewGestureActive.value;
      const shouldPreserveIndicator =
        preserveIndicatorOnSelection.value && programmaticAuthorized;
      preserveIndicatorOnSelection.value = false;
      isPreviewGestureActive.value = false;
      settledPagePosition.value = position;
      previewPagePosition.value = position;
      selectedTransitionEpoch.value = transitionEpoch;
      if (programmaticAuthorized) {
        programmaticSelectionTargetPosition.value = -1;
      }
      if (scrollBridge) {
        scrollBridge.activeIndex.value = position;
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = false;
        scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
        scrollBridge.horizontalTouchSessionId.value = 0;
      }

      const shouldAwaitIosGestureFinalScroll =
        !authorizeNativePageGestures &&
        wasPreviewGestureActive &&
        isIndicatorScrollActive.value;
      const shouldFinalizeAtSelection =
        !shouldAwaitIosGestureFinalScroll &&
        (!authorizeNativePageGestures ||
          !isIndicatorScrollActive.value ||
          idleTransitionEpoch.value === transitionEpoch);
      if (shouldFinalizeAtSelection) {
        isIndicatorScrollActive.value = false;
        visualSettledPagePosition.value = position;
        if (!shouldPreserveIndicator) {
          animatePerpsProTabIndicator(indicatorPosition, position, finished => {
            'worklet';
            if (finished && pageTransitionEpoch.value === transitionEpoch) {
              indicatorTransitionActive.value = false;
            }
          });
          highlightedTabPosition.value = position;
        }
      } else if (shouldAwaitIosGestureFinalScroll) {
        visualSettledPagePosition.value = position;
        highlightedTabPosition.value = position;
        animatePerpsProTabIndicator(indicatorPosition, position, finished => {
          'worklet';
          if (finished && pageTransitionEpoch.value === transitionEpoch) {
            isIndicatorScrollActive.value = false;
            indicatorTransitionActive.value = false;
          }
        });
      }

      runOnJS(commitNativePageSelection)(
        position,
        transitionEpoch,
        sessionId,
        changed,
        true,
        shouldNotifySelection,
      );
    },
    ['onPageSelected'],
    true,
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
          const transitionEpoch = pageTransitionEpoch.value + 1;
          pageTransitionEpoch.value = transitionEpoch;
          transitionShouldNotifySelection.value = true;
          selectedTransitionEpoch.value = -1;
          idleTransitionEpoch.value = -1;
          programmaticSelectionTargetPosition.value = -1;
          const sessionId = previewGestureSessionId.value + 1;
          previewGestureSessionId.value = sessionId;
          isPreviewGestureActive.value = true;
          isIndicatorScrollActive.value = true;
          indicatorTransitionActive.value = true;
          preserveIndicatorOnSelection.value = false;
          if (scrollBridge) {
            scrollBridge.epoch.value += 1;
            scrollBridge.pageGestureActive.value = true;
          }
          previewPagePosition.value = settledPagePosition.value;
          visualSettledPagePosition.value = settledPagePosition.value;
          runOnJS(beginPageDrag)(sessionId);
          return;
        }
        if (event.pageScrollState === 'idle') {
          const transitionEpoch = pageTransitionEpoch.value;
          idleTransitionEpoch.value = transitionEpoch;
          const wasIndicatorScrollActive = isIndicatorScrollActive.value;
          const selectionSeen =
            selectedTransitionEpoch.value === transitionEpoch;
          const returnedToSettledPage =
            previewPagePosition.value === settledPagePosition.value;
          const awaitingProgrammaticSelection =
            programmaticSelectionTargetPosition.value >= 0 && !selectionSeen;
          const shouldFinalize =
            wasIndicatorScrollActive &&
            !awaitingProgrammaticSelection &&
            (selectionSeen || returnedToSettledPage);
          if (!shouldFinalize) {
            return;
          }
          isIndicatorScrollActive.value = false;
          animatePerpsProTabIndicator(
            indicatorPosition,
            settledPagePosition.value,
            finished => {
              'worklet';
              if (finished && pageTransitionEpoch.value === transitionEpoch) {
                indicatorTransitionActive.value = false;
              }
            },
          );
          highlightedTabPosition.value = settledPagePosition.value;
          visualSettledPagePosition.value = settledPagePosition.value;
          const sessionId = previewGestureSessionId.value;
          const shouldFinishPreviewSession = isPreviewGestureActive.value;
          isPreviewGestureActive.value = false;
          if (scrollBridge) {
            scrollBridge.pageGestureActive.value = false;
          }
          if (shouldFinishPreviewSession) {
            runOnJS(finishPreviewSession)(sessionId, returnedToSettledPage);
          }
        }
      },
      ['onPageScrollStateChanged'],
      true,
    );

  const handlePageScroll = useEvent<PagerViewOnPageScrollEvent>(
    event => {
      'worklet';
      const pagePosition = Math.max(
        0,
        Math.min(PERPS_PRO_INFO_TABS.length - 1, event.position + event.offset),
      );
      if (!isPreviewGestureActive.value) {
        if (isIndicatorScrollActive.value) {
          indicatorPosition.value = pagePosition;
          const nextPosition = getPerpsProInfoPagerPreviewPosition({
            maximumPosition: PERPS_PRO_INFO_TABS.length - 1,
            pagePosition,
            previewPosition: previewPagePosition.value,
            settledPosition: visualSettledPagePosition.value,
          });
          previewPagePosition.value = nextPosition;
          highlightedTabPosition.value = nextPosition;
          if (
            !authorizeNativePageGestures &&
            selectedTransitionEpoch.value === pageTransitionEpoch.value &&
            Math.abs(pagePosition - settledPagePosition.value) < 0.001
          ) {
            isIndicatorScrollActive.value = false;
            indicatorTransitionActive.value = false;
            visualSettledPagePosition.value = settledPagePosition.value;
            highlightedTabPosition.value = settledPagePosition.value;
          }
          return;
        }
        if (
          !authorizeNativePageGestures ||
          !isPerpsProInfoHorizontalTouchAuthorized(scrollBridge)
        ) {
          return;
        }
        const transitionEpoch = pageTransitionEpoch.value + 1;
        pageTransitionEpoch.value = transitionEpoch;
        transitionShouldNotifySelection.value = true;
        selectedTransitionEpoch.value = -1;
        idleTransitionEpoch.value = -1;
        programmaticSelectionTargetPosition.value = -1;
        const sessionId = previewGestureSessionId.value + 1;
        previewGestureSessionId.value = sessionId;
        isPreviewGestureActive.value = true;
        isIndicatorScrollActive.value = true;
        indicatorTransitionActive.value = true;
        preserveIndicatorOnSelection.value = false;
        if (scrollBridge) {
          scrollBridge.epoch.value += 1;
          scrollBridge.pageGestureActive.value = true;
        }
        previewPagePosition.value = settledPagePosition.value;
        visualSettledPagePosition.value = settledPagePosition.value;
        runOnJS(beginPageDrag)(sessionId);
      }
      indicatorPosition.value = pagePosition;
      const nextPosition = getPerpsProInfoPagerPreviewPosition({
        maximumPosition: PERPS_PRO_INFO_TABS.length - 1,
        pagePosition,
        previewPosition: previewPagePosition.value,
        settledPosition: visualSettledPagePosition.value,
      });
      if (nextPosition === previewPagePosition.value) {
        return;
      }
      previewPagePosition.value = nextPosition;
      highlightedTabPosition.value = nextPosition;
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
      offscreenPageLimit={offscreenPageLimit}
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
