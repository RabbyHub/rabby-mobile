import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleProp,
  StyleSheet,
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
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { triggerImpact } from '@/utils/common';
import { useMemoizedFn } from 'ahooks';

export const pulldownRefreshSizes = {
  homeHeaderHeight: Math.min(HOME_TOP_HEADER_SIZES.scrollableListTopOffset, 56),
};

const PULLDOWN_REFRESH_FAIL_OFFSET_X = 24;
const scrHeight = Dimensions.get('screen').height;

export function isOverPulldownRefreshThreshold(pullDistance: number) {
  'worklet';
  return (
    pullDistance >=
    Math.min(scrHeight * 0.3, pulldownRefreshSizes.homeHeaderHeight + 55)
  );
}

const AnimatedActivityIndicator =
  Animated.createAnimatedComponent(ActivityIndicator);

// type IOSPulldownRefreshType = boolean | 'manual';

export function useIOSPulldownRefreshStates() {
  const pullDistance = useSharedValue(0);
  const svIsRefreshing = useSharedValue<boolean>(false);
  const svIsManualRefreshing = useSharedValue<boolean>(false);

  return {
    pullDistance,
    svIsRefreshing,
    svIsManualRefreshing,
  };
}

export type OnRefreshOnJs = (ctx: {
  // svIsRefreshing: SharedValue<IOSPulldownRefreshType>;
  svIsManualRefreshing: SharedValue<boolean>;
}) => Promise<void>;

export const usePulldownRefreshGesture = <
  T extends ScrollView | RNGHScrollView | RNGHFlatList,
>({
  scrollViewYValue,
  onJsPulldownRefresh: prop_onJsPulldownRefresh,
}: {
  scrollViewYValue: SharedValue<number>;
  onJsPulldownRefresh?: OnRefreshOnJs;
}) => {
  const { pullDistance, svIsRefreshing, svIsManualRefreshing } =
    useIOSPulldownRefreshStates();

  const onJsPulldownRefresh = useMemoizedFn(async () => {
    await prop_onJsPulldownRefresh?.({ svIsManualRefreshing });
  });

  const startValues = useSharedValue({
    startedAtTop: scrollViewYValue.value <= 5,
    hasImpactOnPanup: false,
  });

  const panGestureRef = useRef(
    Gesture.Pan()
      .shouldCancelWhenOutside(false)
      .activeOffsetY([-8, 8])
      .failOffsetX([
        -PULLDOWN_REFRESH_FAIL_OFFSET_X,
        PULLDOWN_REFRESH_FAIL_OFFSET_X,
      ])
      .maxPointers(1)
      .onStart(event => {
        startValues.value.startedAtTop = scrollViewYValue.value <= 5;
      })
      .onUpdate(event => {
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
        pullRefresh: {
          const hasImpactOnPanup = startValues.value.hasImpactOnPanup;
          if (
            SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING &&
            startValues.value.startedAtTop &&
            !svIsRefreshing.value
          ) {
            if (isOverPulldownRefreshThreshold(pullDistance.value)) {
              svIsRefreshing.value = true;
              setPulldownRefreshStage({
                state: 'refreshing',
                svIsRefreshing,
                svIsManualRefreshing,
                pullDistance,
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
              });
              runOnJS(onJsPulldownRefresh)();
              !hasImpactOnPanup &&
                runOnJS(triggerImpact)({ __DEV_ONLY__: true });
            } else {
              setPulldownRefreshStage({
                state: 'finished',
                svIsRefreshing,
                svIsManualRefreshing,
                pullDistance,
                indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
              });
            }
            startValues.value.hasImpactOnPanup = false;
          }
        }
      }),
  );

  const isRefreshingOrig = useValueFromSharedValue(svIsRefreshing);
  const isManualRefreshing = useValueFromSharedValue(svIsManualRefreshing);

  return {
    panGestureRef,
    isManualRefreshing: isManualRefreshing,
    isRefreshing: !!isRefreshingOrig,
    svs: {
      pullDistance,
      svIsRefreshing,
      svIsManualRefreshing,
    },
  };
};

type HooksInputs = {
  states: Pick<
    ReturnType<typeof useIOSPulldownRefreshStates>,
    'pullDistance' | 'svIsRefreshing' | 'svIsManualRefreshing'
  >;
  indicatorSpaceHeight: number;
  pullDistanceMaxValue?: number;
  // onJsPulldownRefresh?: () => void;
};
export const usePulldownRefreshStyles = ({
  states,
  indicatorSpaceHeight,
  pullDistanceMaxValue = 56,
}: HooksInputs) => {
  const scrHeight = Dimensions.get('screen').height;
  const { pullDistance, svIsRefreshing, svIsManualRefreshing } = states;

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
      // paddingTop: 0,
      // comment it on DEBUG
      opacity: interpolate(
        pullDistance.value,
        [0, indicatorSpaceHeight],
        [0, 1],
        Extrapolate.CLAMP,
      ),
    };
  });

  const refreshPlaceholderStyle = useAnimatedStyle(() => {
    return {
      paddingTop: !SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING
        ? 0
        : interpolate(
            pullDistance.value,
            [0, pulldownRefreshSizes.homeHeaderHeight],
            [HOME_TOP_HEADER_SIZES.headerOffsetAfterTabItem, 0],
            Extrapolate.CLAMP,
          ),
    };
  });

  const scrollableStyle = useMemo(() => {
    if (!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING) {
      return StyleSheet.create({
        container: {
          marginTop: HOME_TOP_HEADER_SIZES.scrollableListTopOffset,
        },
        list: {
          paddingTop: 0,
        },
      });
    }
    return StyleSheet.create({
      container: {
        marginTop: HOME_TOP_HEADER_SIZES.scrollableListTopOffset,
      },
      list: {
        // marginTop: HOME_TOP_HEADER_SIZES.scrollableListTopOffset,
        // paddingTop: HOME_TOP_HEADER_SIZES.headerOffsetAfterTabItem,
      },
    });
  }, []);

  const isRefreshing = useValueFromSharedValue(svIsRefreshing);
  const isManualRefreshing = useValueFromSharedValue(svIsManualRefreshing);

  return {
    isRefreshing,
    isManualRefreshing,
    scrollableStyle,
    animatedIndicatorStyle,
    scrollTopStyle,
    refreshPlaceholderStyle,
  };
};

export const setPulldownRefreshStage = (input: {
  state: 'refreshing' | 'finished';
  indicatorSpaceHeight: number;
  svIsRefreshing: SharedValue<boolean>;
  svIsManualRefreshing: SharedValue<boolean>;
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
      input.svIsManualRefreshing.value = false;
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
  __PICK_MANUAL__,
}: {
  hooksReturn: Omit<ReturnType<typeof usePulldownRefreshStyles>, 'panGesture'>;
  animatedStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  animatedIndicatorStyle?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  __PICK_MANUAL__?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });

  if (IS_ANDROID) return null;

  const {
    isRefreshing,
    isManualRefreshing,
    animatedIndicatorStyle,
    scrollTopStyle,
  } = hooksReturn;

  return (
    <Animated.View
      style={[styles.scrollTopPlaceholder, scrollTopStyle, animatedStyle]}>
      <AnimatedActivityIndicator
        animating={__PICK_MANUAL__ ? isManualRefreshing : isRefreshing}
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
