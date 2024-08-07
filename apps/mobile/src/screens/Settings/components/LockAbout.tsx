import React, { useRef } from 'react';
import { Text, View } from 'react-native';

import { useAutoLockTime, useLastUnlockTime } from '@/hooks/appTimeout';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant/env';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';
import { usePasswordStatus } from '@/hooks/useLock';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
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
