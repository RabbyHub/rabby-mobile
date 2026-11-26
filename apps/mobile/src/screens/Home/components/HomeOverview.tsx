import RcIconDoubleArrowCC from '@/assets2024/icons/common/double-arrow-cc.svg';

import { useRegressionScenarioComponentAction } from '@/devtools/regressionScenarios/react';
import { useTheme2024 } from '@/hooks/theme';
import { fetchTop5TokensForAllAccountsOnce } from '@/components/AccountSwitcher/hooks';
import { createGetStyles2024 } from '@/utils/styles';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef } from 'react';
import type { ScrollView, ViewProps } from 'react-native';
import { View } from 'react-native';
import { svsLayout, useSafeSizes } from '@/hooks/useAppLayout';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Extrapolate,
  interpolate,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { currencyServiceApi } from '@/core/serviceApi/currency';
import { storeApiAccounts, useMyAccounts } from '@/hooks/account';
import { storeApiAccountsSwitcher } from '@/hooks/accountsSwitcher';
import {
  refreshMemeHoldings,
  refreshMemeHoldingsIfStale,
} from '@/screens/MemeCoin/data/memeHoldingsStore';
import { apisHomeTabIndex } from '@/hooks/navigation';
import addressBalanceStore, {
  balanceAccountsStore,
  getSelectedBalanceAddressesSnapshot,
} from '@/store/balance';
import { useTranslation } from 'react-i18next';
import { useSortAddressList } from '../../Address/useSortAddressList';
import {
  forceUpdateApprovalAlertCounts,
  triggerApprovalAlertCounts,
} from '../hooks/approvals';

import { useRendererDetect } from '@/components/Perf/PerfDetector';
import {
  HOME_REFRESH_INTERVAL,
  ITEM_LAYOUT_PADDING_HORIZONTAL,
} from '@/constant/home';
import {
  HOME_GESTURE_AXIS,
  beginHomeGesture,
  resolveHomeGestureAxis,
} from '@/screens/Home/gesture/homeGestureAuthority';
import { perfEvents } from '@/core/utils/perf';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';
import {
  useHomePostStartupReady,
  useHomeStartupReady,
} from '@/core/utils/homeStartupReady';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { syncTop10History } from '@/databases/hooks/history';
import { useSubscribePosition } from '@/hooks/perps/usePerpsStore';
import { useFetchCexInfo } from '@/hooks/useAddrDesc';
import { checkGasAccountAddressesEligibility } from '@/hooks/useGasAccountEligibility';
import { refreshDayCurve } from '@/store/curve24h';
import { scene24hBalanceStore } from '@/store/balance24h';
import { deleteLongTimeCurveCache } from '@/utils/24balanceCurveCache';
import { deleteLongTime24hBalanceCache } from '@/utils/24hBalanceCache';
import useTokenList from '@/store/tokens';
import useProtocol from '@/store/protocols';
import { BrowserOrPerpsPosition } from './BrowserOrPerpsPosition';
import { apisLending } from '../../Lending/hooks';
import { HomeCenterArea } from '../components/HomeCenterArea';
import { HomeDappDrawer } from '../components/HomeDappDrawer';
import { HOME_FEATURE_EDIT_FOOTER_HEIGHT } from './HomeFeatures/constants';
import { HomeFeatureEditFooter } from './HomeFeatures/HomeFeatureEditFooter';
import { HomeFeatureGrid } from './HomeFeatures/HomeFeatureGrid';
import { useIsHomeFeatureEditing } from '../hooks/homeFeatureLayout';
import { MultiAddressHomeHeader } from '../components/MultiAddressHomeHeader';
import {
  refreshSuccessAndFailList,
  resetFetchHistoryTxCount,
} from '../hooks/history';
import type { TabsScrollViewProps } from '@/components/customized/react-native-collapsible-tab-view/ScrollView';
import { TabsScrollView } from '@/components/customized/react-native-collapsible-tab-view/ScrollView';
import type { RNGHScrollView } from '@/components/customized/reexports';
import { RNGHRefreshControl } from '@/components/customized/reexports';
import {
  getHomeFloorTravel,
  getPullThreshold,
  getScrollContainerPb,
  homeDrawerAnimateMutable,
  SCROLLABLE_STATUS,
  THRESHOLD_PERCENT,
  shouldHoldFirstFloorAtEnd,
} from '../hooks/useHomeDrawerAnimate';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import type { ScrollHandlerProps } from '@/components/customized/react-native-collapsible-tab-view/hooks';
import { triggerImpact } from '@/utils/common';
import type { WorkletFunction } from 'react-native-reanimated/lib/typescript/commonTypes';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { useMemoizedFn } from 'ahooks';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { sleep } from '@/utils/async';
import { isEqual } from 'lodash';
import { preloadTransactionHotNavigator } from '@/perfs/preloads';
import type { OnRefreshOnJs } from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import {
  isOverPulldownRefreshThreshold,
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  useIOSPulldownRefreshStates,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { Text } from '@/components/Typography';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';

function couldDoRefresh() {
  return apisHomeTabIndex.isHomeAtFirstTab();
}

/** the account the Memecoin entry shows */
function getMemeEntryAddress() {
  return storeApiAccountsSwitcher.getSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  }).finalSceneCurrentAccount?.address;
}

function cancelStartupTaskHandle(
  handle: ReturnType<typeof scheduleStartupTask> | undefined,
) {
  if (handle && typeof handle === 'object' && 'cancel' in handle) {
    const maybeCancelable = handle as { cancel?: unknown };
    if (typeof maybeCancelable.cancel === 'function') {
      maybeCancelable.cancel();
    }
  }
}

async function warmHomeHistoryAfterStartup() {
  const top10Addresses = getSelectedBalanceAddressesSnapshot();
  if (!top10Addresses.length) {
    return;
  }
  await syncTop10History(top10Addresses, false);
}

async function warmBridgeHistoryAfterStartup() {
  const { warmBridgeHistoryForAddresses } = await import(
    '@/screens/Transaction/bridgeHistoryWarmup'
  );
  await warmBridgeHistoryForAddresses(getSelectedBalanceAddressesSnapshot());
}

async function warmReceiveAddressListAfterStartup() {
  await Promise.all([
    storeApiAccounts.fetchAccounts(),
    fetchTop5TokensForAllAccountsOnce(),
    preloadTransactionHotNavigator(),
    import('@/screens/Address/ReceiveAddressListSheet'),
    import('@/components/AccountSelector/AccountsPanel'),
  ]);
}

const OFFSETS = {
  atBottomThreshold: 2,
  // homeSwipeThreadhold: 20,
};

const {
  isExpanded,
  translateY,
  pullPercent,
  tabsOpacity,
  scrollViewContentHeight,
  scrollViewLayoutHeight,
  swipeUpHintHeight,
  firstFloorContentEnd,
  editingFloorTravel,
} = homeDrawerAnimateMutable;

/**
 * Bottom padding the swipe-up hint gets in edit mode: room for the edit
 * footer, so the last cards and the hint can scroll clear of it.
 */
const EDITING_SWIPE_UP_HINT_PADDING = HOME_FEATURE_EDIT_FOOTER_HEIGHT + 62;
/** Edit mode: from the swipe-up hint to the second floor's tab bar. */
const EDITING_FLOOR_GAP = 12;
/**
 * Edit mode: the hint ends its trip just under the top of the screen, right
 * above the second floor's tab bar, so it fades out over this last stretch.
 */
const EDITING_SWIPE_UP_HINT_FADE_PERCENT = 20;

/**
 * Share of a full screen the two floors travel: `translateY` spans a screen,
 * the floors are drawn over `getHomeFloorTravel`. The arguments are the
 * shared values' current values, read by the caller so that it tracks them.
 */
function getFloorTravelRatio(screenHeight: number, editingTravel: number) {
  'worklet';
  return screenHeight > 0
    ? getHomeFloorTravel(screenHeight, editingTravel) / screenHeight
    : 1;
}

function getIsAtBottom(scrollY: number) {
  'worklet';
  const contentHeight = scrollViewContentHeight.value;
  const layoutHeight = scrollViewLayoutHeight.value;

  if (contentHeight <= 0 || layoutHeight <= 0) {
    return false;
  }

  const scrollOffset = Math.max(0, contentHeight - layoutHeight);
  const restScrollOffset = clamp(scrollOffset - scrollY, 0, scrollOffset);
  return restScrollOffset <= OFFSETS.atBottomThreshold;
}

function hasOverThreshold() {
  'worklet';
  const screenHeight = svsLayout.screenLayout.value.height;
  return (
    translateY.value *
      getFloorTravelRatio(screenHeight, editingFloorTravel.value) <
    getPullThreshold(screenHeight) * -1
  );
}

const tabsScrollHandlers = {
  onContentSizeChange: ((_, height) => {
    scrollViewContentHeight.value = height;
  }) as TabsScrollViewProps['onContentSizeChange'] & object,
  onLayout: (event => {
    scrollViewLayoutHeight.value = event.nativeEvent.layout.height;
  }) as TabsScrollViewProps['onLayout'] & object,
};

const scrollViewInnerHandlers = {
  onLayout: (event => {
    const { y, height } = event.nativeEvent.layout;
    firstFloorContentEnd.value = y + height;
  }) as ViewProps['onLayout'] & object,
};

const swipeUpViewHandlers = {
  onLayout: (event => {
    swipeUpHintHeight.value = event.nativeEvent.layout.height;
  }) as ViewProps['onLayout'] & object,
};

function getHomeGestureConfs() {
  return {
    activeY: Math.min(
      8,
      Math.round(
        Math.floor(getPullThreshold(svsLayout.screenLayout.value.height) * 0.1),
      ),
    ),
  };
}

const usePulldownRefreshGesture = <T extends ScrollView | RNGHScrollView>({
  onJsPulldownRefresh: prop_onJsPulldownRefresh,
}: {
  onJsPulldownRefresh?: OnRefreshOnJs;
} = {}) => {
  const scrollableRef = useAnimatedRef<T>();
  const scrollY = useCurrentTabScrollY();

  const scrollableStatus = useSharedValue<SCROLLABLE_STATUS>(
    SCROLLABLE_STATUS.UNLOCKED,
  );

  const scrollToEnd = useCallback(
    (toBottom: boolean, animated = true) => {
      'worklet';
      if (toBottom) {
        scrollTo(scrollableRef, 0, 9999, animated);
      } else {
        scrollTo(scrollableRef, 0, 0, animated);
      }
      scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
    },
    [scrollableRef, scrollableStatus],
  );
  const { pullDistance, svIsRefreshing, svIsManualRefreshing } =
    useIOSPulldownRefreshStates();

  const onJsPulldownRefresh = useMemoizedFn(async () => {
    await prop_onJsPulldownRefresh?.({ svIsManualRefreshing });
  });

  useEffect(() => {
    const remove = addressBalanceStore.subscribe((cur, prev) => {
      if (cur.metaMap === prev.metaMap || isEqual(cur.metaMap, prev.metaMap)) {
        return;
      }
      const top10Addresses = balanceAccountsStore.getState().selectedAddresses;
      if (!top10Addresses.length) {
        return;
      }
      const isTop10BalanceLoading =
        addressBalanceStore.getAddressesFlowState(top10Addresses).isAnyLoading;

      if (!isTop10BalanceLoading) {
        runOnUI(setPulldownRefreshStage)({
          state: isTop10BalanceLoading ? 'refreshing' : 'finished',
          indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
          svIsRefreshing,
          pullDistance,
          svIsManualRefreshing,
        });
      }
    });

    return () => {
      remove();
    };
  }, [svIsRefreshing, pullDistance, svIsManualRefreshing]);

  useAnimatedReaction(
    () => translateY.value,
    translateYValue => {
      pullPercent.value =
        (translateYValue / svsLayout.screenLayout.value.height) * 100;
      const percentValue = pullPercent.value;
      if (percentValue === -100) {
        isExpanded.value = true;
        scrollToEnd(true, false);
      } else if (percentValue === 0) {
        isExpanded.value = false;
      }

      tabsOpacity.value = interpolate(
        percentValue,
        [-THRESHOLD_PERCENT, -0],
        [0, 1],
        Extrapolate.CLAMP,
      );
    },
  );

  // The list is pinned to its end when the drawer starts to move and when it
  // opens. Its distance to that end still changes afterwards, so pin it again
  // whenever it does and the end is what has to show.
  useAnimatedReaction(
    () =>
      Math.max(0, scrollViewContentHeight.value - scrollViewLayoutHeight.value),
    (maxScrollOffset, prevMaxScrollOffset) => {
      if (
        prevMaxScrollOffset === null ||
        maxScrollOffset === prevMaxScrollOffset
      ) {
        return;
      }
      if (
        shouldHoldFirstFloorAtEnd(
          translateY.value,
          svsLayout.screenLayout.value.height,
          editingFloorTravel.value,
        )
      ) {
        scrollToEnd(true, false);
      }
    },
    [scrollToEnd],
  );

  const uiOnScrollBack = useCallback<WorkletFunction>(
    // @ts-expect-error
    () => {
      'worklet';
      // Editing holds the end of the first floor right above the second
      // floor all the way down (`shouldHoldFirstFloorAtEnd`), so the page
      // lands where it was left instead of rewinding under the drawer.
      if (editingFloorTravel.value > 0) {
        return;
      }
      scrollToEnd(false, true);
    },
    [scrollToEnd],
  );

  const onScrollHandlers = {
    onAnimatedScrollBeginDrag: useCallback<
      ScrollHandlerProps['onAnimatedScrollBeginDrag'] & object
    >(() => {
      // // leave here for debug on some android devices
      // console.debug(
      //   '[onScrollHandlers] onAnimatedScrollBeginDrag:: event.nativeEvent',
      //   event.nativeEvent,
      // );
    }, []),
    onScroll: useCallback<ScrollHandlerProps['onScroll'] & object>(() => {
      // console.debug(
      //   '[onScrollHandlers] onScroll:: event.nativeEvent',
      //   event.nativeEvent,
      // );
    }, []),
    onAnimatedScrollEndDrag: useCallback<
      ScrollHandlerProps['onAnimatedScrollEndDrag'] & object
    >(() => {
      // console.debug(
      //   '[onScrollHandlers] onAnimatedScrollEndDrag:: event.nativeEvent',
      //   event.nativeEvent,
      // );
    }, []),
  };

  const startValues = useSharedValue({
    startedAtTop: scrollY.value <= 5,
    startedAtBottom: false,
    hasImpactOnPandown: false,
    hasImpactOnPanup: false,
  });

  const panGestureRef = useRef(
    Gesture.Pan()
      .shouldCancelWhenOutside(false)
      .activeOffsetY([
        -getHomeGestureConfs().activeY,
        getHomeGestureConfs().activeY,
      ])
      .maxPointers(1)
      // Share the Home-wide verdict: a horizontal drag belongs to the pager,
      // never to the pull-to-refresh / drawer-pull pan.
      .onTouchesDown(event => {
        'worklet';
        const touch = event.allTouches[0];
        if (touch) {
          beginHomeGesture(touch.absoluteX, touch.absoluteY);
        }
      })
      .onTouchesMove((event, stateManager) => {
        'worklet';
        const touch = event.allTouches[0];
        if (!touch) {
          stateManager.fail();
          return;
        }
        if (
          resolveHomeGestureAxis(touch.absoluteX, touch.absoluteY) ===
          HOME_GESTURE_AXIS.HORIZONTAL
        ) {
          stateManager.fail();
        }
      })
      .onStart(() => {
        startValues.value.startedAtBottom = getIsAtBottom(scrollY.value);
        startValues.value.startedAtTop = scrollY.value <= 5;
        // Pin the first floor to its very end once, before the drawer starts
        // moving, so the content that stays visible above the drawer is always
        // the true end of the list. This used to be re-issued on every
        // `onUpdate` frame (animated, Android only), which kept a native
        // smooth scroll running on its own timeline next to the finger-driven
        // translate: the list kept gliding while dragging back, then snapped
        // in line once the finger stopped.
        if (startValues.value.startedAtBottom) {
          scrollToEnd(true, false);
        }
      })
      .onUpdate(event => {
        panUp: {
          if (startValues.value.startedAtBottom && event.translationY < 0) {
            // The floors follow the finger one to one, whatever distance
            // they travel.
            translateY.value =
              event.translationY /
              getFloorTravelRatio(
                svsLayout.screenLayout.value.height,
                editingFloorTravel.value,
              );
            scrollableStatus.value = SCROLLABLE_STATUS.LOCKED;
            // Keep the first floor frozen at its end while the drawer owns the
            // drag. If the native scroll view manages to move the offset (an
            // edge effect, a leftover fling, the few px before this pan
            // activates), the content would slide under the drawer-anchored
            // overlay while the finger keeps translating the drawer, so the
            // two layers drift by a random amount. Snap back instantly and
            // only when it actually drifted: no animation is started, nothing
            // runs when the offset is already stable.
            if (!getIsAtBottom(scrollY.value)) {
              scrollToEnd(true, false);
            }
          } else {
            translateY.value = 0;
            scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
          }

          if (
            startValues.value.startedAtBottom &&
            hasOverThreshold() &&
            event.translationY < 0
          ) {
            !startValues.value.hasImpactOnPandown && runOnJS(triggerImpact)();
            startValues.value.hasImpactOnPandown = true;
          }
        }

        pullRefresh: {
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            startValues.value.startedAtTop &&
            !svIsRefreshing.value
          ) {
            pullDistance.value = Math.max(0, event.translationY);
            if (isOverPulldownRefreshThreshold(pullDistance.value)) {
              !startValues.value.hasImpactOnPanup &&
                runOnJS(triggerImpact)({ __DEV_ONLY__: true });
              startValues.value.hasImpactOnPanup = true;
            }
          }
        }
      })
      .onEnd(() => {
        panUp: {
          const hasImpactOnPandown = startValues.value.hasImpactOnPandown;

          if (startValues.value.startedAtBottom && hasOverThreshold()) {
            translateY.value = withTiming(
              -svsLayout.screenLayout.value.height,
              undefined,
              () => {
                scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
              },
            );
            !hasImpactOnPandown && runOnJS(triggerImpact)();
          } else {
            translateY.value = withTiming(0, undefined, () => {
              scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
            });
          }
          startValues.value.startedAtBottom = false;
          startValues.value.hasImpactOnPandown = false;
        }

        pullRefresh: {
          const hasImpactOnPanup = startValues.value.hasImpactOnPanup;
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            startValues.value.startedAtTop &&
            !svIsRefreshing.value
          ) {
            if (isOverPulldownRefreshThreshold(pullDistance.value)) {
              // svIsRefreshing.value = true;
              setPulldownRefreshStage({
                state: 'refreshing',
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
                svIsRefreshing,
                svIsManualRefreshing,
                pullDistance,
              });
              runOnJS(onJsPulldownRefresh)();
              !hasImpactOnPanup &&
                runOnJS(triggerImpact)({ __DEV_ONLY__: true });
            } else {
              setPulldownRefreshStage({
                state: 'finished',
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
                svIsRefreshing,
                svIsManualRefreshing,
                pullDistance,
              });
            }
            startValues.value.hasImpactOnPanup = false;
          }
        }
      }),
  );

  const isRefreshing = useValueFromSharedValue(svIsRefreshing);

  return {
    panGestureRef,

    onScrollHandlers,
    uiOnScrollBack,
    scrollableRef,

    isRefreshing,
    pullDistance,
    svIsRefreshing,
    svIsManualRefreshing,
  };
};

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  main: {
    height: '100%',
    overflow: 'hidden',

    // flex: 1,
    // ...makeDevOnlyStyle({
    //   backgroundColor: colors2024['red-light-2'],
    // }),
  },
  scroll: {
    flex: 1,
    paddingTop: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: '100%',
    paddingBottom: getScrollContainerPb(safeAreaInsets.bottom),
    // ...makeDebugBorder('orange'),
  },
  iosAbsIndicatorOffset: {
    paddingTop: 0,
  },
  scrollViewInner: {
    marginTop: !SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING
      ? HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset
      : 0,
    // ...makeDebugBorder('orange'),
    // ...makeDevOnlyStyle({
    //   backgroundColor: colors2024['orange-light-2'],
    // }),
  },
  grid: {
    marginTop: 0,
    width: '100%',
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
  },
  pullUpWrapper: {
    flex: 1,
    position: 'relative',
    // ...makeDebugBorder(),
  },
  swipeUpHint: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36,
    // ...makeDebugBorder('purple'),
  },
  // Room for the edit footer, so the last cards and this hint can scroll
  // clear of it. It stays inside the hint's own box: the edit-mode floor
  // travel is measured from the end of this box, minus this padding.
  swipeUpHintEditing: {
    paddingBottom: EDITING_SWIPE_UP_HINT_PADDING,
  },
  swipeUpHintText: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
}));

type HomeOverviewTriggerUpdate = ReturnType<
  typeof addressBalanceStore.useAccountsBalanceTrigger
>['triggerUpdate'];

function HomeOverviewDeferredStartupGate({
  triggerUpdate,
}: {
  triggerUpdate: HomeOverviewTriggerUpdate;
}) {
  const startupReady = useHomeStartupReady();

  if (!startupReady) {
    return null;
  }

  return (
    <>
      <HomeOverviewCriticalStartupEffects triggerUpdate={triggerUpdate} />
      <HomeOverviewPostStartupGate triggerUpdate={triggerUpdate} />
    </>
  );
}

function HomeOverviewCriticalStartupEffects({
  triggerUpdate,
}: {
  triggerUpdate: HomeOverviewTriggerUpdate;
}) {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;

    void triggerUpdate({ localOnly: true });
  }, [triggerUpdate]);

  return null;
}

function HomeOverviewPostStartupGate({
  triggerUpdate,
}: {
  triggerUpdate: HomeOverviewTriggerUpdate;
}) {
  const postStartupReady = useHomePostStartupReady();

  if (!postStartupReady) {
    return null;
  }

  return <HomeOverviewPostStartupEffects triggerUpdate={triggerUpdate} />;
}

// Deliberately outside the startup gates: every ms this waits behind
// postReady is added to the position card's blank time.
function HomeOverviewPerpsPositionSubscription() {
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);

  useSubscribePosition(sortedAccounts);

  return null;
}

function HomeOverviewPostStartupEffects({
  triggerUpdate,
}: {
  triggerUpdate: HomeOverviewTriggerUpdate;
}) {
  const isFirstTriggerRef = useRef(true);

  useFetchCexInfo();

  useFocusEffect(
    useCallback(() => {
      if (!couldDoRefresh()) {
        return;
      }
      checkGasAccountAddressesEligibility();
    }, []),
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      deleteLongTimeCurveCache();
      deleteLongTime24hBalanceCache();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const historyWarmupHandle = scheduleStartupTask(
      () => warmHomeHistoryAfterStartup(),
      STARTUP_TASKS.homeHistoryWarmup,
    );
    const bridgeHistoryWarmupHandle = scheduleStartupTask(
      () => warmBridgeHistoryAfterStartup(),
      STARTUP_TASKS.homeBridgeHistoryWarmup,
    );
    const receiveAddressListWarmupHandle = scheduleStartupTask(
      () => warmReceiveAddressListAfterStartup(),
      STARTUP_TASKS.homeReceiveAddressListWarmup,
    );

    return () => {
      cancelStartupTaskHandle(historyWarmupHandle);
      cancelStartupTaskHandle(bridgeHistoryWarmupHandle);
      cancelStartupTaskHandle(receiveAddressListWarmupHandle);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSuccessAndFailList();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      resetFetchHistoryTxCount();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const isFirstTrigger = isFirstTriggerRef.current;
      const canRefreshOverview = couldDoRefresh();

      if (!isFirstTrigger && !canRefreshOverview) {
        return;
      }

      if (isFirstTriggerRef.current) {
        isFirstTriggerRef.current = false;
      }

      triggerUpdate(isFirstTrigger || undefined).then(balanceAccounts => {
        // console.debug('[perf] MultiAddressHome triggerUpdate refreshed:: balanceAccounts', balanceAccounts);
        const balanceAddresses = Object.keys(balanceAccounts);
        scene24hBalanceStore.refresh24hAssets({
          addresses: balanceAddresses.length ? balanceAddresses : undefined,
          force: isFirstTrigger,
          reason: 'manual_refresh',
        });
        refreshDayCurve({
          addresses: balanceAddresses.length ? balanceAddresses : undefined,
          force: isFirstTrigger,
          reason: 'manual_refresh',
        });
      });

      if (!canRefreshOverview) {
        return;
      }

      triggerApprovalAlertCounts(HOME_REFRESH_INTERVAL);
      const memeAddress = getMemeEntryAddress();
      if (memeAddress) {
        refreshMemeHoldingsIfStale(memeAddress, HOME_REFRESH_INTERVAL);
      }
      // // leave here to measure perf impact
      // isNonPublicProductionEnv && apisLending.fetchLendingData({ persistOnly: true });
    }, [triggerUpdate]),
  );

  return null;
}

function DeferredHomeDappDrawer({
  onScrollBack,
}: {
  onScrollBack: React.ComponentProps<typeof HomeDappDrawer>['onScrollBack'];
}) {
  const postStartupReady = useHomePostStartupReady();

  if (!postStartupReady) {
    return null;
  }

  return <HomeDappDrawer onScrollBack={onScrollBack} />;
}

/**
 * The hint under the cards. It reads the edit state itself, so entering or
 * leaving edit mode repaints this line and not the whole overview.
 */
function HomeSwipeUpHint() {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  const isEditing = useIsHomeFeatureEditing();
  const { safeHeaderTop } = useSafeSizes();

  // Editing treats the two floors as one page: the second floor's tab bar
  // follows this hint at `EDITING_FLOOR_GAP`. The floors therefore travel
  // from where the hint rests at the end of the Home to where that tab bar
  // rests on the second floor, not a full screen.
  useAnimatedReaction(
    () => {
      if (!isEditing) {
        return 0;
      }
      const screenHeight = svsLayout.screenLayout.value.height;
      const contentHeight = scrollViewContentHeight.value;
      const contentEnd = firstFloorContentEnd.value;
      if (screenHeight <= 0 || contentHeight <= 0 || contentEnd <= 0) {
        // Not measured yet: still editing, over a full screen.
        return screenHeight;
      }

      // With the Home scrolled to its end, from the hint's own bottom edge
      // to the bottom of the screen.
      const belowHint =
        Math.max(0, contentHeight - contentEnd) + EDITING_SWIPE_UP_HINT_PADDING;
      return screenHeight - belowHint + EDITING_FLOOR_GAP - safeHeaderTop;
    },
    travel => {
      editingFloorTravel.value = travel;
    },
    [isEditing, safeHeaderTop],
  );

  const hintStyle = useAnimatedStyle(
    () => ({
      opacity: isEditing
        ? interpolate(
            pullPercent.value,
            [-100, EDITING_SWIPE_UP_HINT_FADE_PERCENT - 100],
            [0, 1],
            Extrapolate.CLAMP,
          )
        : 1,
    }),
    [isEditing],
  );

  return (
    <Animated.View
      style={[
        styles.swipeUpHint,
        isEditing && styles.swipeUpHintEditing,
        hintStyle,
      ]}
      onLayout={swipeUpViewHandlers.onLayout}>
      <RcIconDoubleArrowCC color={colors2024['neutral-secondary']} />
      <Text style={styles.swipeUpHintText}>
        {isEditing
          ? t('page.home.swipeUp.editMore')
          : t('page.home.swipeUp.more')}
      </Text>
    </Animated.View>
  );
}

export const HomeOverview = React.memo(() => {
  const { styles } = useTheme2024({
    getStyle,
  });

  const { triggerUpdate } = addressBalanceStore.useAccountsBalanceTrigger();

  const refreshManualBalance = useCallback(() => {
    return triggerUpdate(true).then(balanceAccounts => {
      const balanceAddresses = Object.keys(balanceAccounts);
      scene24hBalanceStore.refresh24hAssets({
        addresses: balanceAddresses.length ? balanceAddresses : undefined,
        force: true,
        reason: 'manual_refresh',
      });
      refreshDayCurve({
        addresses: balanceAddresses.length ? balanceAddresses : undefined,
        force: true,
        reason: 'manual_refresh',
      });
    });
  }, [triggerUpdate]);

  const refreshManualHomeBackgroundData = useCallback(async () => {
    // update at background
    forceUpdateApprovalAlertCounts();
    apisLending.fetchLendingData();
    // keep the wallet entry balance in sync with the account it shows
    const memeAddress = getMemeEntryAddress();
    if (memeAddress) {
      refreshMemeHoldings(memeAddress);
    }
    const forceRefresh = true;
    void currencyServiceApi.syncCurrencyList(forceRefresh).catch(error => {
      console.error('[HomeOverview] refresh currency list failed', error);
    });

    const top10Addresses = getSelectedBalanceAddressesSnapshot();
    if (!top10Addresses.length) {
      return;
    }
    syncTop10History(top10Addresses, forceRefresh);

    // refresh token/protocol list
    useTokenList.getState().batchGetTokenList(top10Addresses, forceRefresh);
    useProtocol.getState().batchGetProtocols(top10Addresses, forceRefresh);
  }, []);

  const onRefresh = useCallback(async () => {
    if (!couldDoRefresh()) {
      return;
    }

    perfEvents.emit('HOME_WILL_BE_REFRESHED_MANUALLY');
    return Promise.all([
      refreshManualBalance(),
      checkGasAccountAddressesEligibility(true),
    ]).finally(refreshManualHomeBackgroundData);
  }, [refreshManualBalance, refreshManualHomeBackgroundData]);

  // 只有手动刷新需要检查跳跃数字是否和刷新前是否一致
  const handleManualPulldownRefresh = useCallback(async () => {
    if (!couldDoRefresh()) {
      return;
    }

    perfEvents.emit('HOME_WILL_BE_REFRESHED_MANUALLY');
    const refreshTrace = beginAssetDataLoadDiagnostic(
      'home-manual-refresh',
      'home',
    );
    const balanceRefresh = refreshManualBalance();
    const gasAccountRefresh = checkGasAccountAddressesEligibility(true);
    refreshTrace.mark('foreground-requests-dispatched');
    void balanceRefresh.then(
      () => refreshTrace.mark('balance-refresh-settled'),
      () => refreshTrace.mark('balance-refresh-failed'),
    );
    void gasAccountRefresh.then(
      () => refreshTrace.mark('gas-account-refresh-settled'),
      () => refreshTrace.mark('gas-account-refresh-failed'),
    );
    const fullRefresh = Promise.all([
      balanceRefresh,
      gasAccountRefresh,
    ]).finally(() => {
      refreshTrace.mark('foreground-requests-settled');
      refreshTrace.mark('asset-refresh-dispatch-started');
      return refreshManualHomeBackgroundData();
    });
    const safeFullRefresh = fullRefresh.then(
      () => {
        refreshTrace.mark('asset-refresh-dispatched');
        refreshTrace.finish({ path: 'manual-refresh-dispatched' });
      },
      error => {
        refreshTrace.fail({ phase: 'manual-refresh' });
        console.error('Refresh failed:', error);
      },
    );

    withAnimatedTickerRefreshNudge(() =>
      Promise.race([balanceRefresh, sleep(3000)]),
    ).catch(error => {
      console.error('Refresh balance failed:', error);
    });
    await Promise.race([safeFullRefresh, sleep(3000)]);
  }, [refreshManualBalance, refreshManualHomeBackgroundData]);

  // Regression scenarios call the same refresh path as the native pull-down
  // control. The production alias is a no-op, so this has no release behavior.
  useRegressionScenarioComponentAction(
    'home.manual-pulldown-refresh',
    handleManualPulldownRefresh,
  );

  const {
    onScrollHandlers,
    uiOnScrollBack,
    scrollableRef,
    panGestureRef,

    isRefreshing,
    pullDistance,
    svIsRefreshing,
    svIsManualRefreshing,
  } = usePulldownRefreshGesture<RNGHScrollView>({
    onJsPulldownRefresh: async ctx => {
      ctx.svIsManualRefreshing.value = true;
      await handleManualPulldownRefresh();
    },
  });

  const pulldownRefreshReturns = usePulldownRefreshStyles({
    indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    pullDistanceMaxValue: HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset,
    states: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  });

  const mainStyle = useAnimatedStyle(() => {
    return {
      // overflow: 'hidden',
      transform: [
        {
          // translateY: Math.min(HOME_TOP_HEADER_SIZES.scrollableListTopOffset * 2, translateY.value),
          translateY:
            Math.min(0, translateY.value) *
            getFloorTravelRatio(
              svsLayout.screenLayout.value.height,
              editingFloorTravel.value,
            ),
        },
      ],
    };
  });

  useRendererDetect({ name: 'MultiAddressHome::HomeOverview' });

  return (
    <View style={styles.pullUpWrapper}>
      <HomeOverviewPerpsPositionSubscription />
      <HomeOverviewDeferredStartupGate triggerUpdate={triggerUpdate} />
      <Animated.View style={[styles.main, mainStyle]}>
        <GestureDetector gesture={panGestureRef.current}>
          <TabsScrollView
            ref={scrollableRef}
            showsVerticalScrollIndicator={false}
            style={[styles.scroll, { flex: undefined }]}
            contentContainerStyle={[styles.scrollContainer]}
            bounces={false}
            overScrollMode={'never'}
            scrollEventThrottle={16}
            onContentSizeChange={tabsScrollHandlers.onContentSizeChange}
            onLayout={tabsScrollHandlers.onLayout}
            onAnimatedScrollBeginDrag={
              onScrollHandlers.onAnimatedScrollBeginDrag
            }
            onAnimatedScrollEndDrag={onScrollHandlers.onAnimatedScrollEndDrag}
            onScroll={onScrollHandlers.onScroll}
            // scrollableEnabled={scrollableEnabled}
            simultaneousHandlers={[panGestureRef]}
            {...(!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING && {
              refreshControl: (
                <RNGHRefreshControl
                  style={{ paddingHorizontal: 16 }}
                  refreshing={isRefreshing}
                  onRefresh={handleManualPulldownRefresh}
                />
              ),
            })}>
            <RefreshPlaceholderIOS
              hooksReturn={pulldownRefreshReturns}
              animatedStyle={pulldownRefreshReturns.refreshPlaceholderStyle}
              animatedIndicatorStyle={styles.iosAbsIndicatorOffset}
              __PICK_MANUAL__
            />
            <Animated.View
              style={[styles.scrollViewInner]}
              onLayout={scrollViewInnerHandlers.onLayout}>
              <MultiAddressHomeHeader onRefresh={onRefresh} />

              <HomeCenterArea />
              <View style={styles.grid}>
                <HomeFeatureGrid place="home" />
                <BrowserOrPerpsPosition />
                <HomeSwipeUpHint />
              </View>
            </Animated.View>
          </TabsScrollView>
        </GestureDetector>
      </Animated.View>
      <DeferredHomeDappDrawer onScrollBack={uiOnScrollBack} />
      <HomeFeatureEditFooter />
    </View>
  );
});
