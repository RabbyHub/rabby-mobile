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
  dispatchCommand,
  runOnJS,
  runOnUI,
  useAnimatedRef,
  useEvent,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { snapPerpsProTabIndicator } from '../common/PerpsProTabIndicator';
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
  returnToPage: (tab: PerpsProInfoTab, requestId?: number) => void;
  scrollActiveToOffset: (offset: number, animated?: boolean) => void;
  setPage: (tab: PerpsProInfoTab, requestId?: number) => void;
  setPageWithoutAnimation: (tab: PerpsProInfoTab, requestId?: number) => void;
  syncPageWithoutAnimation: (tab: PerpsProInfoTab, requestId?: number) => void;
};

type PerpsProInfoPageRequest = {
  animated: boolean;
  id: number;
  notifySelection: boolean;
  position: number;
};

type PerpsProInfoPagerProps<Row> = {
  activeTab: PerpsProInfoTab;
  authorizeNativePageGestures?: boolean;
  contentContainerStyle: Record<PerpsProInfoTab, StyleProp<ViewStyle>>;
  data: Record<PerpsProInfoTab, readonly Row[]>;
  getActiveScrollOffset: () => number;
  initialRequestId?: number;
  keepAllTabsMounted?: boolean;
  indicatorPosition: SharedValue<number>;
  nativeVerticalScrollEnabled?: boolean;
  offscreenPageLimit?: number;
  onActivateOffset: (offset: number) => void;
  onActiveScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onPageDragStart: (requestId: number) => void;
  onPagePreview: (tab: PerpsProInfoTab | null) => void;
  onPageRequestFinished?: (requestId: number) => void;
  onPageSelected: (tab: PerpsProInfoTab, requestId: number) => void;
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
  controller: PerpsProInfoScrollBridgeController | undefined,
  expectedTouchSessionId: number,
) => {
  'worklet';
  if (!controller || expectedTouchSessionId <= 0) {
    return false;
  }
  return (
    controller.touchIntent.value === PERPS_PRO_INFO_TOUCH_INTENT.horizontal &&
    controller.touchSessionId.value === expectedTouchSessionId &&
    controller.horizontalTouchSessionId.value === expectedTouchSessionId
  );
};

const PerpsProInfoPagerInner = <Row,>(
  {
    activeTab,
    authorizeNativePageGestures = false,
    contentContainerStyle,
    data,
    getActiveScrollOffset,
    initialRequestId = 0,
    keepAllTabsMounted = false,
    indicatorPosition,
    nativeVerticalScrollEnabled = true,
    offscreenPageLimit,
    onActivateOffset,
    onActiveScroll,
    onLayout,
    onPageDragStart,
    onPagePreview,
    onPageRequestFinished,
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
  const pagerRef = useAnimatedRef<PagerView>();
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
  const latestRequestIdRef = useRef(initialRequestId);
  const mountedRef = useRef(true);
  const pendingActiveCorrectionRef = useRef<{
    offset: number;
    tab: PerpsProInfoTab;
  } | null>(null);
  const settledPagePosition = useSharedValue(selectedIndexRef.current);
  // Native selected is an acknowledgement, not necessarily a business commit
  // or the physical end of an animation.
  const nativeSelectedPosition = useSharedValue(selectedIndexRef.current);
  const latestRequestId = useSharedValue(initialRequestId);
  const pendingPageRequest = useSharedValue<PerpsProInfoPageRequest | null>(
    null,
  );
  const visualSettledPagePosition = useSharedValue(selectedIndexRef.current);
  const pageTransitionEpoch = useSharedValue(0);
  const selectedTransitionEpoch = useSharedValue(-1);
  const idleTransitionEpoch = useSharedValue(-1);
  const isPreviewGestureActive = useSharedValue(false);
  const isIndicatorScrollActive = useSharedValue(false);
  const isNativeGestureVisualActive = useSharedValue(false);
  const nativeGestureVisualTouchSessionId = useSharedValue(0);
  const programmaticSelectionTargetPosition = useSharedValue(-1);
  const previewGestureSessionId = useSharedValue(0);
  const previewPagePosition = useSharedValue(selectedIndexRef.current);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    snapPerpsProTabIndicator(indicatorPosition, selectedIndexRef.current);
  }, [indicatorPosition]);
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
    const currentIndex =
      scrollBridge?.activeIndex.value ?? selectedIndexRef.current;
    const currentTab = PERPS_PRO_INFO_TABS[currentIndex];
    const nativeActiveOffset =
      scrollBridge?.targets[currentIndex]?.offset.value;
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

  const { beginPreviewSession, finishPreviewSession, publishPreview } =
    usePerpsProPagerPreviewSession({
      gestureSessionId: previewGestureSessionId,
      isGestureActive: isPreviewGestureActive,
      onPreview: publishPagePreview,
    });

  useEffect(() => {
    applyPendingActiveCorrection(activeTab);
  }, [activeTab, applyPendingActiveCorrection]);

  const commitNativePageSelection = useCallback(
    (
      position: number,
      transitionEpoch: number,
      sessionId: number,
      changed: boolean,
      shouldNotifySelection: boolean,
      requestId: number,
    ) => {
      const tab = PERPS_PRO_INFO_TABS[position];
      if (
        !tab ||
        !mountedRef.current ||
        requestId !== latestRequestIdRef.current ||
        transitionEpoch < latestHandledTransitionRef.current
      ) {
        return;
      }
      latestHandledTransitionRef.current = transitionEpoch;
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
        onPageSelected(tab, requestId);
      }
      onPageRequestFinished?.(requestId);
    },
    [
      finishPreviewSession,
      onActivateOffset,
      onPageRequestFinished,
      onPageSelected,
      scrollBridge,
    ],
  );

  const closeNativeGestureVisual = useCallback(() => {
    'worklet';
    isNativeGestureVisualActive.value = false;
    nativeGestureVisualTouchSessionId.value = 0;
  }, [isNativeGestureVisualActive, nativeGestureVisualTouchSessionId]);

  const acceptNativePageSelection = useCallback(
    (position: number, requestId: number, notifySelection: boolean) => {
      'worklet';
      const transitionEpoch = pageTransitionEpoch.value;
      const sessionId = previewGestureSessionId.value;
      const changed = position !== settledPagePosition.value;
      const wasPreviewGestureActive = isPreviewGestureActive.value;
      isPreviewGestureActive.value = false;
      settledPagePosition.value = position;
      previewPagePosition.value = position;
      selectedTransitionEpoch.value = transitionEpoch;
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
        isIndicatorScrollActive.value &&
        idleTransitionEpoch.value !== transitionEpoch;
      const shouldFinalizeAtSelection =
        !shouldAwaitIosGestureFinalScroll &&
        (!authorizeNativePageGestures ||
          !isIndicatorScrollActive.value ||
          idleTransitionEpoch.value === transitionEpoch);
      if (shouldFinalizeAtSelection) {
        isIndicatorScrollActive.value = false;
        closeNativeGestureVisual();
        visualSettledPagePosition.value = position;
        snapPerpsProTabIndicator(indicatorPosition, position);
      } else if (shouldAwaitIosGestureFinalScroll) {
        visualSettledPagePosition.value = position;
      }
      runOnJS(commitNativePageSelection)(
        position,
        transitionEpoch,
        sessionId,
        changed,
        notifySelection,
        requestId,
      );
    },
    [
      authorizeNativePageGestures,
      closeNativeGestureVisual,
      commitNativePageSelection,
      idleTransitionEpoch,
      indicatorPosition,
      isIndicatorScrollActive,
      isPreviewGestureActive,
      pageTransitionEpoch,
      previewGestureSessionId,
      previewPagePosition,
      scrollBridge,
      selectedTransitionEpoch,
      settledPagePosition,
      visualSettledPagePosition,
    ],
  );

  const startProgrammaticPage = useCallback(
    (request: PerpsProInfoPageRequest) => {
      'worklet';
      const currentPosition = nativeSelectedPosition.value;
      const wasIndicatorScrollActive = isIndicatorScrollActive.value;
      const wasUnselectedGesture =
        isNativeGestureVisualActive.value &&
        selectedTransitionEpoch.value !== pageTransitionEpoch.value;
      isPreviewGestureActive.value = false;
      closeNativeGestureVisual();
      runOnJS(finishPreviewSession)(previewGestureSessionId.value, true);

      // Both native pagers can omit selected for the page they already know.
      // Adopt that acknowledgement instead of installing a command that can
      // never finish. A partial manual drag still needs an explicit return.
      if (request.position === currentPosition) {
        // UIKit can ignore even a non-animated return to its current
        // controller while a manual transition is completing. Release input
        // now, retaining the requested return only to correct a late selection.
        pendingPageRequest.value = wasUnselectedGesture ? request : null;
        programmaticSelectionTargetPosition.value = -1;
        if (wasUnselectedGesture) {
          isIndicatorScrollActive.value = false;
        }
        acceptNativePageSelection(
          request.position,
          request.id,
          request.notifySelection,
        );
        if (wasUnselectedGesture) {
          dispatchCommand(pagerRef, 'setPageWithoutAnimation', [
            request.position,
          ]);
        }
        return;
      }

      pageTransitionEpoch.value += 1;
      selectedTransitionEpoch.value = -1;
      idleTransitionEpoch.value = -1;
      programmaticSelectionTargetPosition.value = request.position;
      visualSettledPagePosition.value = settledPagePosition.value;
      const trackProgress =
        request.animated && Math.abs(request.position - currentPosition) === 1;
      isIndicatorScrollActive.value = trackProgress;
      if (scrollBridge) {
        scrollBridge.epoch.value += 1;
        scrollBridge.pageGestureActive.value = true;
        scrollBridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
        scrollBridge.horizontalTouchSessionId.value = 0;
      }
      if (!trackProgress) {
        snapPerpsProTabIndicator(indicatorPosition, request.position);
      } else if (!wasIndicatorScrollActive) {
        snapPerpsProTabIndicator(indicatorPosition, currentPosition);
      }
      // Install the owner on UI before dispatch. On Paper dispatchCommand
      // still queues a native command, so keep this issued target until its
      // acknowledgement rather than overwriting it on the next press.
      dispatchCommand(
        pagerRef,
        trackProgress ? 'setPage' : 'setPageWithoutAnimation',
        [request.position],
      );
    },
    [
      acceptNativePageSelection,
      closeNativeGestureVisual,
      finishPreviewSession,
      idleTransitionEpoch,
      indicatorPosition,
      isIndicatorScrollActive,
      isNativeGestureVisualActive,
      isPreviewGestureActive,
      nativeSelectedPosition,
      pageTransitionEpoch,
      pagerRef,
      pendingPageRequest,
      previewGestureSessionId,
      programmaticSelectionTargetPosition,
      scrollBridge,
      selectedTransitionEpoch,
      settledPagePosition,
      visualSettledPagePosition,
    ],
  );

  const requestProgrammaticPage = useCallback(
    (request: PerpsProInfoPageRequest) => {
      'worklet';
      if (request.id < latestRequestId.value) {
        return;
      }
      latestRequestId.value = request.id;
      pendingPageRequest.value = request;
      if (programmaticSelectionTargetPosition.value < 0) {
        startProgrammaticPage(request);
      }
    },
    [
      latestRequestId,
      pendingPageRequest,
      programmaticSelectionTargetPosition,
      startProgrammaticPage,
    ],
  );

  const setPage = useCallback(
    (
      tab: PerpsProInfoTab,
      animated: boolean,
      notifySelection: boolean,
      requestId?: number,
    ) => {
      const position = PERPS_PRO_INFO_TABS.indexOf(tab);
      if (position < 0 || !mountedRef.current) {
        return;
      }
      const id = requestId ?? latestRequestIdRef.current + 1;
      if (id < latestRequestIdRef.current) {
        return;
      }
      latestRequestIdRef.current = id;
      preparePages();
      runOnUI(requestProgrammaticPage)({
        animated,
        id,
        notifySelection,
        position,
      });
    },
    [preparePages, requestProgrammaticPage],
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
      returnToPage: (tab, id) => setPage(tab, true, false, id),
      scrollActiveToOffset,
      setPage: (tab, id) => setPage(tab, true, true, id),
      setPageWithoutAnimation: (tab, id) => setPage(tab, false, true, id),
      syncPageWithoutAnimation: (tab, id) => setPage(tab, false, false, id),
    }),
    [scrollActiveToOffset, setPage],
  );

  const handlePageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    event => {
      'worklet';
      const position = event.position;
      if (position < 0 || position >= PERPS_PRO_INFO_TABS.length) {
        return;
      }
      nativeSelectedPosition.value = position;
      const issuedTarget = programmaticSelectionTargetPosition.value;
      if (issuedTarget >= 0) {
        if (position !== issuedTarget) {
          // A stale/native gesture acknowledgement must not move the business
          // page or the Scene's vertical offset owner.
          return;
        }
        programmaticSelectionTargetPosition.value = -1;
        const request = pendingPageRequest.value;
        if (request && request.position !== position) {
          startProgrammaticPage(request);
          return;
        }
        pendingPageRequest.value = null;
        acceptNativePageSelection(
          position,
          request?.id ?? latestRequestId.value,
          request?.notifySelection ?? false,
        );
        return;
      }

      const pendingReturn = pendingPageRequest.value;
      if (pendingReturn) {
        if (position !== pendingReturn.position) {
          startProgrammaticPage(pendingReturn);
        } else {
          pendingPageRequest.value = null;
        }
        return;
      }

      const authorized =
        position === settledPagePosition.value ||
        !authorizeNativePageGestures ||
        isPerpsProInfoHorizontalTouchAuthorized(
          scrollBridge,
          nativeGestureVisualTouchSessionId.value,
        );
      if (!authorized) {
        isPreviewGestureActive.value = false;
        isIndicatorScrollActive.value = false;
        closeNativeGestureVisual();
        previewPagePosition.value = settledPagePosition.value;
        visualSettledPagePosition.value = settledPagePosition.value;
        snapPerpsProTabIndicator(indicatorPosition, settledPagePosition.value);
        const correction: PerpsProInfoPageRequest = {
          animated: false,
          id: latestRequestId.value,
          notifySelection: false,
          position: settledPagePosition.value,
        };
        pendingPageRequest.value = correction;
        startProgrammaticPage(correction);
        return;
      }
      acceptNativePageSelection(position, latestRequestId.value, true);
    },
    ['onPageSelected'],
    true,
  );

  const beginPageDrag = useCallback(
    (sessionId: number, requestId: number) => {
      if (
        !mountedRef.current ||
        requestId !== latestRequestIdRef.current ||
        !isPreviewGestureActive.value ||
        previewGestureSessionId.value !== sessionId
      ) {
        return;
      }
      beginPreviewSession(sessionId);
      preparePages();
      onPageDragStart(requestId);
    },
    [
      beginPreviewSession,
      isPreviewGestureActive,
      onPageDragStart,
      preparePages,
      previewGestureSessionId,
    ],
  );

  const beginNativeGestureVisualTracking = (touchSessionId: number) => {
    'worklet';
    pageTransitionEpoch.value += 1;
    selectedTransitionEpoch.value = -1;
    idleTransitionEpoch.value = -1;
    isPreviewGestureActive.value = false;
    isIndicatorScrollActive.value = true;
    isNativeGestureVisualActive.value = true;
    nativeGestureVisualTouchSessionId.value = touchSessionId;
    previewPagePosition.value = settledPagePosition.value;
    visualSettledPagePosition.value = settledPagePosition.value;
  };

  const beginAuthorizedPageGesture = () => {
    'worklet';
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
    runOnJS(beginPageDrag)(sessionId, latestRequestId.value);
  };

  const handlePageScrollStateChanged =
    useEvent<PageScrollStateChangedNativeEvent>(
      event => {
        'worklet';
        if (event.pageScrollState === 'dragging') {
          if (programmaticSelectionTargetPosition.value >= 0) {
            return;
          }
          const touchSessionId = authorizeNativePageGestures
            ? scrollBridge?.touchSessionId.value ?? 0
            : 0;
          if (authorizeNativePageGestures && touchSessionId <= 0) {
            return;
          }
          if (
            isPreviewGestureActive.value &&
            nativeGestureVisualTouchSessionId.value === touchSessionId
          ) {
            return;
          }
          pendingPageRequest.value = null;
          beginNativeGestureVisualTracking(touchSessionId);
          if (
            authorizeNativePageGestures &&
            !isPerpsProInfoHorizontalTouchAuthorized(
              scrollBridge,
              touchSessionId,
            )
          ) {
            return;
          }
          beginAuthorizedPageGesture();
          return;
        }
        if (event.pageScrollState === 'idle') {
          const transitionEpoch = pageTransitionEpoch.value;
          idleTransitionEpoch.value = transitionEpoch;
          const selectionSeen =
            selectedTransitionEpoch.value === transitionEpoch;
          const returnedToSettledPage =
            previewPagePosition.value === settledPagePosition.value;
          if (
            !isIndicatorScrollActive.value ||
            programmaticSelectionTargetPosition.value >= 0 ||
            (!selectionSeen && !returnedToSettledPage)
          ) {
            return;
          }
          isIndicatorScrollActive.value = false;
          closeNativeGestureVisual();
          snapPerpsProTabIndicator(
            indicatorPosition,
            settledPagePosition.value,
          );
          visualSettledPagePosition.value = settledPagePosition.value;
          const shouldFinishPreviewSession = isPreviewGestureActive.value;
          isPreviewGestureActive.value = false;
          if (scrollBridge) {
            scrollBridge.pageGestureActive.value = false;
          }
          if (shouldFinishPreviewSession) {
            runOnJS(finishPreviewSession)(
              previewGestureSessionId.value,
              returnedToSettledPage,
            );
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
      const currentTransitionSelected =
        selectedTransitionEpoch.value === pageTransitionEpoch.value;

      // Pending progress is visual-only, but vertical/cancelled/replaced touch
      // sessions are not owners. Validate before any indicator or preview write.
      if (
        authorizeNativePageGestures &&
        isNativeGestureVisualActive.value &&
        !currentTransitionSelected &&
        scrollBridge
      ) {
        const intent = scrollBridge.touchIntent.value;
        const validOwner =
          nativeGestureVisualTouchSessionId.value > 0 &&
          nativeGestureVisualTouchSessionId.value ===
            scrollBridge.touchSessionId.value &&
          (intent === PERPS_PRO_INFO_TOUCH_INTENT.pending ||
            isPerpsProInfoHorizontalTouchAuthorized(
              scrollBridge,
              nativeGestureVisualTouchSessionId.value,
            ));
        if (!validOwner) {
          isPreviewGestureActive.value = false;
          isIndicatorScrollActive.value = false;
          closeNativeGestureVisual();
          previewPagePosition.value = settledPagePosition.value;
          visualSettledPagePosition.value = settledPagePosition.value;
          scrollBridge.pageGestureActive.value = false;
          snapPerpsProTabIndicator(
            indicatorPosition,
            settledPagePosition.value,
          );
          runOnJS(finishPreviewSession)(previewGestureSessionId.value, true);
          return;
        }
      }

      if (!isPreviewGestureActive.value) {
        if (
          isIndicatorScrollActive.value &&
          (programmaticSelectionTargetPosition.value >= 0 ||
            currentTransitionSelected)
        ) {
          indicatorPosition.value = pagePosition;
          previewPagePosition.value = getPerpsProInfoPagerPreviewPosition({
            maximumPosition: PERPS_PRO_INFO_TABS.length - 1,
            pagePosition,
            previewPosition: previewPagePosition.value,
            settledPosition: visualSettledPagePosition.value,
          });
          if (
            !authorizeNativePageGestures &&
            currentTransitionSelected &&
            Math.abs(pagePosition - settledPagePosition.value) < 0.001
          ) {
            isIndicatorScrollActive.value = false;
            closeNativeGestureVisual();
            visualSettledPagePosition.value = settledPagePosition.value;
            snapPerpsProTabIndicator(
              indicatorPosition,
              settledPagePosition.value,
            );
          }
          return;
        }
        if (!isNativeGestureVisualActive.value) {
          return;
        }
        indicatorPosition.value = pagePosition;
        if (
          authorizeNativePageGestures &&
          !isPerpsProInfoHorizontalTouchAuthorized(
            scrollBridge,
            nativeGestureVisualTouchSessionId.value,
          )
        ) {
          return;
        }
        beginAuthorizedPageGesture();
      }
      indicatorPosition.value = pagePosition;
      const nextPosition = getPerpsProInfoPagerPreviewPosition({
        maximumPosition: PERPS_PRO_INFO_TABS.length - 1,
        pagePosition,
        previewPosition: previewPagePosition.value,
        settledPosition: visualSettledPagePosition.value,
      });
      if (nextPosition !== previewPagePosition.value) {
        previewPagePosition.value = nextPosition;
        runOnJS(publishPreview)(previewGestureSessionId.value, nextPosition);
      }
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
