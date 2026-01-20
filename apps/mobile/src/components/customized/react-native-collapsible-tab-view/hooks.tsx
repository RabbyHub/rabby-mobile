import { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

// import { IS_IOS, ONE_FRAME_MS } from "react-native-collapsible-tab-view/src/helpers"
import { IS_IOS } from '@/core/native/utils';
const ONE_FRAME_MS = 16;
import {
  useScroller,
  useTabsContext,
} from 'react-native-collapsible-tab-view/src/hooks';
import { TabName } from 'react-native-collapsible-tab-view/src/types';
import {
  cancelAnimation,
  Extrapolate,
  interpolate,
  runOnJS,
  ScrollHandlers,
  SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type ScrollEventContextType = {
  initialContentOffsetY: number;
  // shouldLockInitialPosition: boolean;
};

type ScrollableEvent<
  C extends Record<string, unknown> = Record<string, unknown>,
> = (
  event: Pick<NativeSyntheticEvent<NativeScrollEvent>, 'nativeEvent'>,
  context: C,
) => void;

const workletNoop = () => {
  'worklet';
};

export type ScrollHandlerProps = {
  onScroll?: ScrollableEvent;
  onScrollBeginDrag?: ScrollableEvent;
  onScrollEndDrag?: ScrollableEvent;
  onScrollMomentumBegin?: ScrollableEvent;
  onScrollMomentumEnd?: ScrollableEvent;
  scrollableEnabled?: SharedValue<boolean>;
};

export const useScrollHandlerY = (
  name: TabName,
  {
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onScrollMomentumBegin,
    onScrollMomentumEnd,
    scrollableEnabled: prop_scrollableEnabled,
  }: ScrollHandlerProps,
) => {
  const {
    accDiffClamp,
    focusedTab,
    snapThreshold,
    revealHeaderOnScroll,
    refMap,
    tabNames,
    index,
    headerHeight,
    contentInset,
    containerHeight,
    scrollYCurrent,
    scrollY,
    oldAccScrollY,
    accScrollY,
    offset,
    headerScrollDistance,
    snappingTo,
    contentHeights,
    indexDecimal,
    allowHeaderOverscroll,
  } = useTabsContext();

  const internalEnabled = useSharedValue(false);
  const enabled = prop_scrollableEnabled || internalEnabled;

  const enable = useCallback(
    (toggle: boolean) => {
      'worklet';
      enabled.value = toggle;
    },
    [enabled],
  );

  /**
   * Helper value to track if user is dragging on iOS, because iOS calls
   * onMomentumEnd only after a vigorous swipe. If the user has finished the
   * drag, but the onMomentumEnd has never triggered, we need to manually
   * call it to sync the scenes.
   */
  const afterDrag = useSharedValue(0);

  const tabIndex = useMemo(
    () => tabNames.value.findIndex(n => n === name),
    [tabNames, name],
  );

  const scrollTo = useScroller();

  const scrollAnimation = useSharedValue<number | undefined>(undefined);

  useAnimatedReaction(
    () => scrollAnimation.value,
    val => {
      if (val !== undefined) {
        scrollTo(refMap[name], 0, val, false, '[useAnimatedReaction scroll]');
      }
    },
  );

  const onMomentumEnd: ScrollHandlers<any>['onMomentumEnd'] & object = (
    event,
    ctx,
  ) => {
    'worklet';
    if (onScrollMomentumEnd)
      runOnJS(onScrollMomentumEnd)({ nativeEvent: event }, ctx);
    if (!enabled.value) return;

    if (typeof snapThreshold === 'number') {
      if (revealHeaderOnScroll) {
        if (accDiffClamp.value > 0) {
          if (
            scrollYCurrent.value >
            headerScrollDistance.value * snapThreshold
          ) {
            if (
              accDiffClamp.value <=
              headerScrollDistance.value * snapThreshold
            ) {
              // snap down
              accDiffClamp.value = withTiming(0);
            } else if (accDiffClamp.value < headerScrollDistance.value) {
              // snap up
              accDiffClamp.value = withTiming(headerScrollDistance.value);

              if (scrollYCurrent.value < headerScrollDistance.value) {
                scrollAnimation.value = scrollYCurrent.value;
                scrollAnimation.value = withTiming(headerScrollDistance.value);
                //console.log('[${name}] sticky snap up')
              }
            }
          } else {
            accDiffClamp.value = withTiming(0);
          }
        }
      } else {
        if (
          scrollYCurrent.value <=
          headerScrollDistance.value * snapThreshold
        ) {
          // snap down
          snappingTo.value = 0;
          scrollAnimation.value = scrollYCurrent.value;
          scrollAnimation.value = withTiming(0);
          //console.log('[${name}] snap down')
        } else if (scrollYCurrent.value <= headerScrollDistance.value) {
          // snap up
          snappingTo.value = headerScrollDistance.value;
          scrollAnimation.value = scrollYCurrent.value;
          scrollAnimation.value = withTiming(headerScrollDistance.value);
          //console.log('[${name}] snap up')
        }
      }
    }
  };

  const contentHeight = useDerivedValue(() => {
    const tabIndex = tabNames.value.indexOf(name);
    return contentHeights.value[tabIndex] || Number.MAX_VALUE;
  }, []);

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (event, ctx) => {
        if (onScroll) runOnJS(onScroll)({ nativeEvent: event }, ctx);
        if (!enabled.value) return;

        if (focusedTab.value === name) {
          if (IS_IOS) {
            let { y } = event.contentOffset;
            // normalize the value so it starts at 0
            y = y + contentInset.value;
            const clampMax =
              contentHeight.value -
              (containerHeight.value || 0) +
              contentInset.value;
            // make sure the y value is clamped to the scrollable size (clamps overscrolling)
            scrollYCurrent.value = allowHeaderOverscroll
              ? y
              : interpolate(y, [0, clampMax], [0, clampMax], Extrapolate.CLAMP);
          } else {
            const { y } = event.contentOffset;
            scrollYCurrent.value = y;
          }

          scrollY.value[index.value] = scrollYCurrent.value;
          oldAccScrollY.value = accScrollY.value;
          accScrollY.value = scrollY.value[index.value] + offset.value;

          if (revealHeaderOnScroll) {
            const delta = accScrollY.value - oldAccScrollY.value;
            const nextValue = accDiffClamp.value + delta;
            if (delta > 0) {
              // scrolling down
              accDiffClamp.value = Math.min(
                headerScrollDistance.value,
                nextValue,
              );
            } else if (delta < 0) {
              // scrolling up
              accDiffClamp.value = Math.max(0, nextValue);
            }
          }
        }
      },
      onBeginDrag: (event, ctx) => {
        if (onScrollBeginDrag)
          runOnJS(onScrollBeginDrag)({ nativeEvent: event }, ctx);
        if (!enabled.value) return;

        // ensure the header stops snapping
        cancelAnimation(accDiffClamp);

        if (IS_IOS) cancelAnimation(afterDrag);
      },
      onEndDrag: (event, ctx) => {
        if (onScrollEndDrag)
          runOnJS(onScrollEndDrag)({ nativeEvent: event }, ctx);
        if (!enabled.value) return;

        if (IS_IOS) {
          // we delay this by one frame so that onMomentumBegin may fire on iOS
          afterDrag.value = withDelay(
            ONE_FRAME_MS,
            withTiming(0, { duration: 0 }, isFinished => {
              // if the animation is finished, the onMomentumBegin has
              // never started, so we need to manually trigger the onMomentumEnd
              // to make sure we snap
              if (isFinished) {
                onMomentumEnd(event, ctx);
              }
            }),
          );
        }
      },
      onMomentumBegin: (event, ctx) => {
        if (onScrollMomentumBegin)
          runOnJS(onScrollMomentumBegin)({ nativeEvent: event }, ctx);
        if (!enabled.value) return;

        if (IS_IOS) {
          cancelAnimation(afterDrag);
        }
      },
      onMomentumEnd,
    },
    [
      refMap,
      name,
      revealHeaderOnScroll,
      containerHeight,
      contentInset,
      snapThreshold,
      enabled,
      scrollTo,
    ],
  );

  // sync unfocused scenes
  useAnimatedReaction(
    () => {
      // if (!enabled.value) {
      //   return false
      // }

      // if the index is decimal, then we're in between panes
      const isChangingPane = !Number.isInteger(indexDecimal.value);

      return isChangingPane;
    },
    (isSyncNeeded, wasSyncNeeded) => {
      if (
        isSyncNeeded &&
        isSyncNeeded !== wasSyncNeeded &&
        focusedTab.value !== name
      ) {
        let nextPosition: number | null = null;
        const focusedScrollY = scrollY.value[Math.round(indexDecimal.value)];
        const tabScrollY = scrollY.value[tabIndex];
        const areEqual = focusedScrollY === tabScrollY;

        if (!areEqual) {
          const currIsOnTop =
            tabScrollY + StyleSheet.hairlineWidth <= headerScrollDistance.value;
          const focusedIsOnTop =
            focusedScrollY + StyleSheet.hairlineWidth <=
            headerScrollDistance.value;

          if (revealHeaderOnScroll) {
            const hasGap = accDiffClamp.value > tabScrollY;
            if (hasGap || currIsOnTop) {
              nextPosition = accDiffClamp.value;
            }
          } else if (typeof snapThreshold === 'number') {
            if (focusedIsOnTop) {
              nextPosition = snappingTo.value;
            } else if (currIsOnTop) {
              nextPosition = headerHeight.value || 0;
            }
          } else if (currIsOnTop || focusedIsOnTop) {
            nextPosition = Math.min(focusedScrollY, headerScrollDistance.value);
          }
        }

        if (nextPosition !== null) {
          // console.log(`sync ${name} ${nextPosition}`)
          scrollY.value[tabIndex] = nextPosition;
          scrollTo(refMap[name], 0, nextPosition, false, `[${name}] sync pane`);
        }
      }
    },
    [revealHeaderOnScroll, refMap, snapThreshold, tabIndex, enabled, scrollTo],
  );

  return { scrollHandler, enable };
};
