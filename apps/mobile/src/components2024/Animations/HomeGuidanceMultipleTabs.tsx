import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  LayoutRectangle,
  Text,
  View,
  Animated as RNAnimated,
  Easing as RNEasing,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { atom, useAtom } from 'jotai';

// import LottieView from 'lottie-react-native';

import { useTheme2024 } from '@/hooks/theme';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { IS_IOS } from '@/core/native/utils';

import RcIconMultiTabGestureCC from './icons/MultiTabGesture-cc.svg';
import RcIconMultiTabArrow from './icons/MultiTabArrow.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Gesture,
  GestureDetector,
  Pressable,
} from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import usePrevious from 'react-use/lib/usePrevious';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useGuidanceShown } from './hooks';
import useDebounceValue from '@/hooks/common/useDebounceValue';
import { getLottieAnimationDurationInMS } from '@/utils/time';

// import AnimSwipeRightToViewAllAssets from './animations/swipe-right-to-view-all-assets.json';
// const MS_PLAY_ONCE = getLottieAnimationDurationInMS(
//   AnimSwipeRightToViewAllAssets,
//   {
//     frameCountFallback: 70,
//     frameRateFallback: 25,
//   },
// );

type AbsLayout = {
  width: number;
  height: number;
  pageX: number;
  pageY: number;
};
const guidanceAtom = atom<{
  visible: boolean;
  layout: AbsLayout | null;
  rightBarLayout: LayoutRectangle | null;
}>({
  visible: false,
  layout: null,
  rightBarLayout: null,
});

export function useMeasureLayoutForHomeGuidanceMultipleTabs<
  T extends View = View,
>() {
  const viewRef = React.useRef<T>(null);
  const [, setGuidance] = useAtom(guidanceAtom);

  const measureTabBarWrapper = React.useCallback(() => {
    if (viewRef.current) {
      viewRef.current.measure((x, y, width, height, pageX, pageY) => {
        // // leave here for debug
        // console.debug('HomeGuidanceMultipleTabs measured layout:', {
        //   pageX,
        //   pageY,
        // });
        setGuidance(prev => ({
          ...prev,
          layout: { x, y, width, height, pageX, pageY },
        }));
      });
    }
  }, [setGuidance]);

  const updateRightBarLayout = React.useCallback(
    (layout: LayoutRectangle) => {
      setGuidance(prev => ({
        ...prev,
        rightBarLayout: layout,
      }));
    },
    [setGuidance],
  );

  return {
    measureTabBarWrapper,
    homeGuidanceMultipleTabsTargetViewRef: viewRef,
    updateRightBarLayout,
  };
}

function useMeasuredLayoutForHomeGuidanceMultipleTabs() {
  const [guidance] = useAtom(guidanceAtom);
  const { top } = useSafeAreaInsets();

  return {
    tabbarWrapperLayout: guidance.layout,
    rightBarLayout: guidance.rightBarLayout,
    computedMeasuredLayout: !guidance.layout
      ? {
          pageX: 0,
          pageY: top,
          width: 0,
          height: 0,
        }
      : {
          ...guidance.layout,
        },
  };
}

function useGuidanceMultipleTabsVisible() {
  const [{ visible }, setGuidance] = useAtom(guidanceAtom);

  const toggleGuidanceVisible = useCallback(
    (visible: boolean) => {
      setGuidance(prev => ({
        ...prev,
        visible,
      }));
    },
    [setGuidance],
  );

  const { multiTabs20251111Viewed, toggleViewedGuidance } = useGuidanceShown();

  return {
    guidanceVisible: !multiTabs20251111Viewed && visible,
    toggleGuidanceVisible,
    toggleViewedGuidance,
  };
}

export type HomeGuidanceMultipleTabs = {
  play(): void;
};
export const HomeGuidanceMultipleTabs = React.forwardRef<
  HomeGuidanceMultipleTabs,
  {
    beforeContentNode?:
      | React.ReactNode
      | ((ctx: {
          absLayout: AbsLayout;
          rightBarLayout: LayoutRectangle;
        }) => React.ReactNode);
  }
>(({ beforeContentNode: prop_beforeContentNode }, ref) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { guidanceVisible, toggleGuidanceVisible, toggleViewedGuidance } =
    useGuidanceMultipleTabsVisible();

  const gestureAnimValue = useRef(new RNAnimated.Value(0)).current;
  const gestureRotateProp = gestureAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['30deg', '0deg'],
  });
  const gestureTranslateXProp = gestureAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const toggleGestureAnimation = useCallback(
    (
      play: boolean,
      options?: {
        __resetValueFirst__?: boolean;
        delay?: number;
        onFinished?: () => void;
      },
    ) => {
      const {
        __resetValueFirst__ = false,
        delay = 0,
        onFinished,
      } = options || {};
      if (play) {
        if (__resetValueFirst__) gestureAnimValue.setValue(0);

        RNAnimated.timing(gestureAnimValue, {
          toValue: 1,
          duration: 500,
          easing: RNEasing.linear,
          useNativeDriver: true,
          delay,
        }).start(event => {
          if (event.finished) {
            onFinished?.();
            // gestureAnimValue.setValue(0);
          }
        });
      } else {
        gestureAnimValue.resetAnimation();
      }
    },
    [gestureAnimValue],
  );

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        toggleGestureAnimation(true);
      },
    }),
    [toggleGestureAnimation],
  );

  const isomorphicCloseAnim = useCallback(() => {
    console.debug('Pan gesture ended - perform hide guidance');
    // if (__DEV__) return;

    toggleGuidanceVisible(false);
    toggleViewedGuidance('multiTabs20251111Viewed', true);
  }, [toggleGuidanceVisible, toggleViewedGuidance]);

  const { tabbarWrapperLayout, rightBarLayout } =
    useMeasuredLayoutForHomeGuidanceMultipleTabs();
  const previousTabbarWrapperLayout = usePrevious(tabbarWrapperLayout);
  const pageY = useDebounceValue(
    tabbarWrapperLayout ? tabbarWrapperLayout.pageY : 0,
    50,
  );
  useLayoutEffect(() => {
    if ((!previousTabbarWrapperLayout && tabbarWrapperLayout) || pageY > 10) {
      const timer = setTimeout(() => {
        toggleGuidanceVisible(true);
        toggleGestureAnimation(true, {
          delay: 500,
          onFinished: () => {
            isomorphicCloseAnim();
          },
        });
      }, 400);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    previousTabbarWrapperLayout,
    tabbarWrapperLayout,
    pageY,
    toggleGuidanceVisible,
    toggleGestureAnimation,
    isomorphicCloseAnim,
  ]);

  const beforeContentNode = useMemo(() => {
    if (!tabbarWrapperLayout) return null;
    if (!rightBarLayout) return null;
    if (typeof prop_beforeContentNode === 'function') {
      return prop_beforeContentNode({
        absLayout: tabbarWrapperLayout,
        rightBarLayout,
      });
    }
    return (
      prop_beforeContentNode || (
        <DefaultBeforeNode rightBarLayout={rightBarLayout} />
      )
    );
  }, [prop_beforeContentNode, tabbarWrapperLayout, rightBarLayout]);

  const wrapperOpacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: wrapperOpacity.value,
    };
  }, []);

  const previousVisible = usePrevious(guidanceVisible);
  const debouncedVisible = useDebounceValue(guidanceVisible, 300);
  useEffect(() => {
    if (!previousVisible && guidanceVisible) {
      wrapperOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.inOut(Easing.quad),
      });
    } else if (!guidanceVisible) {
      wrapperOpacity.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.quad),
      });
    }
  }, [previousVisible, guidanceVisible, wrapperOpacity]);

  // const panActivated = useSharedValue(false);
  // const panRightToLeftGesture = useMemo(() => {
  //   return Gesture.Pan()
  //     .onStart(() => {
  //       panActivated.value = false;
  //     })
  //     .onUpdate(evt => {
  //       if (
  //         Math.abs(evt.translationX) > 50 ||
  //         Math.abs(evt.translationY) > 50
  //       ) {
  //         panActivated.value = true;
  //       }
  //     })
  //     .onEnd(evt => {
  //       if (panActivated.value) {
  //         runOnJS(isomorphicCloseAnim)();
  //       }
  //       panActivated.value = false;
  //     })
  //     .withTestId('panRightToLeftGesture');
  // }, [panActivated, isomorphicCloseAnim]);

  if (!tabbarWrapperLayout) return null;
  if (!debouncedVisible) return null;

  return (
    // <GestureDetector gesture={panRightToLeftGesture} />
    <Animated.View
      pointerEvents={__DEV__ ? 'auto' : 'none'}
      style={[
        styles.container,
        styles.containerMask,
        animatedStyle,
        !debouncedVisible && { zIndex: -1 },
      ]}>
      <View
        style={[
          styles.content,
          {
            top: pageY,
          },
        ]}>
        {beforeContentNode || null}

        <View style={styles.gestureAnimContainer}>
          {/* <LottieView
              // ref={animationRef}
              source={AnimSwipeRightToViewAllAssets}
              style={StyleSheet.flatten([
                styles.animationLottie,
                {
                  width: 208,
                  height: 451,
                  ...makeDebugBorder(),
                  ...makeDevOnlyStyle({
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  }),
                },
              ])}
              loop={false}
              duration={MS_PLAY_ONCE}
              autoPlay
              {...(__DEV__ && {
                loop: true,
                autoPlay: true,
              })}
            /> */}
          <RNAnimated.View
            style={[
              {
                marginBottom: 4,
                transform: [
                  {
                    translateX: gestureTranslateXProp,
                  },
                ],
              },
            ]}>
            <RcIconMultiTabArrow
              color={colors2024['neutral-InvertHighlight']}
            />
          </RNAnimated.View>
          <RNAnimated.View
            style={{
              transform: [{ rotate: gestureRotateProp }],
            }}>
            <TouchableOpacity
              disabled={!__DEV__}
              activeOpacity={1}
              onPress={evt => {
                evt.stopPropagation();
                toggleGestureAnimation(true, {
                  __resetValueFirst__: true,
                  delay: 0,
                });
              }}>
              <RcIconMultiTabGestureCC
                color={colors2024['neutral-InvertHighlight']}
              />
            </TouchableOpacity>
          </RNAnimated.View>
          <Text style={styles.swipeText}>
            {t(
              'page.nextComponent.homeGuidanceMultipleTabs.swipeToViewAllAssets',
            )}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, bottomSafeArea }) => {
    return {
      container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: IS_IOS ? -1 : 1,
      },
      absEle: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      containerMask: {
        backgroundColor: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.6)',
      },
      content: {
        position: 'absolute',
        width: '100%',
        paddingTop: 0,
        justifyContent: 'center',
        alignItems: 'center',
        // ...makeDebugBorder(),
      },
      gestureAnimContainer: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
      },
      swipeText: {
        color: colors2024['neutral-InvertHighlight'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 16,
        fontStyle: 'normal',
        fontWeight: 700,
        lineHeight: 20,

        marginTop: 16,
      },
      animationLottie: {
        width: '100%',
        height: '100%',
        flex: 1,
      },
    };
  },
);

function DefaultBeforeNode({
  rightBarLayout,
}: {
  rightBarLayout: LayoutRectangle;
}) {
  const { styles } = useTheme2024({ getStyle: getDefaultBeforeNodeStyle });

  return (
    <View style={styles.container}>
      {/* <Text style={styles.text}>Dev only: Render Node Here</Text> */}
      <View style={styles.containerInner}>
        <View
          style={[
            styles.rightBarHighlight,
            {
              height: rightBarLayout.height,
              width: rightBarLayout.width,
              borderRadius: 12,
            },
          ]}
        />
      </View>
    </View>
  );
}

export const HOME_TABBAR_SIZES = {
  portfolioContainerPx: 16,
};

const getDefaultBeforeNodeStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 6,
    width: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: HOME_TABBAR_SIZES.portfolioContainerPx,
    // ...makeDebugBorder(),
  },
  containerInner: {
    position: 'relative',
    height: '100%',
    width: '100%',
    // ...makeDebugBorder(),
  },
  rightBarHighlight: {
    position: 'absolute',
    right: 0,
    backgroundColor: colors2024['neutral-line'],
  },
  text: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: 700,
    lineHeight: 20,
  },
}));
