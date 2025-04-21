import React from 'react';
import { Text, TextStyle } from 'react-native';

import { useAutoLockTime, useLastUnlockTime } from '@/hooks/appTimeout';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant/env';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';
import { usePasswordStatus } from '@/hooks/useLock';
import {
  useAutoLockTimeMinites,
  useToggleShowAutoLockCountdown,
} from '@/hooks/appSettings';
import { TIME_SETTINGS } from '@/constant/autoLock';

export function useAutoLockCountDown() {
  const { autoLockTime } = useAutoLockTime();
  const { colors2024 } = useTheme2024();
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
    ? colors2024['green-default']
    : countDownSecs > 5
    ? colors2024['orange-default']
    : colors2024['red-default'];

  return {
    colors: colors2024,
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
    if (preset?.getLabel) return preset?.getLabel();

    const timeSpans = getTimeSpan(minutes);

    return [
      timeSpans.d ? `${timeSpans.d} Day(s)` : '',
      timeSpans.h ? `${timeSpans.h} Hour(s)` : '',
      timeSpans.m ? `${timeSpans.m} Minute(s)` : '',
      // timeSpans.s ? `${timeSpans.s} Sec(s)` : '',
    ].join(' ');
  }, [autoLockMinutes]);
}
export function AutoLockSettingLabel({ style }: { style?: TextStyle }) {
  const settingLabel = useCurrentAutoLockLabel();
  const { isUseCustomPwd } = usePasswordStatus();

  if (!isUseCustomPwd) return null;

  return <Text style={style}>{settingLabel}</Text>;
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
