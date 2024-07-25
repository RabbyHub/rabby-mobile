import React from 'react';
import { Text } from 'react-native';

import {
  useAutoLockTimeout,
  useCurrentAutoLockLabel,
} from '@/hooks/appSettings';
import { useThemeColors } from '@/hooks/theme';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant/env';
import { getTimeSpanByMs } from '@/utils/time';

export function AutoLockCountDownLabel() {
  const { autoLockTimeout } = useAutoLockTimeout();

  const colors = useThemeColors();

  const [spinner, setSpinner] = React.useState(false);
  useInterval(() => {
    if (NEED_DEVSETTINGBLOCKS) {
      // trigger countDown re-calculated
      setSpinner(prev => !prev);
    }
  }, 500);

  const { text: countDown, secs } = React.useMemo(() => {
    spinner;
    const diffMs = Math.max(autoLockTimeout - Date.now(), 0);

    const timeSpans = getTimeSpanByMs(diffMs);

    return {
      secs: timeSpans.s,
      text: [
        timeSpans.d ? `${timeSpans.d}d` : '',
        timeSpans.h ? `${timeSpans.h}h` : '',
        timeSpans.m ? `${timeSpans.m}m` : '',
        timeSpans.s ? `${timeSpans.s}s` : '',
      ].join(' '),
    };
  }, [autoLockTimeout, spinner]);

  return (
    <Text
      style={{
        color: countDown
          ? colors['green-default']
          : secs > 5
          ? colors['orange-default']
          : colors['red-default'],
      }}>
      {countDown}
    </Text>
  );
}

export function AutoLockSettingLabel() {
  const settingLabel = useCurrentAutoLockLabel();

  const colors = useThemeColors();

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
