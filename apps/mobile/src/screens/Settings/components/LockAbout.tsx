import React from 'react';
import { Text, TextStyle } from 'react-native';

import {
  getAutoLockExpireTime,
  useAutoLockTime,
  useLastUnlockedAuth,
} from '@/hooks/appTimeout';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant';
import { getTimeSpan, getTimeSpanByMs } from '@/utils/time';
import { usePasswordStatus } from '@/hooks/useLock';
import { useToggleShowAutoLockCountdown } from '@/hooks/appSettings';
import { TIME_SETTINGS } from '@/constant/autoLock';
import { apisAutoLock } from '@/core/apis';
import {
  makeMutable,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import AnimateableText from 'react-native-animateable-text';

function computeCountDown(autoLockTime: number) {
  'worklet';
  if (!apisAutoLock.isValidAutoLockTime(autoLockTime)) {
    return { secs: -1, text: '∞', diffMs: -1 };
  }
  const diffMs = Math.max(autoLockTime - Date.now(), 0);

  const timeSpans = getTimeSpanByMs(diffMs);

  return {
    diffMs,
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
}

const countdownSecs = makeMutable(0);
const countdownText = makeMutable('');
const svDiffMs = makeMutable(0);
setInterval(() => {
  if (NEED_DEVSETTINGBLOCKS) {
    // trigger countDown re-calculated
    const computed = computeCountDown(getAutoLockExpireTime());
    countdownSecs.value = computed.secs;
    countdownText.value = computed.text;
    svDiffMs.value = computed.diffMs;
  }
}, 500);

export function useAutoLockCountDown() {
  const { devNeedCountdown } = useAutoLockTime();
  const { colors2024 } = useTheme2024();

  const countdownTextStyles = useAnimatedStyle(() => {
    return {
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color:
        svDiffMs.value > 60 * 1e3
          ? colors2024['green-default']
          : svDiffMs.value > 5 * 1e3
          ? colors2024['orange-default']
          : colors2024['red-default'],
    };
  });

  const countdownTextProps = useAnimatedProps(() => {
    return {
      text: !devNeedCountdown ? '' : countdownText.value,
    };
  });

  return {
    devNeedCountdown,
    countdownTextStyles,
    countdownTextProps,
  };
}

function useCurrentAutoLockLabel() {
  const { timeoutMs } = useAutoLockTime();

  return React.useMemo(() => {
    const preset = TIME_SETTINGS.find(
      setting => setting.milliseconds === timeoutMs,
    );

    return preset?.getLabel() || '-';
  }, [timeoutMs]);
}
export function AutoLockSettingLabel({ style }: { style?: TextStyle }) {
  const settingLabel = useCurrentAutoLockLabel();
  const { isUseCustomPwd } = usePasswordStatus();

  if (!isUseCustomPwd) return null;

  return <Text style={style}>{settingLabel}</Text>;
}

export function LastUnlockTimeLabel() {
  const { unlockTime } = useLastUnlockedAuth();

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
