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
} from 'react-native';
import { atom, useAtom } from 'jotai';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
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
import { atomByMMKV } from '@/core/storage/mmkv';
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

type AbsLayout = {
  width: number;
  height: number;
  pageX: number;
  pageY: number;
};
const guidanceAtom = atom<{
  visible: boolean;
  layout: AbsLayout | null;
}>({
  visible: false,
  layout: null,
});

export function useMeasureLayoutForHomeGuidanceMultipleTabs<
  T extends View = View,
>() {
  const viewRef = React.useRef<T>(null);
  const [, setLayout] = useAtom(guidanceAtom);

  const doMeasure = React.useCallback(() => {
    if (viewRef.current) {
      viewRef.current.measure((x, y, width, height, pageX, pageY) => {
        // // leave here for debug
        // console.debug('HomeGuidanceMultipleTabs measured layout:', {
        //   pageX,
        //   pageY,
        // });
        setLayout(prev => ({
          ...prev,
          layout: { x, y, width, height, pageX, pageY },
        }));
      });
    }
  }, [setLayout]);

  return {
    doMeasure,
    HomeGuidanceMultipleTabsTargetViewRef: viewRef,
  };
}

function useMeasuredLayoutForHomeGuidanceMultipleTabs() {
  const [guidance] = useAtom(guidanceAtom);
  const { top } = useSafeAreaInsets();

  return {
    measuredLayout: guidance.layout,
    compuatedMeasuredLayout: !guidance.layout
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
      | ((ctx: { absLayout: AbsLayout }) => React.ReactNode);
  }
>(({ beforeContentNode: prop_beforeContentNode }, ref) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { guidanceVisible, toggleGuidanceVisible, toggleViewedGuidance } =
    useGuidanceMultipleTabsVisible();

  const gestureRotateValue = useRef(new RNAnimated.Value(0)).current;
  const gestureRotateProp = gestureRotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['30deg', '0deg'],
  });

  const toggleGestureAnimation = useCallback(
    (
      play: boolean,
      options?: {
        delay?: number;
        onFinished?: () => void;
      },
    ) => {
      const { delay = 0, onFinished } = options || {};
      if (play) {
        RNAnimated.timing(gestureRotateValue, {
          toValue: 1,
          duration: 500,
          easing: RNEasing.linear,
          useNativeDriver: true,
          delay,
        }).start(event => {
          if (event.finished) {
            onFinished?.();
            // gestureRotateValue.setValue(0);
          }
        });
      } else {
        gestureRotateValue.resetAnimation();
      }
    },
    [gestureRotateValue],
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

  const { measuredLayout } = useMeasuredLayoutForHomeGuidanceMultipleTabs();
  const previousLayout = usePrevious(measuredLayout);
  const pageY = useDebounceValue(measuredLayout ? measuredLayout.pageY : 0, 50);
  useLayoutEffect(() => {
    if ((!previousLayout && measuredLayout) || pageY > 10) {
      const timer = setTimeout(() => {
        toggleGuidanceVisible(true);
        toggleGestureAnimation(true, {
          delay: 500,
        });
      }, 400);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    previousLayout,
    measuredLayout,
    pageY,
    toggleGuidanceVisible,
    toggleGestureAnimation,
  ]);

  const beforeContentNode = useMemo(() => {
    if (!measuredLayout) return null;
    if (typeof prop_beforeContentNode === 'function') {
      return prop_beforeContentNode({ absLayout: measuredLayout });
    }
    return prop_beforeContentNode || <DefaultBeforeNode />;
  }, [prop_beforeContentNode, measuredLayout]);

  const opacityValue = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacityValue.value,
    };
  }, []);

  const previousVisible = usePrevious(guidanceVisible);
  useEffect(() => {
    if (!previousVisible && guidanceVisible) {
      opacityValue.value = withTiming(1, { duration: 300 });
    } else if (!guidanceVisible) {
      opacityValue.value = withTiming(0, { duration: 300 });
    }
  }, [previousVisible, guidanceVisible, opacityValue]);

  const onSwipeEnd = useCallback(() => {
    // console.debug('Pan gesture ended - perform hide guidance');
    toggleGuidanceVisible(false);
    toggleViewedGuidance('multiTabs20251111Viewed', true);
  }, [toggleGuidanceVisible, toggleViewedGuidance]);

  const panActivated = useSharedValue(false);
  const panRightToLeftGesture = useMemo(() => {
    return Gesture.Pan()
      .onStart(() => {
        panActivated.value = false;
      })
      .onUpdate(evt => {
        if (
          Math.abs(evt.translationX) > 50 ||
          Math.abs(evt.translationY) > 50
        ) {
          panActivated.value = true;
        }
      })
      .onEnd(evt => {
        if (panActivated.value) {
          runOnJS(onSwipeEnd)();
        }
        panActivated.value = false;
      })
      .withTestId('panRightToLeftGesture');
  }, [panActivated, onSwipeEnd]);

  if (!measuredLayout) return null;
  if (!previousVisible && !guidanceVisible) return null;

  return (
    <GestureDetector gesture={panRightToLeftGesture}>
      <Animated.View
        style={[styles.container, styles.containerMask, animatedStyle]}
        entering={FadeIn.duration(300).easing(Easing.inOut(Easing.quad))}
        exiting={FadeOut.delay(300)
          .duration(300)
          .easing(Easing.inOut(Easing.quad))}>
        <View
          style={[
            styles.content,
            {
              top: pageY,
            },
          ]}>
          {beforeContentNode || null}

          <View
            style={{
              marginTop: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <RcIconMultiTabArrow
              color={colors2024['neutral-InvertHighlight']}
              style={{ marginBottom: 4 }}
            />
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
                    delay: 0,
                  });
                }}>
                <RcIconMultiTabGestureCC
                  color={colors2024['neutral-InvertHighlight']}
                />
              </TouchableOpacity>
            </RNAnimated.View>
            <Text style={styles.swipeText}>
              {/* Swipe right to view all assets */}
              {t(
                'page.nextComponent.homeGuidanceMultipleTabs.swipeToViewAllAssets',
              )}
            </Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
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
      swipeText: {
        color: colors2024['neutral-InvertHighlight'],
        fontFamily: 'SF Pro Rounded',
        fontSize: 16,
        fontStyle: 'normal',
        fontWeight: 700,
        lineHeight: 20,

        marginTop: 16,
      },
    };
  },
);

function DefaultBeforeNode() {
  const { styles } = useTheme2024({ getStyle: gestDefaultBeforeNodeStyle });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dev only: Render Node Here</Text>
    </View>
  );
}

const gestDefaultBeforeNodeStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 54,
    width: '100%',
    // backgroundColor: colors2024['neutral-bg-2'],
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors2024['neutral-info'],
    justifyContent: 'center',
    alignItems: 'center',
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
