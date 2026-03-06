import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  AnimatedStyle,
  Easing,
  Extrapolate,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { RNGHFlatList, RNGHScrollView } from '../reexports';
import { useValueFromSharedValue } from '@/hooks/reanimated';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { triggerImpact } from '@/utils/common';
import { useMemoizedFn } from 'ahooks';

export const pulldownRefreshSizes = {
  homeHeaderHeight: Math.min(HOME_TOP_HEADER_SIZES.scrollableListTopOffset, 56),
};

const USE_PULL_REFRESH_INDICATOR_ON_ANDROID = false;
export const SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING =
  !IS_ANDROID || USE_PULL_REFRESH_INDICATOR_ON_ANDROID;

const AnimatedActivityIndicator =
  Animated.createAnimatedComponent(ActivityIndicator);

export function useIOSPulldownRefreshStates() {
  const pullDistance = useSharedValue(0);
  const svIsRefreshing = useSharedValue(false);

  return {
    pullDistance,
    svIsRefreshing,
  };
}

export const usePulldownRefreshGesture = <
  T extends ScrollView | RNGHScrollView | RNGHFlatList,
>({
  onRefreshOnJs: prop_onRefreshOnJs,
}: {
  onRefreshOnJs?: (ctx?: {}) => Promise<void>;
} = {}) => {
  const pullDistance = useSharedValue(0);
  const svIsRefreshing = useSharedValue(false);

  const onRefreshOnJs = useMemoizedFn(async () => {
    await prop_onRefreshOnJs?.({});
  });

  const startValues = useSharedValue({
    hasImpactOnPanup: false,
  });

  const panGestureRef = useRef(
    Gesture.Pan()
      .shouldCancelWhenOutside(false)
      .activeOffsetY([-8, 8])
      .maxPointers(1)
      .onStart(() => {})
      .onUpdate(event => {
        pullRefresh: {
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            !svIsRefreshing.value
          ) {
            pullDistance.value = Math.max(0, event.translationY);
            if (pullDistance.value >= pulldownRefreshSizes.homeHeaderHeight) {
              !startValues.value.hasImpactOnPanup && runOnJS(triggerImpact)();
              startValues.value.hasImpactOnPanup = true;
            }
          }
        }
      })
      .onEnd(() => {
        pullRefresh: {
          const hasImpactOnPanup = startValues.value.hasImpactOnPanup;
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            !svIsRefreshing.value
          ) {
            if (pullDistance.value >= pulldownRefreshSizes.homeHeaderHeight) {
              svIsRefreshing.value = true;
              setPulldownRefreshStage({
                state: 'refreshing',
                svIsRefreshing,
                pullDistance,
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
              });
              runOnJS(onRefreshOnJs)();
              !hasImpactOnPanup && runOnJS(triggerImpact)();
            } else {
              setPulldownRefreshStage({
                state: 'finished',
                svIsRefreshing,
                pullDistance,
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
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

    isRefreshing,
    pullDistance,
    svIsRefreshing,
  };
};

type HooksInputs = {
  states: ReturnType<typeof useIOSPulldownRefreshStates>;
  indicatorSpaceHeight: number;
  pullDistanceMaxValue?: number;
  // onRefreshOnJs?: () => void;
};
export const usePulldownRefreshStyles = ({
  states,
  indicatorSpaceHeight,
  pullDistanceMaxValue = 56,
}: HooksInputs) => {
  const scrHeight = Dimensions.get('screen').height;
  const { pullDistance, svIsRefreshing } = states;

  // rotate deg based on pullDistance, max rotate 360deg
  const animatedIndicatorStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      pullDistance.value,
      [0, pullDistanceMaxValue],
      [0, 360],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const scrollTopStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(
        pullDistance.value,
        [0, scrHeight * 0.5 - HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset],
        [0, scrHeight * 0.5 - HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset],
        Extrapolate.CLAMP,
      ),
      paddingTop: 0,
      // comment it on DEBUG
      opacity: interpolate(
        pullDistance.value,
        [0, indicatorSpaceHeight],
        [0, 1],
        Extrapolate.CLAMP,
      ),
    };
  });

  const isRefreshing = useValueFromSharedValue(svIsRefreshing);

  return {
    isRefreshing,
    animatedIndicatorStyle,
    scrollTopStyle,
  };
};

export const setPulldownRefreshStage = (input: {
  state: 'refreshing' | 'finished';
  indicatorSpaceHeight: number;
  svIsRefreshing: SharedValue<boolean>;
  pullDistance: SharedValue<number>;
}) => {
  'worklet';
  if (!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING) return;

  switch (input.state) {
    case 'refreshing': {
      input.svIsRefreshing.value = true;
      input.pullDistance.value = withTiming(input.indicatorSpaceHeight, {
        duration: 300,
        easing: Easing.inOut(Easing.quad),
      });
      break;
    }
    case 'finished': {
      input.svIsRefreshing.value = false;
      input.pullDistance.value = withTiming(0);
      break;
    }
  }
};

/**
 * This component addresses the following issues: Developers want to implement pull-to-refresh on iOS, which relies on UIRefreshControl and requires bounce={true} to be enabled on the React Native side, but don't want the following characteristics of bounces={true}:
 *
 * - Visual style: They don't want to see that "rubber band"-like bounce-back blank area after the list is pulled to the top.
 * - Interaction conflict: In some complex gestures (such as horizontal card swiping, custom header interactions), vertical bounce might interfere with gesture judgment.
 */
export function RefreshPlaceholderIOS({
  hooksReturn,
  animatedStyle,
  animatedIndicatorStyle: propAnimatedIndicatorStyle,
}: {
  hooksReturn: Omit<ReturnType<typeof usePulldownRefreshStyles>, 'panGesture'>;
  animatedStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  animatedIndicatorStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
}) {
  const { styles } = useTheme2024({ getStyle });

  if (IS_ANDROID) return null;

  const { isRefreshing, animatedIndicatorStyle, scrollTopStyle } = hooksReturn;

  return (
    <Animated.View
      style={[styles.scrollTopPlaceholder, scrollTopStyle, animatedStyle]}>
      <AnimatedActivityIndicator
        animating={isRefreshing}
        hidesWhenStopped={false}
        style={[animatedIndicatorStyle, propAnimatedIndicatorStyle]}
        size={IS_IOS ? 'small' : 'small'}
      />
    </Animated.View>
  );
}

const getStyle = createGetStyles2024(ctx => {
  return {
    scrollTopPlaceholder: {
      width: '100%',
      opacity: 1,
      height: 0,
      justifyContent: 'center',
      alignItems: 'center',
      // ...makeDebugBorder(),
    },
  };
});
