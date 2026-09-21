// 刷新后如果数字没变，就临时把最后一位可见数字减 1”的效果。

import React from 'react';
import {
  makeMutable,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import AnimatedTickerText from './AnimatedTickerText';
import {
  nudgeLastVisibleDigitText,
  shouldNudgeRefreshText,
} from './RefreshNudgedTickerText.utils';

const FLASH_DURATION = 320;
const svRefreshCaptureToken = makeMutable(0);
const svRefreshFlashToken = makeMutable(0);
const svRefreshFlashActive = makeMutable(false);
let refreshToken = 0;
let flashTimer: ReturnType<typeof setTimeout> | undefined;

export const startAnimatedTickerRefreshNudge = () => {
  refreshToken += 1;
  svRefreshCaptureToken.value = refreshToken;
  return refreshToken;
};

export const endAnimatedTickerRefreshNudge = (token?: number) => {
  svRefreshFlashToken.value = token ?? svRefreshCaptureToken.value;
  svRefreshFlashActive.value = true;

  if (flashTimer) {
    clearTimeout(flashTimer);
  }
  flashTimer = setTimeout(() => {
    svRefreshFlashActive.value = false;
    flashTimer = undefined;
  }, FLASH_DURATION);
};

export const withAnimatedTickerRefreshNudge = async <T,>(
  task: () => T | Promise<T>,
) => {
  const token = startAnimatedTickerRefreshNudge();
  const result = await task();
  endAnimatedTickerRefreshNudge(token);
  return result;
};

type Props = React.ComponentProps<typeof AnimatedTickerText>;

const RefreshNudgedTickerText = ({
  value,
  maxLength = 16,
  ...props
}: Props) => {
  const capturedText = useSharedValue('');
  const capturedToken = useSharedValue(0);

  useAnimatedReaction(
    () => svRefreshCaptureToken.value,
    token => {
      if (!token) {
        return;
      }
      capturedToken.value = token;
      capturedText.value = value.value || '';
    },
    [value],
  );

  const displayValue = useDerivedValue(() => {
    const text = value.value || '';

    if (
      !svRefreshFlashActive.value ||
      capturedToken.value !== svRefreshFlashToken.value ||
      !shouldNudgeRefreshText(capturedText.value, text, maxLength)
    ) {
      return text;
    }

    return nudgeLastVisibleDigitText(text, maxLength);
  }, [maxLength]);

  return (
    <AnimatedTickerText {...props} value={displayValue} maxLength={maxLength} />
  );
};

export default React.memo(RefreshNudgedTickerText);
