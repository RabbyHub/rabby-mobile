import { ScrollHandlerProps } from '@/components/customized/react-native-collapsible-tab-view/hooks';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { zCreate } from '@/core/utils/reexports';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { triggerImpact } from '@/utils/common';
import { useMemo, useRef, useState, useCallback } from 'react';
import {
  Dimensions,
  PanResponder,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { useTabsContext } from 'react-native-collapsible-tab-view/src/hooks';
import { Gesture } from 'react-native-gesture-handler';
import {
  GestureStateManager,
  GestureStateManagerType,
} from 'react-native-gesture-handler/src/handlers/gestures/gestureStateManager';
import {
  clamp,
  Extrapolate,
  interpolate,
  makeMutable,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Mutable } from 'react-native-reanimated/lib/typescript/commonTypes';

export const SCROLLABLE_STATUS = {
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED',
} as const;

export type SCROLLABLE_STATUS =
  (typeof SCROLLABLE_STATUS)[keyof typeof SCROLLABLE_STATUS];

export const SCROLLABLE_DECELERATION_RATE_MAPPER = {
  [SCROLLABLE_STATUS.LOCKED]: 0,
  [SCROLLABLE_STATUS.UNLOCKED]: Platform.select({
    ios: 0.998,
    android: 0.985,
    default: 1,
  }),
};

export const homeDrawerAnimateMutables = {
  tabsOpacity: makeMutable(0),
  pullPercent: makeMutable(0),
  isExpanded: makeMutable(false),
  translateY: makeMutable(0),
};

const OFFSETS = {
  atBottomThreshold: IS_IOS ? 0 : -10,

  homeSwipeThreadhold: 20,
};

export const PULL_THRESHOLD = 160;

function getIsOverBottom(
  scrollY: number,
  scrollViewContentHeight: number,
  scrollViewLayoutHeight: number,
) {
  'worklet';
  const ret = {
    isOverBottom: false,
    isOverHalftonent: false,
  };
  if (!scrollViewContentHeight || !scrollViewLayoutHeight) ret;

  const maxOffset = Math.max(
    0,
    scrollViewContentHeight - scrollViewLayoutHeight,
  );
  ret.isOverBottom = scrollY - maxOffset >= OFFSETS.atBottomThreshold;

  return {
    ...ret,
    isOverHalftonent: scrollY * 2 >= maxOffset,
  };
}

export const useHomeAnimation = () => {
  const { isExpanded, translateY, pullPercent, tabsOpacity } =
    homeDrawerAnimateMutables;
  const { height: winHeight, width: winWidth } = useWindowDimensions();
  const scrollableRef = useAnimatedRef<ScrollView>();
  const scrollY = useCurrentTabScrollY();

  const scrollViewContentHeight = useSharedValue(0);
  const scrollViewLayoutHeight = useSharedValue(0);

  const context = useSharedValue({
    currentY: 0,
  });
  const scrollToTop = useCallback(() => {
    'worklet';
    scrollTo(scrollableRef, 0, 0, false);
    context.value.currentY = 0;
  }, [context.value, scrollableRef]);

  useAnimatedReaction(
    () => translateY.value,
    value => {
      pullPercent.value = (value / winHeight) * 100;
    },
  );

  useAnimatedReaction(
    () => pullPercent.value,
    value => {
      if (value === 0) {
        isExpanded.value = false;
      } else if (value === -100) {
        isExpanded.value = true;
        scrollToTop();
      }

      tabsOpacity.value = interpolate(
        value,
        [-8, 0],
        [0, 1],
        Extrapolate.CLAMP,
      );
    },
  );

  const panGesture = useMemo(() => {
    const pullThreshold = winHeight * 0.3;
    const activeY = Math.min(8, Math.round(Math.floor(pullThreshold * 0.1)));

    let gesture = Gesture.Pan()
      .shouldCancelWhenOutside(false)
      .activeOffsetY(-activeY)
      .maxPointers(1)
      .onStart(() => {
        translateY.value = 0;
        isExpanded.value = false;
      })
      .onUpdate(event => {
        const maxOffset = Math.max(
          0,
          scrollViewContentHeight.value - scrollViewLayoutHeight.value,
        );
        const offsetY = context.value.currentY - event.translationY;
        const clampedOffsetY = clamp(offsetY, 0, maxOffset);

        scrollTo(scrollableRef, 0, clampedOffsetY, false);

        if (event.translationY > 0 || !event.translationY) return;
        const { isOverBottom } = getIsOverBottom(
          scrollY.value,
          scrollViewContentHeight.value,
          scrollViewLayoutHeight.value,
        );
        if (!isOverBottom) return;

        translateY.value = event.translationY;
      })
      .onEnd(event => {
        context.value.currentY = scrollY.value;

        if (translateY.value * -1 > pullThreshold) {
          translateY.value = withTiming(-winHeight);
          runOnJS(triggerImpact)();
        } else {
          translateY.value = withTiming(0);
        }
      });

    return gesture;
  }, [
    winHeight,
    isExpanded,
    translateY,
    context,
    scrollY,
    scrollViewContentHeight,
    scrollViewLayoutHeight,
    scrollableRef,
  ]);

  const scrollableGesture = useMemo(() => {
    const sGesture = Gesture.Native().shouldCancelWhenOutside(false);

    sGesture.simultaneousWithExternalGesture(panGesture);

    return sGesture;
  }, [panGesture]);

  const mainStyle = useAnimatedStyle(() => ({
    overflow: 'hidden',
    transform: [
      {
        translateY: translateY.value,
      },
    ],
  }));

  return {
    scrollableGesture,

    panGesture,

    scrollableRef,
    scrollViewContentHeight,
    scrollViewLayoutHeight,
    mainStyle,
  };
};
