import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import PagerView, {
  type PageScrollStateChangedNativeEvent,
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import Animated, { useEvent, useSharedValue } from 'react-native-reanimated';

import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import { useHideTipsPopup } from '@/hooks/useTipsPopup';
import { snapPerpsProTabIndicator } from '@/screens/PerpsPro/components/common/PerpsProTabIndicator';
import { PERPS_PRO_HISTORY_FEE_TIPS_OWNER } from '../constants';
import {
  PERPS_PRO_HISTORY_TABS,
  type PerpsProHistoryControllerState,
} from '../scene/perpsProHistoryControllerState';
import type { PerpsProHistoryTab } from '../types';
import { PerpsProHistoryList } from './PerpsProHistoryList';
import { PerpsProHistoryTabs } from './PerpsProHistoryTabs';

const PAGE_POSITION_EPSILON = 0.001;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

type NativePageSession =
  | {
      animated: boolean;
      issued: boolean;
      kind: 'programmatic';
      selected: number | null;
      target: number;
    }
  | {
      idleSeen: boolean;
      kind: 'gesture';
      origin: number;
      preserveOriginOffset: boolean;
      selected: number | null;
    };

export const getPreparedPerpsProHistoryTabs = (
  activeTab: PerpsProHistoryTab,
  requestedTab: PerpsProHistoryTab | null,
  nativeInFlightTab: PerpsProHistoryTab | null = null,
) => {
  if (requestedTab || nativeInFlightTab) {
    return new Set<PerpsProHistoryTab>(
      [activeTab, nativeInFlightTab, requestedTab].filter(
        (tab): tab is PerpsProHistoryTab => tab != null,
      ),
    );
  }

  const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
  const result = new Set<PerpsProHistoryTab>();
  for (
    let index = Math.max(0, activeIndex - 1);
    index <= Math.min(PERPS_PRO_HISTORY_TABS.length - 1, activeIndex + 1);
    index += 1
  ) {
    const tab = PERPS_PRO_HISTORY_TABS[index];
    if (tab) {
      result.add(tab);
    }
  }
  return result;
};

export const PerpsProHistoryPager: React.FC<{
  active?: boolean;
  activeTab: PerpsProHistoryTab;
  amountUnit: PerpsProTradeAmountUnit;
  onChange: (tab: PerpsProHistoryTab) => void;
  onLoadEarlier: (tab: PerpsProHistoryTab) => void;
  onRefresh: (tab: PerpsProHistoryTab) => void;
  scrollHost?: 'bottomSheet' | 'screen';
  state: PerpsProHistoryControllerState;
}> = ({
  active = true,
  activeTab,
  amountUnit,
  onChange,
  onLoadEarlier,
  onRefresh,
  scrollHost = 'screen',
  state,
}) => {
  const initialIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
  const pagerRef = useRef<PagerView>(null);
  const activeRef = useRef(active);
  const activeTabRef = useRef(activeTab);
  const previousActiveRef = useRef(active);
  const observedIndexRef = useRef(initialIndex);
  const latestDesiredIndexRef = useRef<number | null>(null);
  const nativeSessionRef = useRef<NativePageSession | null>(null);
  const scheduledPageFrameRef = useRef<number | null>(null);
  const awaitingCommittedTabRef = useRef<PerpsProHistoryTab | null>(null);
  const hideFeeTipsPopup = useHideTipsPopup(PERPS_PRO_HISTORY_FEE_TIPS_OWNER);
  const [requestedTab, setRequestedTab] = useState<PerpsProHistoryTab | null>(
    null,
  );
  const [nativeInFlightTab, setNativeInFlightTab] =
    useState<PerpsProHistoryTab | null>(null);

  const activeState = useSharedValue(active);
  const settledPagePosition = useSharedValue(initialIndex);
  const visualPosition = useSharedValue(initialIndex);
  const pageTransitionEpoch = useSharedValue(0);
  const progressEnabled = useSharedValue(false);
  const gestureProgress = useSharedValue(false);
  const lastAcceptedPagePosition = useSharedValue(initialIndex);
  const transitionStartPosition = useSharedValue(initialIndex);
  const transitionTargetPosition = useSharedValue(initialIndex);
  const transitionActive = useSharedValue(false);
  const transitionAnimated = useSharedValue(false);

  activeRef.current = active;
  activeTabRef.current = activeTab;

  const preparedTabs = useMemo(
    () =>
      getPreparedPerpsProHistoryTabs(
        activeTab,
        requestedTab,
        nativeInFlightTab,
      ),
    [activeTab, nativeInFlightTab, requestedTab],
  );

  const cancelScheduledPage = useCallback(() => {
    if (scheduledPageFrameRef.current === null) {
      return false;
    }
    cancelAnimationFrame(scheduledPageFrameRef.current);
    scheduledPageFrameRef.current = null;
    return true;
  }, []);

  const setLatestDesiredIndex = useCallback((position: number | null) => {
    latestDesiredIndexRef.current = position;
  }, []);

  const setPreparedRequestedIndex = useCallback((position: number | null) => {
    setRequestedTab(
      position === null ? null : PERPS_PRO_HISTORY_TABS[position] ?? null,
    );
  }, []);

  const setNativePreparedIndex = useCallback((position: number | null) => {
    setNativeInFlightTab(
      position === null ? null : PERPS_PRO_HISTORY_TABS[position] ?? null,
    );
  }, []);

  const configureSettledPresentation = useCallback(
    (position: number, animated = false) => {
      progressEnabled.value = false;
      gestureProgress.value = false;
      settledPagePosition.value = position;
      lastAcceptedPagePosition.value = position;
      transitionStartPosition.value = position;
      transitionTargetPosition.value = position;
      transitionActive.value = false;
      transitionAnimated.value = animated;
      snapPerpsProTabIndicator(visualPosition, position);
    },
    [
      gestureProgress,
      lastAcceptedPagePosition,
      progressEnabled,
      settledPagePosition,
      transitionActive,
      transitionAnimated,
      transitionStartPosition,
      transitionTargetPosition,
      visualPosition,
    ],
  );

  const commitBusinessPosition = useCallback(
    (position: number) => {
      const tab = PERPS_PRO_HISTORY_TABS[position];
      if (!tab) {
        return;
      }
      if (tab === activeTabRef.current) {
        if (awaitingCommittedTabRef.current === tab) {
          awaitingCommittedTabRef.current = null;
        }
        if (!nativeSessionRef.current) {
          setNativePreparedIndex(null);
        }
        return;
      }
      if (awaitingCommittedTabRef.current === tab) {
        return;
      }
      awaitingCommittedTabRef.current = tab;
      if (!nativeSessionRef.current) {
        setNativePreparedIndex(position);
      }
      hideFeeTipsPopup();
      onChange(tab);
    },
    [hideFeeTipsPopup, onChange, setNativePreparedIndex],
  );

  const startProgrammaticTransition = useCallback(
    (target: number, origin: number) => {
      cancelScheduledPage();
      const epoch = pageTransitionEpoch.value + 1;
      const animated = Math.abs(target - origin) === 1;
      const session: NativePageSession = {
        animated,
        issued: false,
        kind: 'programmatic',
        selected: null,
        target,
      };
      nativeSessionRef.current = session;
      const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTabRef.current);
      setNativePreparedIndex(origin !== activeIndex ? origin : target);
      setPreparedRequestedIndex(target);

      pageTransitionEpoch.value = epoch;
      progressEnabled.value = animated;
      gestureProgress.value = false;
      settledPagePosition.value = origin;
      lastAcceptedPagePosition.value = visualPosition.value;
      transitionStartPosition.value = origin;
      transitionTargetPosition.value = target;
      transitionActive.value = animated;
      transitionAnimated.value = animated;

      let completedSynchronously = false;
      const frame = requestAnimationFrame(() => {
        completedSynchronously = true;
        scheduledPageFrameRef.current = null;
        if (
          !activeRef.current ||
          nativeSessionRef.current !== session ||
          latestDesiredIndexRef.current !== target
        ) {
          return;
        }
        session.issued = true;
        if (animated) {
          pagerRef.current?.setPage(target);
          return;
        }
        configureSettledPresentation(target);
        pagerRef.current?.setPageWithoutAnimation(target);
      });
      if (!completedSynchronously) {
        scheduledPageFrameRef.current = frame;
      }
    },
    [
      cancelScheduledPage,
      configureSettledPresentation,
      gestureProgress,
      lastAcceptedPagePosition,
      pageTransitionEpoch,
      progressEnabled,
      setNativePreparedIndex,
      setPreparedRequestedIndex,
      settledPagePosition,
      transitionActive,
      transitionAnimated,
      transitionStartPosition,
      transitionTargetPosition,
      visualPosition,
    ],
  );

  const finishNativeSession = useCallback(
    (position: number) => {
      const session = nativeSessionRef.current;
      if (!session) {
        return;
      }
      cancelScheduledPage();
      nativeSessionRef.current = null;
      observedIndexRef.current = position;
      const preserveGestureOriginOffset =
        session.kind === 'gesture' &&
        session.preserveOriginOffset &&
        position === session.origin;
      configureSettledPresentation(position, preserveGestureOriginOffset);

      const desired = latestDesiredIndexRef.current;
      if (desired !== null && desired !== position) {
        startProgrammaticTransition(desired, position);
        return;
      }
      setNativePreparedIndex(position);
      setLatestDesiredIndex(null);
      setPreparedRequestedIndex(null);
      commitBusinessPosition(position);
    },
    [
      cancelScheduledPage,
      commitBusinessPosition,
      configureSettledPresentation,
      setLatestDesiredIndex,
      setNativePreparedIndex,
      setPreparedRequestedIndex,
      startProgrammaticTransition,
    ],
  );

  const beginGestureSession = useCallback(() => {
    const previousSession = nativeSessionRef.current;
    if (previousSession?.kind === 'gesture') {
      return;
    }
    cancelScheduledPage();
    nativeSessionRef.current = null;
    setLatestDesiredIndex(null);
    setPreparedRequestedIndex(null);

    const origin =
      previousSession?.kind === 'programmatic' &&
      previousSession.selected !== null
        ? previousSession.selected
        : observedIndexRef.current;
    const alreadyTrackingGesture =
      progressEnabled.value && gestureProgress.value;
    const epoch = alreadyTrackingGesture
      ? pageTransitionEpoch.value
      : pageTransitionEpoch.value + 1;
    nativeSessionRef.current = {
      idleSeen: false,
      kind: 'gesture',
      origin,
      preserveOriginOffset: previousSession?.kind !== 'programmatic',
      selected: null,
    };
    pageTransitionEpoch.value = epoch;
    transitionActive.value = true;
    transitionAnimated.value = true;
    progressEnabled.value = true;
    gestureProgress.value = true;
    settledPagePosition.value = origin;

    if (!alreadyTrackingGesture) {
      const currentPosition = visualPosition.value;
      const hasCurrentProgress =
        Math.abs(currentPosition - origin) > PAGE_POSITION_EPSILON;
      lastAcceptedPagePosition.value = currentPosition;
      transitionStartPosition.value = origin;
      transitionTargetPosition.value = hasCurrentProgress
        ? currentPosition > origin
          ? Math.min(
              PERPS_PRO_HISTORY_TABS.length - 1,
              Math.ceil(currentPosition),
            )
          : Math.max(0, Math.floor(currentPosition))
        : origin;
    }

    const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTabRef.current);
    const candidate = Math.round(transitionTargetPosition.value);
    setNativePreparedIndex(
      candidate !== activeIndex
        ? candidate
        : origin !== activeIndex
        ? origin
        : null,
    );
    hideFeeTipsPopup();
  }, [
    cancelScheduledPage,
    gestureProgress,
    hideFeeTipsPopup,
    lastAcceptedPagePosition,
    pageTransitionEpoch,
    progressEnabled,
    setLatestDesiredIndex,
    setNativePreparedIndex,
    setPreparedRequestedIndex,
    settledPagePosition,
    transitionActive,
    transitionAnimated,
    transitionStartPosition,
    transitionTargetPosition,
    visualPosition,
  ]);

  const adoptTrackedGesture = useCallback(() => {
    const current = nativeSessionRef.current;
    if (current) {
      return current;
    }
    if (!progressEnabled.value || !gestureProgress.value) {
      return null;
    }
    const session: NativePageSession = {
      idleSeen: false,
      kind: 'gesture',
      origin: observedIndexRef.current,
      preserveOriginOffset: true,
      selected: null,
    };
    nativeSessionRef.current = session;
    return session;
  }, [gestureProgress, progressEnabled]);

  const selectTab = useCallback(
    (tab: PerpsProHistoryTab) => {
      if (!activeRef.current) {
        return;
      }
      const target = PERPS_PRO_HISTORY_TABS.indexOf(tab);
      if (target < 0 || latestDesiredIndexRef.current === target) {
        return;
      }
      hideFeeTipsPopup();

      const session = nativeSessionRef.current ?? adoptTrackedGesture();
      if (session?.kind === 'programmatic' && !session.issued) {
        cancelScheduledPage();
        nativeSessionRef.current = null;
      } else if (session) {
        setLatestDesiredIndex(target);
        if (session.kind === 'gesture') {
          const candidate =
            session.selected ?? Math.round(transitionTargetPosition.value);
          const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(
            activeTabRef.current,
          );
          setNativePreparedIndex(
            candidate !== activeIndex
              ? candidate
              : session.origin !== activeIndex
              ? session.origin
              : null,
          );
        }
        return;
      }

      if (target === observedIndexRef.current) {
        setLatestDesiredIndex(null);
        setPreparedRequestedIndex(null);
        configureSettledPresentation(target);
        commitBusinessPosition(target);
        return;
      }
      setLatestDesiredIndex(target);
      startProgrammaticTransition(target, observedIndexRef.current);
    },
    [
      adoptTrackedGesture,
      cancelScheduledPage,
      commitBusinessPosition,
      configureSettledPresentation,
      hideFeeTipsPopup,
      setLatestDesiredIndex,
      setNativePreparedIndex,
      setPreparedRequestedIndex,
      startProgrammaticTransition,
      transitionTargetPosition,
    ],
  );

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      if (!activeRef.current) {
        return;
      }
      const position = event.nativeEvent.position;
      if (position < 0 || position >= PERPS_PRO_HISTORY_TABS.length) {
        return;
      }

      const session = nativeSessionRef.current ?? adoptTrackedGesture();
      if (!session) {
        if (position === observedIndexRef.current) {
          return;
        }
        observedIndexRef.current = position;
        configureSettledPresentation(position);
        commitBusinessPosition(position);
        return;
      }

      if (session.kind === 'programmatic') {
        if (position !== session.target) {
          return;
        }
        if (session.animated && Platform.OS === 'android') {
          // ViewPager2 reports the selected target before its smooth scroll
          // frames and IDLE state. Keep the fractional presentation alive and
          // serialize any follow-up until the physical motion is terminal.
          session.selected = position;
          return;
        }
        finishNativeSession(position);
        return;
      }

      if (session.selected === position) {
        return;
      }
      const transitionCandidate = Math.round(transitionTargetPosition.value);
      session.selected = position;
      observedIndexRef.current = position;
      settledPagePosition.value = position;
      transitionTargetPosition.value = position;
      gestureProgress.value = false;
      const companionPosition =
        position !== session.origin
          ? session.origin
          : transitionCandidate !== position
          ? transitionCandidate
          : null;
      setPreparedRequestedIndex(position);
      setNativePreparedIndex(
        companionPosition !== null &&
          companionPosition >= 0 &&
          companionPosition < PERPS_PRO_HISTORY_TABS.length
          ? companionPosition
          : null,
      );

      const desired = latestDesiredIndexRef.current;
      if (desired === null || desired === position) {
        commitBusinessPosition(position);
      }
      if (session.idleSeen) {
        finishNativeSession(position);
      }
    },
    [
      adoptTrackedGesture,
      commitBusinessPosition,
      configureSettledPresentation,
      finishNativeSession,
      gestureProgress,
      setNativePreparedIndex,
      setPreparedRequestedIndex,
      settledPagePosition,
      transitionTargetPosition,
    ],
  );

  const handlePageScrollStateChanged = useCallback(
    (event: PageScrollStateChangedNativeEvent) => {
      if (!activeRef.current) {
        return;
      }
      if (event.nativeEvent.pageScrollState === 'dragging') {
        beginGestureSession();
        return;
      }
      if (event.nativeEvent.pageScrollState !== 'idle') {
        return;
      }

      const session = nativeSessionRef.current ?? adoptTrackedGesture();
      if (!session) {
        return;
      }
      if (session.kind === 'programmatic') {
        if (session.selected !== null) {
          finishNativeSession(session.selected);
        }
        return;
      }
      session.idleSeen = true;
      if (session.selected !== null) {
        finishNativeSession(session.selected);
        return;
      }
      if (
        Math.abs(lastAcceptedPagePosition.value - session.origin) <=
        PAGE_POSITION_EPSILON
      ) {
        finishNativeSession(session.origin);
      }
    },
    [
      adoptTrackedGesture,
      beginGestureSession,
      finishNativeSession,
      lastAcceptedPagePosition,
    ],
  );

  const handlePageScroll = useEvent<PagerViewOnPageScrollEvent>(
    event => {
      'worklet';
      if (!activeState.value) {
        return;
      }
      const pagePosition = Math.max(
        0,
        Math.min(
          PERPS_PRO_HISTORY_TABS.length - 1,
          event.position + event.offset,
        ),
      );
      if (!progressEnabled.value) {
        if (
          Math.abs(pagePosition - settledPagePosition.value) <=
          PAGE_POSITION_EPSILON
        ) {
          return;
        }
        const epoch = pageTransitionEpoch.value + 1;
        pageTransitionEpoch.value = epoch;
        progressEnabled.value = true;
        gestureProgress.value = true;
        transitionActive.value = true;
        transitionAnimated.value = true;
        transitionStartPosition.value = settledPagePosition.value;
        transitionTargetPosition.value = settledPagePosition.value;
        lastAcceptedPagePosition.value = settledPagePosition.value;
      }
      if (gestureProgress.value) {
        const settledPosition = settledPagePosition.value;
        transitionTargetPosition.value =
          pagePosition > settledPosition + PAGE_POSITION_EPSILON
            ? Math.min(
                PERPS_PRO_HISTORY_TABS.length - 1,
                Math.ceil(pagePosition),
              )
            : pagePosition < settledPosition - PAGE_POSITION_EPSILON
            ? Math.max(0, Math.floor(pagePosition))
            : settledPosition;
      }
      const minimumPosition = Math.min(
        transitionStartPosition.value,
        transitionTargetPosition.value,
      );
      const maximumPosition = Math.max(
        transitionStartPosition.value,
        transitionTargetPosition.value,
      );
      if (
        pagePosition < minimumPosition - PAGE_POSITION_EPSILON ||
        pagePosition > maximumPosition + PAGE_POSITION_EPSILON
      ) {
        return;
      }
      lastAcceptedPagePosition.value = pagePosition;
      visualPosition.value = pagePosition;
    },
    ['onPageScroll'],
    true,
  );

  useEffect(() => {
    activeState.value = active;
    if (!active) {
      previousActiveRef.current = false;
      cancelScheduledPage();
      nativeSessionRef.current = null;
      awaitingCommittedTabRef.current = null;
      setLatestDesiredIndex(null);
      setPreparedRequestedIndex(null);
      setNativePreparedIndex(null);
      const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
      observedIndexRef.current = activeIndex;
      configureSettledPresentation(activeIndex);
      return;
    }
    if (!previousActiveRef.current) {
      const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
      observedIndexRef.current = activeIndex;
      configureSettledPresentation(activeIndex);
      pagerRef.current?.setPageWithoutAnimation(activeIndex);
    }
    previousActiveRef.current = true;
  }, [
    active,
    activeState,
    activeTab,
    cancelScheduledPage,
    configureSettledPresentation,
    setLatestDesiredIndex,
    setNativePreparedIndex,
    setPreparedRequestedIndex,
  ]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
    const awaitingTab = awaitingCommittedTabRef.current;
    if (awaitingTab) {
      if (awaitingTab === activeTab) {
        awaitingCommittedTabRef.current = null;
        if (!nativeSessionRef.current) {
          setNativePreparedIndex(null);
        }
      }
      return;
    }
    if (nativeSessionRef.current || latestDesiredIndexRef.current !== null) {
      return;
    }
    if (observedIndexRef.current === activeIndex) {
      setNativePreparedIndex(null);
      return;
    }
    cancelScheduledPage();
    observedIndexRef.current = activeIndex;
    configureSettledPresentation(activeIndex);
    pagerRef.current?.setPageWithoutAnimation(activeIndex);
  }, [
    active,
    activeTab,
    cancelScheduledPage,
    configureSettledPresentation,
    setNativePreparedIndex,
  ]);

  useEffect(
    () => () => {
      cancelScheduledPage();
      nativeSessionRef.current = null;
      pageTransitionEpoch.value += 1;
    },
    [cancelScheduledPage, pageTransitionEpoch],
  );

  return (
    <View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'auto' : 'none'}
      style={styles.container}>
      <PerpsProHistoryTabs
        activeTab={activeTab}
        onChange={selectTab}
        position={visualPosition}
        transitionActive={transitionActive}
        transitionAnimated={transitionAnimated}
        transitionEpoch={pageTransitionEpoch}
        transitionStartPosition={transitionStartPosition}
        transitionTargetPosition={transitionTargetPosition}
      />
      <AnimatedPagerView
        initialPage={initialIndex}
        onPageScroll={handlePageScroll}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
        ref={pagerRef}
        scrollEnabled={active}
        style={styles.pager}
        testID="perps-pro-history-pager">
        {PERPS_PRO_HISTORY_TABS.map(tab => (
          <View
            accessibilityElementsHidden={tab !== activeTab || !active}
            collapsable={false}
            importantForAccessibility={
              tab === activeTab && active ? 'auto' : 'no-hide-descendants'
            }
            key={tab}
            pointerEvents={tab === activeTab && active ? 'auto' : 'none'}
            style={styles.page}
            testID={`perps-pro-history-page-${tab}`}>
            {preparedTabs.has(tab) ? (
              <PerpsProHistoryList
                active={tab === activeTab && active}
                amountUnit={amountUnit}
                onLoadEarlier={() => onLoadEarlier(tab)}
                onRefresh={() => onRefresh(tab)}
                onRetry={() => onRefresh(tab)}
                scrollHost={scrollHost}
                state={state[tab]}
                tab={tab}
              />
            ) : null}
          </View>
        ))}
      </AnimatedPagerView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pager: {
    flex: 1,
    marginTop: 12,
  },
});
