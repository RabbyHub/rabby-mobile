import { TextInput } from '@/components/Typography';
import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const PerpsProAnimatedPriceTextInput =
  Animated.createAnimatedComponent(TextInput);

export const PERPS_PRO_PRICE_FILL_ANIMATION = {
  durationMs: 180,
  endFontSize: 14,
  endLineHeight: 18,
  startFontSize: 18,
  startLineHeight: 22,
} as const;

export const usePerpsProPriceFillAnimation = (fillRevision = 0) => {
  const previousFillRevisionRef = useRef(fillRevision);
  const fillProgress = useSharedValue(1);
  const animatedInputStyle = useAnimatedStyle(() => ({
    fontSize:
      PERPS_PRO_PRICE_FILL_ANIMATION.startFontSize +
      (PERPS_PRO_PRICE_FILL_ANIMATION.endFontSize -
        PERPS_PRO_PRICE_FILL_ANIMATION.startFontSize) *
        fillProgress.value,
    lineHeight:
      PERPS_PRO_PRICE_FILL_ANIMATION.startLineHeight +
      (PERPS_PRO_PRICE_FILL_ANIMATION.endLineHeight -
        PERPS_PRO_PRICE_FILL_ANIMATION.startLineHeight) *
        fillProgress.value,
  }));

  useEffect(() => {
    const previousRevision = previousFillRevisionRef.current;
    previousFillRevisionRef.current = fillRevision;
    if (fillRevision <= 0 || fillRevision === previousRevision) {
      return;
    }
    cancelAnimation(fillProgress);
    fillProgress.value = 0;
    fillProgress.value = withTiming(1, {
      duration: PERPS_PRO_PRICE_FILL_ANIMATION.durationMs,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [fillProgress, fillRevision]);

  return animatedInputStyle;
};
