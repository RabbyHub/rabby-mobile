import React, { useRef } from 'react';
import {
  Animated as RNAnimated,
  Dimensions,
  PanResponder,
  Text,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useAutoLockTime, useLastUnlockTime } from '@/hooks/appTimeout';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant/env';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';
import { usePasswordStatus } from '@/hooks/useLock';
import { colord } from 'colord';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import {
  useAutoLockTimeMinites,
  useFloatingView,
  useToggleShowAutoLockCountdown,
} from '@/hooks/appSettings';
import { TIME_SETTINGS } from '@/constant/autoLock';
import TouchableView from '@/components/Touchable/TouchableView';
import { RcIconLogo } from '@/assets/icons/common';

export function useAutoLockCountDown() {
  const { autoLockTime } = useAutoLockTime();
  const colors = useThemeColors();
  const [spinner, setSpinner] = React.useState(false);
  useInterval(() => {
    if (NEED_DEVSETTINGBLOCKS) {
      // trigger countDown re-calculated
      setSpinner(prev => !prev);
    }
  }, 500);

  const { text: countDownText, secs: countDownSecs } = React.useMemo(() => {
    spinner;
    const diffMs = Math.max(autoLockTime - Date.now(), 0);

    const timeSpans = getTimeSpanByMs(diffMs);

    return {
      secs: timeSpans.s,
      text: [
        timeSpans.d ? `${timeSpans.d}d` : '',
        timeSpans.h ? `${timeSpans.h}h` : '',
        timeSpans.m ? `${timeSpans.m}m` : '',
        timeSpans.s ? `${timeSpans.s}s` : '',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }, [autoLockTime, spinner]);

  const textColor = countDownText
    ? colors['green-default']
    : countDownSecs > 5
    ? colors['orange-default']
    : colors['red-default'];

  return {
    colors,
    textColor,
    autoLockTime,
    countDownText,
    countDownSecs,
  };
}

export function AutoLockCountDownLabel() {
  const { textColor, countDownText } = useAutoLockCountDown();
  const { showAutoLockCountdown } = useToggleShowAutoLockCountdown();

  return (
    <Text>
      {`${showAutoLockCountdown ? 'Show' : 'Hide'} Floating View`}
      {!showAutoLockCountdown && countDownText && (
        <>
          {' '}
          | Countdown:
          <Text
            style={{
              color: textColor,
            }}>
            {countDownText}
          </Text>
        </>
      )}
    </Text>
  );
}
function useCurrentAutoLockLabel() {
  const { autoLockMinutes } = useAutoLockTimeMinites();

  return React.useMemo(() => {
    const minutes = autoLockMinutes;

    const preset = TIME_SETTINGS.find(
      setting => setting.milliseconds === minutes * 60 * 1000,
    );
    if (preset?.label) return preset?.label;

    const timeSpans = getTimeSpan(minutes);

    return [
      timeSpans.d ? `${timeSpans.d} Day(s)` : '',
      timeSpans.h ? `${timeSpans.h} Hour(s)` : '',
      timeSpans.m ? `${timeSpans.m} Minute(s)` : '',
      // timeSpans.s ? `${timeSpans.s} Sec(s)` : '',
    ].join(' ');
  }, [autoLockMinutes]);
}
export function AutoLockSettingLabel() {
  const settingLabel = useCurrentAutoLockLabel();
  const colors = useThemeColors();
  const { isUseCustomPwd } = usePasswordStatus();

  if (!isUseCustomPwd) return null;

  return (
    <Text
      style={{
        color: colors['neutral-title1'],
        fontWeight: 'normal',
        fontSize: 14,
      }}>
      {settingLabel}
    </Text>
  );
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}
const VIEW_W = 240;
const DRAGGER_SIZE = 60;
const INIT_RIGHT = VIEW_W - DRAGGER_SIZE;
const INIT_LAYOUT = {
  top: 100,
  // left: Dimensions.get('window').width - INIT_RIGHT,
};
const screenLayout = Dimensions.get('screen');
export function FloatViewAutoLockCount() {
  const { styles } = useThemeStyles(getFloatViewAutoLockCountStyles);
  const { countDownText, textColor } = useAutoLockCountDown();
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
          <TouchableOpacity style={styles.dragger}>
            <RcIconLogo width={48} height={48} />
          </TouchableOpacity>
        </GestureDetector>
        <View pointerEvents="none" style={[styles.animatedView]}>
          {countDownText && <Text style={styles.label}>Auto Lock after </Text>}
          <Text style={{ color: textColor, fontWeight: '600' }}>
            {countDownText || 'Time Reached'}
          </Text>
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
      opacity: 0.5,
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

export function LastUnlockTimeLabel() {
  const { unlockTime } = useLastUnlockTime();

  const colors = useThemeColors();

  const [spinner, setSpinner] = React.useState(false);
  useInterval(() => {
    if (NEED_DEVSETTINGBLOCKS) {
      // trigger countDown re-calculated
      setSpinner(prev => !prev);
    }
  }, 500);

  const { text: timeOffset, mins } = React.useMemo(() => {
    spinner;
    const diffMs = Math.max(Date.now() - unlockTime, 0);

    const timeSpans = getTimeSpanByMs(diffMs);

    return {
      mins: timeSpans.m,
      text: [
        timeSpans.d ? `${timeSpans.d}d` : '',
        timeSpans.h ? `${timeSpans.h}h` : '',
        timeSpans.m ? `${timeSpans.m}m` : '',
        timeSpans.s ? `${timeSpans.s}s` : '',
      ].join(' '),
    };
  }, [unlockTime, spinner]);

  return (
    <Text
      style={{
        color:
          mins < 5
            ? colors['green-default']
            : mins < 8
            ? colors['orange-default']
            : colors['red-default'],
      }}>
      {timeOffset}
    </Text>
  );
}
