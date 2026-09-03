import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import PagerView, {
  type PageScrollStateChangedNativeEvent,
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';
import Animated, {
  runOnJS,
  useEvent,
  useSharedValue,
} from 'react-native-reanimated';

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
const HISTORY_PAGER_TRANSITION_IDLE = 0;
const HISTORY_PAGER_TRANSITION_GESTURE = 1;
const HISTORY_PAGER_TRANSITION_PROGRAMMATIC = 2;
const HISTORY_PAGER_TRANSITION_DIRECT = 3;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

type DesiredPage = Readonly<{
  epoch: number;
  position: number;
}>;

const PerpsProHistoryPagerPage: React.FC<{
  active: boolean;
  amountUnit: PerpsProTradeAmountUnit;
  onLoadEarlier: (tab: PerpsProHistoryTab) => void;
  onRefresh: (tab: PerpsProHistoryTab) => void;
  scrollHost: 'bottomSheet' | 'screen';
  state: PerpsProHistoryControllerState[PerpsProHistoryTab];
  tab: PerpsProHistoryTab;
}> = React.memo(
  ({
    active,
    amountUnit,
    onLoadEarlier,
    onRefresh,
    scrollHost,
    state,
    tab,
  }) => {
    const handleLoadEarlier = useCallback(
      () => onLoadEarlier(tab),
      [onLoadEarlier, tab],
    );
    const handleRefresh = useCallback(() => onRefresh(tab), [onRefresh, tab]);

    return (
      <PerpsProHistoryList
        active={active}
        amountUnit={amountUnit}
        onLoadEarlier={handleLoadEarlier}
        onRefresh={handleRefresh}
        onRetry={handleRefresh}
        scrollHost={scrollHost}
        state={state}
        tab={tab}
      />
    );
  },
);

PerpsProHistoryPagerPage.displayName = 'PerpsProHistoryPagerPage';

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
  const waitForProgrammaticIdle = Platform.OS === 'android';
  const pagerRef = useRef<PagerView>(null);
  const activeRef = useRef(active);
  const activeTabRef = useRef(activeTab);
  const previousActiveRef = useRef(active);
  const observedIndexRef = useRef(initialIndex);
  const latestDesiredRef = useRef<DesiredPage | null>(null);
  const awaitingCommittedTabRef = useRef<PerpsProHistoryTab | null>(null);
  const lastHandledEpochRef = useRef(-1);
  const mountedRef = useRef(true);
  const hideFeeTipsPopup = useHideTipsPopup(PERPS_PRO_HISTORY_FEE_TIPS_OWNER);

  const activeState = useSharedValue(active);
  const settledPagePosition = useSharedValue(initialIndex);
  const visualPosition = useSharedValue(initialIndex);
  const pageTransitionEpoch = useSharedValue(0);
  const transitionKind = useSharedValue(HISTORY_PAGER_TRANSITION_IDLE);
  const transitionIdleSeen = useSharedValue(false);
  const transitionProgrammaticMotionSeen = useSharedValue(false);
  const transitionProgressSeen = useSharedValue(false);
  const transitionSelectedPosition = useSharedValue(-1);
  const transitionCandidatePosition = useSharedValue(initialIndex);
  const transitionStartPosition = useSharedValue(initialIndex);
  const transitionTargetPosition = useSharedValue(initialIndex);

  activeRef.current = active;
  activeTabRef.current = activeTab;

  const configureSettledPresentation = useCallback(
    (position: number) => {
      settledPagePosition.value = position;
      transitionKind.value = HISTORY_PAGER_TRANSITION_IDLE;
      transitionIdleSeen.value = false;
      transitionProgrammaticMotionSeen.value = false;
      transitionProgressSeen.value = false;
      transitionSelectedPosition.value = -1;
      transitionCandidatePosition.value = position;
      transitionStartPosition.value = position;
      transitionTargetPosition.value = position;
      snapPerpsProTabIndicator(visualPosition, position);
    },
    [
      settledPagePosition,
      transitionCandidatePosition,
      transitionIdleSeen,
      transitionKind,
      transitionProgrammaticMotionSeen,
      transitionProgressSeen,
      transitionSelectedPosition,
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
        return;
      }
      if (awaitingCommittedTabRef.current === tab) {
        return;
      }
      awaitingCommittedTabRef.current = tab;
      hideFeeTipsPopup();
      onChange(tab);
    },
    [hideFeeTipsPopup, onChange],
  );

  const startProgrammaticTransition = useCallback(
    (target: number, origin: number) => {
      if (!activeRef.current) {
        return;
      }
      const epoch = pageTransitionEpoch.value + 1;
      const animated = Math.abs(target - origin) === 1;
      latestDesiredRef.current = { epoch, position: target };
      pageTransitionEpoch.value = epoch;
      settledPagePosition.value = origin;
      transitionKind.value = animated
        ? HISTORY_PAGER_TRANSITION_PROGRAMMATIC
        : HISTORY_PAGER_TRANSITION_DIRECT;
      transitionIdleSeen.value = false;
      transitionProgrammaticMotionSeen.value = false;
      transitionProgressSeen.value = false;
      transitionSelectedPosition.value = -1;
      transitionCandidatePosition.value = target;
      transitionStartPosition.value = origin;
      transitionTargetPosition.value = target;

      if (animated) {
        pagerRef.current?.setPage(target);
        return;
      }
      snapPerpsProTabIndicator(visualPosition, target);
      pagerRef.current?.setPageWithoutAnimation(target);
    },
    [
      pageTransitionEpoch,
      settledPagePosition,
      transitionCandidatePosition,
      transitionIdleSeen,
      transitionKind,
      transitionProgrammaticMotionSeen,
      transitionProgressSeen,
      transitionSelectedPosition,
      transitionStartPosition,
      transitionTargetPosition,
      visualPosition,
    ],
  );

  const handleGestureBegan = useCallback(
    (epoch: number, origin: number) => {
      if (
        !mountedRef.current ||
        pageTransitionEpoch.value !== epoch ||
        transitionKind.value !== HISTORY_PAGER_TRANSITION_GESTURE
      ) {
        return;
      }
      const desired = latestDesiredRef.current;
      if (desired && desired.epoch < epoch) {
        latestDesiredRef.current = null;
      }
      observedIndexRef.current = origin;
      hideFeeTipsPopup();
    },
    [hideFeeTipsPopup, pageTransitionEpoch, transitionKind],
  );

  const handleNativeTerminal = useCallback(
    (epoch: number, position: number) => {
      if (
        !mountedRef.current ||
        !activeRef.current ||
        pageTransitionEpoch.value !== epoch ||
        transitionKind.value !== HISTORY_PAGER_TRANSITION_IDLE ||
        epoch <= lastHandledEpochRef.current
      ) {
        return;
      }
      lastHandledEpochRef.current = epoch;
      observedIndexRef.current = position;

      const desired = latestDesiredRef.current;
      if (desired?.epoch === epoch && desired.position !== position) {
        startProgrammaticTransition(desired.position, position);
        return;
      }
      latestDesiredRef.current = null;
      commitBusinessPosition(position);
    },
    [
      commitBusinessPosition,
      pageTransitionEpoch,
      startProgrammaticTransition,
      transitionKind,
    ],
  );

  const finishTransitionOnUI = useCallback(
    (position: number) => {
      'worklet';
      const epoch = pageTransitionEpoch.value;
      snapPerpsProTabIndicator(visualPosition, position);
      settledPagePosition.value = position;
      transitionCandidatePosition.value = position;
      transitionStartPosition.value = position;
      transitionTargetPosition.value = position;
      transitionIdleSeen.value = false;
      transitionProgrammaticMotionSeen.value = false;
      transitionProgressSeen.value = false;
      transitionSelectedPosition.value = -1;
      transitionKind.value = HISTORY_PAGER_TRANSITION_IDLE;
      runOnJS(handleNativeTerminal)(epoch, position);
    },
    [
      handleNativeTerminal,
      pageTransitionEpoch,
      settledPagePosition,
      transitionCandidatePosition,
      transitionIdleSeen,
      transitionKind,
      transitionProgrammaticMotionSeen,
      transitionProgressSeen,
      transitionSelectedPosition,
      transitionStartPosition,
      transitionTargetPosition,
      visualPosition,
    ],
  );

  const beginGestureOnUI = useCallback(() => {
    'worklet';
    if (
      transitionKind.value === HISTORY_PAGER_TRANSITION_GESTURE &&
      transitionProgressSeen.value
    ) {
      return;
    }
    const origin =
      transitionSelectedPosition.value >= 0
        ? transitionSelectedPosition.value
        : settledPagePosition.value;
    const epoch = pageTransitionEpoch.value + 1;
    pageTransitionEpoch.value = epoch;
    settledPagePosition.value = origin;
    transitionKind.value = HISTORY_PAGER_TRANSITION_GESTURE;
    transitionIdleSeen.value = false;
    transitionProgrammaticMotionSeen.value = false;
    transitionProgressSeen.value = false;
    transitionSelectedPosition.value = -1;
    transitionCandidatePosition.value = origin;
    transitionStartPosition.value = origin;
    transitionTargetPosition.value = origin;
    runOnJS(handleGestureBegan)(epoch, origin);
  }, [
    handleGestureBegan,
    pageTransitionEpoch,
    settledPagePosition,
    transitionCandidatePosition,
    transitionIdleSeen,
    transitionKind,
    transitionProgrammaticMotionSeen,
    transitionProgressSeen,
    transitionSelectedPosition,
    transitionStartPosition,
    transitionTargetPosition,
  ]);

  const selectTab = useCallback(
    (tab: PerpsProHistoryTab) => {
      if (!activeRef.current) {
        return;
      }
      const target = PERPS_PRO_HISTORY_TABS.indexOf(tab);
      if (target < 0 || latestDesiredRef.current?.position === target) {
        return;
      }
      hideFeeTipsPopup();

      if (transitionKind.value !== HISTORY_PAGER_TRANSITION_IDLE) {
        latestDesiredRef.current = {
          epoch: pageTransitionEpoch.value,
          position: target,
        };
        return;
      }
      // The UI runtime settles before handleNativeTerminal gets a JS turn.
      // A press in that gap must start from the native page, not the lagging
      // JS observer, otherwise a request back to the old tab can be dropped.
      const settledPosition = Math.max(
        0,
        Math.min(
          PERPS_PRO_HISTORY_TABS.length - 1,
          Math.round(settledPagePosition.value),
        ),
      );
      if (target === settledPosition) {
        latestDesiredRef.current = null;
        configureSettledPresentation(target);
        commitBusinessPosition(target);
        return;
      }
      startProgrammaticTransition(target, settledPosition);
    },
    [
      commitBusinessPosition,
      configureSettledPresentation,
      hideFeeTipsPopup,
      pageTransitionEpoch,
      settledPagePosition,
      startProgrammaticTransition,
      transitionKind,
    ],
  );

  const handlePageScrollStateChanged =
    useEvent<PageScrollStateChangedNativeEvent>(
      event => {
        'worklet';
        if (!activeState.value) {
          return;
        }
        if (event.pageScrollState === 'dragging') {
          beginGestureOnUI();
          return;
        }
        if (
          event.pageScrollState === 'settling' &&
          transitionKind.value === HISTORY_PAGER_TRANSITION_PROGRAMMATIC
        ) {
          transitionProgrammaticMotionSeen.value = true;
          return;
        }
        if (
          event.pageScrollState !== 'idle' ||
          transitionKind.value === HISTORY_PAGER_TRANSITION_IDLE
        ) {
          return;
        }
        // A delayed idle from the previous native command can arrive after JS
        // has already issued the next command. Do not let that stale event
        // complete the new transition before the new command has moved.
        if (
          transitionKind.value === HISTORY_PAGER_TRANSITION_PROGRAMMATIC &&
          !transitionProgrammaticMotionSeen.value
        ) {
          return;
        }
        transitionIdleSeen.value = true;
        if (transitionSelectedPosition.value >= 0) {
          const selected = transitionSelectedPosition.value;
          finishTransitionOnUI(selected);
          return;
        }
        if (
          transitionKind.value === HISTORY_PAGER_TRANSITION_GESTURE &&
          transitionCandidatePosition.value === settledPagePosition.value
        ) {
          finishTransitionOnUI(settledPagePosition.value);
        }
      },
      ['onPageScrollStateChanged'],
      true,
    );

  const handlePageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    event => {
      'worklet';
      if (!activeState.value) {
        return;
      }
      const position = Math.max(
        0,
        Math.min(PERPS_PRO_HISTORY_TABS.length - 1, Math.round(event.position)),
      );
      const kind = transitionKind.value;
      if (kind === HISTORY_PAGER_TRANSITION_IDLE) {
        if (position === settledPagePosition.value) {
          return;
        }
        pageTransitionEpoch.value += 1;
        finishTransitionOnUI(position);
        return;
      }
      if (
        (kind === HISTORY_PAGER_TRANSITION_PROGRAMMATIC ||
          kind === HISTORY_PAGER_TRANSITION_DIRECT) &&
        position !== transitionTargetPosition.value
      ) {
        return;
      }
      transitionSelectedPosition.value = position;
      if (kind === HISTORY_PAGER_TRANSITION_DIRECT) {
        finishTransitionOnUI(position);
        return;
      }
      // iOS dispatches a programmatic selection from
      // UIPageViewController's animation completion and may not dispatch a
      // matching scroll-state idle. Android's ViewPager2 can select before
      // settling finishes, so it must still converge on idle.
      if (
        kind === HISTORY_PAGER_TRANSITION_PROGRAMMATIC &&
        !waitForProgrammaticIdle
      ) {
        finishTransitionOnUI(position);
        return;
      }
      if (transitionIdleSeen.value) {
        finishTransitionOnUI(position);
      }
    },
    ['onPageSelected'],
    true,
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
      if (transitionKind.value === HISTORY_PAGER_TRANSITION_IDLE) {
        if (
          Math.abs(pagePosition - settledPagePosition.value) <=
          PAGE_POSITION_EPSILON
        ) {
          return;
        }
        beginGestureOnUI();
      }
      if (transitionKind.value === HISTORY_PAGER_TRANSITION_PROGRAMMATIC) {
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
        if (
          Math.abs(pagePosition - transitionStartPosition.value) >
          PAGE_POSITION_EPSILON
        ) {
          transitionProgrammaticMotionSeen.value = true;
        }
      }
      transitionProgressSeen.value = true;
      if (transitionKind.value === HISTORY_PAGER_TRANSITION_GESTURE) {
        const settled = settledPagePosition.value;
        const target =
          pagePosition > settled + PAGE_POSITION_EPSILON
            ? Math.min(
                PERPS_PRO_HISTORY_TABS.length - 1,
                Math.ceil(pagePosition),
              )
            : pagePosition < settled - PAGE_POSITION_EPSILON
            ? Math.max(0, Math.floor(pagePosition))
            : settled;
        transitionCandidatePosition.value = Math.round(pagePosition);
        transitionTargetPosition.value = target;
      }
      visualPosition.value = pagePosition;
    },
    ['onPageScroll'],
    true,
  );

  useEffect(() => {
    activeState.value = active;
    if (!active) {
      previousActiveRef.current = false;
      latestDesiredRef.current = null;
      awaitingCommittedTabRef.current = null;
      pageTransitionEpoch.value += 1;
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
    configureSettledPresentation,
    pageTransitionEpoch,
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
      }
      return;
    }
    if (
      transitionKind.value !== HISTORY_PAGER_TRANSITION_IDLE ||
      latestDesiredRef.current
    ) {
      return;
    }
    if (observedIndexRef.current === activeIndex) {
      return;
    }
    pageTransitionEpoch.value += 1;
    observedIndexRef.current = activeIndex;
    configureSettledPresentation(activeIndex);
    pagerRef.current?.setPageWithoutAnimation(activeIndex);
  }, [
    active,
    activeTab,
    configureSettledPresentation,
    pageTransitionEpoch,
    transitionKind,
  ]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      pageTransitionEpoch.value += 1;
    },
    [pageTransitionEpoch],
  );

  const offscreenPageLimit =
    Platform.OS === 'android' ? PERPS_PRO_HISTORY_TABS.length - 1 : undefined;

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
      />
      <AnimatedPagerView
        initialPage={initialIndex}
        offscreenPageLimit={offscreenPageLimit}
        onPageScroll={handlePageScroll}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
        ref={pagerRef}
        scrollEnabled={active}
        style={styles.pager}
        testID="perps-pro-history-pager">
        {PERPS_PRO_HISTORY_TABS.map(tab => {
          const pageActive = tab === activeTab && active;
          return (
            <View
              accessibilityElementsHidden={!pageActive}
              collapsable={false}
              importantForAccessibility={
                pageActive ? 'auto' : 'no-hide-descendants'
              }
              key={tab}
              pointerEvents={pageActive ? 'auto' : 'none'}
              style={styles.page}
              testID={`perps-pro-history-page-${tab}`}>
              <PerpsProHistoryPagerPage
                active={pageActive}
                amountUnit={amountUnit}
                onLoadEarlier={onLoadEarlier}
                onRefresh={onRefresh}
                scrollHost={scrollHost}
                state={state[tab]}
                tab={tab}
              />
            </View>
          );
        })}
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
