import { zCreate } from '@/core/utils/reexports';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { triggerImpact } from '@/utils/common';
import { useMemo, useRef, useState, useCallback } from 'react';
import {
  PanResponder,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { Gesture } from 'react-native-gesture-handler';
import {
  Extrapolate,
  interpolate,
  makeMutable,
  runOnJS,
  useAnimatedReaction,
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

export const PULL_THRESHOLD = 160;

export const homeDrawerAnimateMutable = {
  tabsOpacity: makeMutable(0),
  pullPercent: makeMutable(0),
  isExpanded: makeMutable(false),
  translateY: makeMutable(0),
};

export const useHomeAnimation = () => {
  const { isExpanded, translateY, pullPercent, tabsOpacity } =
    homeDrawerAnimateMutable;
  const { height } = useWindowDimensions();
  const scrollableRef = useRef<ScrollView>(null);
  const scrollY = useCurrentTabScrollY();
  const contentHeight = useSharedValue(0);
  const layoutHeight = useSharedValue(0);
  const [bounces, setBounces] = useState(true);

  const scrollToTop = useCallback(() => {
    scrollableRef.current?.scrollTo?.({ y: 0, animated: false });
  }, []);

  const showDappDrawer = useCallback(() => {
    translateY.value = withTiming(-height);
    runOnJS(triggerImpact)();
  }, [height, translateY]);

  useAnimatedReaction(
    () => translateY.value,
    value => {
      pullPercent.value = (value / height) * 100;
    },
  );

  useAnimatedReaction(
    () => pullPercent.value,
    value => {
      if (value === 0) {
        isExpanded.value = false;
      } else if (value === -100) {
        isExpanded.value = true;
        runOnJS(scrollToTop)();
      }

      tabsOpacity.value = interpolate(
        value,
        [-8, 0],
        [0, 1],
        Extrapolate.CLAMP,
      );
    },
    [],
  );

  const isAtBottom = useDerivedValue(() => {
    if (!contentHeight.value || !layoutHeight.value) {
      return false;
    }
    const maxOffset = Math.max(0, contentHeight.value - layoutHeight.value);
    return scrollY.value >= maxOffset;
  }, [scrollY]);

  // const panGesture = useMemo(() => {
  //   let gesture = Gesture.Pan()
  //     .shouldCancelWhenOutside(false)
  //     .onStart(() => {
  //       translateY.value = 0;
  //       isExpanded.value = false;
  //     })
  //     .onUpdate(event => {
  //       if (event.translationY > 0) {
  //         return;
  //       }

  //       translateY.value = event.translationY;
  //     })
  //     .onEnd(() => {
  //       if (translateY.value * -1 > PULL_THRESHOLD) {
  //         translateY.value = withTiming(-height);
  //         runOnJS(triggerImpact)();
  //       } else {
  //         translateY.value = withTiming(0);
  //       }
  //     });

  //   return gesture;
  // }, [height, isExpanded, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        return false;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return isAtBottom.value && gestureState.dy < -5;
      },
      onPanResponderGrant: () => {
        translateY.value = 0;
        isExpanded.value = false;
      },
      onPanResponderMove: (_, gestureState) => {
        console.log('gestureState.dy', gestureState.dy);
        if (!isAtBottom.value) {
          return;
        }
        // if (gestureState.dy > 0) {
        //   return;
        // }
        setBounces(false);
        translateY.value = gestureState.dy;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (translateY.value * -1 > PULL_THRESHOLD) {
          translateY.value = withTiming(-height);
          runOnJS(triggerImpact)();
        } else {
          translateY.value = withTiming(0);
        }
        setBounces(true);
      },
      onPanResponderTerminate: () => {
        translateY.value = withTiming(0);
        setBounces(true);
      },
    }),
  ).current;

  const mainStyle = useAnimatedStyle(() => ({
    overflow: 'hidden',
    transform: [
      {
        translateY: translateY.value,
      },
    ],
  }));

  return {
    // panGesture,
    panResponder,
    scrollableRef,
    bounces,
    contentHeight,
    layoutHeight,
    mainStyle,
    showDappDrawer,
  };
};
