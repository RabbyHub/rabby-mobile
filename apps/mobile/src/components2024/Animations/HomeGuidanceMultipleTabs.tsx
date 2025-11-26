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
import { isEqual } from 'lodash';

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
  tabbarAbsLayout: AbsLayout | null;
  secondaryIndicatorAbsLayout: AbsLayout | null;
}>({
  visible: false,
  tabbarAbsLayout: null,
  secondaryIndicatorAbsLayout: null,
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

  const secondaryIndicatorViewRef = React.useRef<View>(null);
  const measureSecondaryIndicator = useCallback(() => {
    if (secondaryIndicatorViewRef.current) {
      secondaryIndicatorViewRef.current.measure(
        (x, y, width, height, pageX, pageY) => {
          setGuidance(prev => {
            const newLayout = { x, y, width, height, pageX, pageY };

            if (isEqual(prev.secondaryIndicatorAbsLayout, newLayout)) {
              return prev;
            }

            return {
              ...prev,
              secondaryIndicatorAbsLayout: {
                x,
                y,
                width,
                height,
                pageX,
                pageY,
              },
            };
          });
        },
      );
    }
  }, [setGuidance]);

  return {
    measureTabBarWrapper,
    homeGuidanceMultipleTabsTargetViewRef: viewRef,
    secondaryIndicatorViewRef,
    measureSecondaryIndicator,
  };
}

function useMeasuredLayoutForHomeGuidanceMultipleTabs() {
  const [guidance] = useAtom(guidanceAtom);
  // const { top } = useSafeAreaInsets();

  return {
    /** @deprecated */
    tabbarWrapperLayout: guidance.tabbarAbsLayout,
    secondaryIndicatorAbsLayout: guidance.secondaryIndicatorAbsLayout,
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
          // absLayout: AbsLayout;
          secondaryIndicatorAbsLayout: AbsLayout;
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
    outputRange: [30, 0],
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

        const anim = RNAnimated.timing(gestureAnimValue, {
          toValue: 1,
          duration: 500,
          easing: RNEasing.linear,
          useNativeDriver: true,
          delay,
        });
        RNAnimated.loop(RNAnimated.sequence([anim, RNAnimated.delay(300)]), {
          iterations: 2,
          resetBeforeIteration: true,
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
    // leave here for debug
    // if (__DEV__) return;
    // leave here for debug
    // if (!__DEV__) toggleViewedGuidance('multiTabs20251111Viewed', true);

    toggleGuidanceVisible(false);
    toggleViewedGuidance('multiTabs20251111Viewed', true);
  }, [toggleGuidanceVisible, toggleViewedGuidance]);

  const { secondaryIndicatorAbsLayout } =
    useMeasuredLayoutForHomeGuidanceMultipleTabs();

  const previousIndicatorWrapperLayout = usePrevious(
    secondaryIndicatorAbsLayout,
  );
  const pageY = useDebounceValue(
    secondaryIndicatorAbsLayout ? secondaryIndicatorAbsLayout.pageY : 0,
    50,
  );
  useLayoutEffect(() => {
    if (
      (!previousIndicatorWrapperLayout && secondaryIndicatorAbsLayout) ||
      pageY > 10
    ) {
      toggleGuidanceVisible(true);
      toggleGestureAnimation(true, {
        delay: 400,
        onFinished: () => {
          isomorphicCloseAnim();
        },
      });

      // return () => {
      //   clearTimeout(timer);
      // };
    }
  }, [
    previousIndicatorWrapperLayout,
    secondaryIndicatorAbsLayout,
    pageY,
    toggleGuidanceVisible,
    toggleGestureAnimation,
    isomorphicCloseAnim,
  ]);

  const beforeContentNode = useMemo(() => {
    if (!secondaryIndicatorAbsLayout) return null;

    if (typeof prop_beforeContentNode === 'function') {
      return prop_beforeContentNode({
        secondaryIndicatorAbsLayout,
      });
    }
    return (
      prop_beforeContentNode || (
        <DefaultBeforeNode
          secondaryIndicatorAbsLayout={secondaryIndicatorAbsLayout}
        />
      )
    );
  }, [prop_beforeContentNode, secondaryIndicatorAbsLayout]);

  const wrapperOpacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: wrapperOpacity.value,
    };
  }, []);

  const previousVisible = usePrevious(guidanceVisible);
  const debouncedVisible = useDebounceValue(guidanceVisible, 100);
  useEffect(() => {
    if (!guidanceVisible) {
      wrapperOpacity.value = withTiming(0, {
        duration: 250,
        easing: Easing.inOut(Easing.quad),
      });
    } else if (!previousVisible && guidanceVisible) {
      wrapperOpacity.value = withTiming(1, {
        duration: 250,
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
  //         console.debug('Pan gesture ended - perform hide guidance');
  //         runOnJS(isomorphicCloseAnim)();
  //       }
  //       panActivated.value = false;
  //     })
  //     .withTestId('panRightToLeftGesture');
  // }, [panActivated, isomorphicCloseAnim]);

  if (!secondaryIndicatorAbsLayout) return null;
  if (IS_IOS && !debouncedVisible) return null;

  return (
    // <GestureDetector gesture={panRightToLeftGesture} />
    <Animated.View
      pointerEvents={__DEV__ ? 'auto' : 'none'}
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(250)}
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
        // ...makeDebugBorder(),
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
  secondaryIndicatorAbsLayout,
}: {
  secondaryIndicatorAbsLayout: AbsLayout;
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
              height: secondaryIndicatorAbsLayout.height,
              width: secondaryIndicatorAbsLayout.width,
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
    // ...makeDebugBorder('yellow'),
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
