import React from 'react';
import { Dimensions, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { useAutoLockCountDown } from './LockAbout';
import { colord } from 'colord';
import { NEED_DEVSETTINGBLOCKS } from '@/constant';
import { useFloatingView } from '@/hooks/appSettings';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { RcIconLogo } from '@/assets/icons/common';
import AnimateableText from 'react-native-animateable-text';

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}
const VIEW_W = 240;
const DRAGGER_SIZE = 60;
const INIT_RIGHT = VIEW_W - DRAGGER_SIZE;
const INIT_LAYOUT = {
  top: 100,
};
const screenLayout = Dimensions.get('screen');
export function FloatViewAutoLockCount() {
  const { styles } = useThemeStyles(getFloatViewAutoLockCountStyles);
  const { devNeedCountdown, countdownTextStyles, countdownTextProps } =
    useAutoLockCountDown();
  const { collapsed, toggleCollapsed, shouldShow } = useFloatingView();

  const [translationX, translationY, prevTranslationX, prevTranslationY] = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translationY.value }],
    };
  });

  const composedGesture = React.useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        toggleCollapsed();
      });

    const pan = Gesture.Pan()
      .minDistance(5)
      .enabled(true)
      .runOnJS(true)
      .onStart(() => {
        prevTranslationX.value = translationX.value;
        prevTranslationY.value = translationY.value;
      })
      .onUpdate(event => {
        try {
          const maxTranslateX = screenLayout.width / 2 - 50;
          const maxTranslateY = screenLayout.height / 2 - 50;

          translationX.value = clamp(
            prevTranslationX.value + event.translationX,
            -maxTranslateX,
            maxTranslateX,
          );
          translationY.value = clamp(
            prevTranslationY.value + event.translationY,
            -maxTranslateY,
            maxTranslateY,
          );
        } catch (err: any) {
          console.error('onUpdate error', err?.message);
        }
      });

    const composed = Gesture.Race(...[pan, tap]);
    return composed;
  }, [
    toggleCollapsed,
    translationX,
    translationY,
    prevTranslationX,
    prevTranslationY,
  ]);

  if (!NEED_DEVSETTINGBLOCKS) return null;
  if (!shouldShow) return null;

  return (
    <GestureHandlerRootView
      style={[styles.gestureContainer, !collapsed && styles.containerExpanded]}>
      <Animated.View
        style={[
          styles.container,
          animatedStyles,
          // {
          //   top: dragPosRef.current.getLayout().top
          // },
        ]}>
        <GestureDetector gesture={composedGesture}>
          {/* dragger */}
          <TouchableWithoutFeedback style={styles.dragger}>
            <RcIconLogo width={48} height={48} />
          </TouchableWithoutFeedback>
        </GestureDetector>
        <View pointerEvents="none" style={[styles.animatedView]}>
          {devNeedCountdown && (
            <Text style={styles.label}>Auto Lock after </Text>
          )}
          <AnimateableText
            animatedProps={countdownTextProps}
            style={countdownTextStyles}
          />
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const getFloatViewAutoLockCountStyles = createGetStyles(colors => {
  return {
    gestureContainer: {
      flex: 1,
      position: 'absolute',
      // ...makeDebugBorder(),
      zIndex: 999,
      width: VIEW_W,
      top: INIT_LAYOUT.top,
      height: 60,
      right: -INIT_RIGHT,
    },
    container: {
      flex: 1,
      position: 'absolute',
      borderRadius: 6,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
    },
    dragger: {
      borderTopLeftRadius: 60,
      borderBottomLeftRadius: 60,
      height: 60,
      width: 60,
      flexShrink: 0,
      opacity: 0.9,
      backgroundColor: colors['blue-default'],
      // ...makeDebugBorder('yellow'),
      justifyContent: 'center',
      alignItems: 'center',
    },
    containerExpanded: {
      right: 0,
    },
    animatedView: {
      backgroundColor: colord('#000000').alpha(0.5).toRgbString(),
      flexShrink: 1,
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    label: {
      color: colord('#ffffff').alpha(0.8).toRgbString(),
    },
  };
});
