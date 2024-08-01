import React from 'react';
import { Animated, PanResponder, Text, View } from 'react-native';

import { useAutoLockTime, useLastUnlockTime } from '@/hooks/appTimeout';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant/env';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';
import { usePasswordStatus } from '@/hooks/useLock';
import { colord } from 'colord';
import { createGetStyles } from '@/utils/styles';
import {
  useAutoLockTimeMinites,
  useToggleShowAutoLockCountdown,
} from '@/hooks/appSettings';
import { TIME_SETTINGS } from '@/constant/autoLock';

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
  const { showAutoLockCountdown, toggleShowAutoLockCountdown } =
    useToggleShowAutoLockCountdown();

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

export function FloatViewAutoLockCount() {
  const { styles } = useThemeStyles(getFloatViewAutoLockCountStyles);
  const { countDownText, textColor } = useAutoLockCountDown();
  const { showAutoLockCountdown } = useToggleShowAutoLockCountdown();

  // const panResponder = React.useMemo(() => {
  //   const notPrevent = () => {
  //     return false;
  //   };
  //   return PanResponder.create({
  //     onMoveShouldSetPanResponderCapture: notPrevent,
  //     onPanResponderTerminationRequest: notPrevent,
  //     onStartShouldSetPanResponderCapture: notPrevent,
  //   });
  // }, []);

  if (!NEED_DEVSETTINGBLOCKS) return null;
  if (!showAutoLockCountdown) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View style={[styles.animatedView]}>
        {countDownText && <Text style={styles.label}>Auto Lock after </Text>}
        <Text style={{ color: textColor, fontWeight: '600' }}>
          {countDownText || 'Time Reached'}
        </Text>
      </Animated.View>
    </View>
  );
}

const getFloatViewAutoLockCountStyles = createGetStyles(colors => {
  return {
    container: {
      flex: 1,
      position: 'absolute',
      top: 50,
      right: 50,
      zIndex: 999,
      width: 180,
      height: 60,
      borderRadius: 6,
      // backgroundColor: colord(colors['blue-default']).alpha(0.4).toRgbString(),
      backgroundColor: colord('#000000').alpha(0.5).toRgbString(),
      opacity: 0.8,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    animatedView: {
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
