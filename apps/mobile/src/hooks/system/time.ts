import { getTimeSpanByMs } from '@/utils/time';
import { useInterval } from 'ahooks';
import {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme2024 } from '../theme';

function computeRest(futureTime: number) {
  'worklet';
  const diffMs = Math.max(futureTime - Date.now(), 0);
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

export function useRestCountDownLabel(options: {
  FUTURE_TIME: number;
  defaultText?: string;
}) {
  const { colors2024 } = useTheme2024();
  const { FUTURE_TIME, defaultText = '' } = options;
  const svCountdownSecs = useSharedValue(0);
  const svCountdownText = useSharedValue(defaultText);
  const svDiffMs = useSharedValue(0);

  useInterval(() => {
    const { diffMs, secs, text } = computeRest(FUTURE_TIME);
    svDiffMs.value = diffMs;
    svCountdownSecs.value = secs;
    svCountdownText.value = text;
  }, 900);

  /**
   * @description it's important to ref `colors2024` from `useTheme2024` rather than `apisTheme.getColors2024`
   * don't know why, maybe if we want to trigger AnimatedStyle re-compute, we need to make its `style` property updated
   */
  const countdownTextStyles = useAnimatedStyle(() => {
    return {
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'SF Pro Rounded',
      color:
        svDiffMs.value > 60 * 1e3
          ? colors2024['green-default']
          : svDiffMs.value > 30 * 1e3
          ? colors2024['orange-default']
          : colors2024['red-default'],
    };
  });

  const countdownTextProps = useAnimatedProps(() => {
    return {
      text: svDiffMs.value > 0 ? svCountdownText.value : defaultText,
    };
  });

  return {
    countdownTextStyles,
    countdownTextProps,
  };
}
