import { useEffect, useLayoutEffect, useRef } from 'react';
import { Animated, Easing, useAnimatedValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export const PERPS_PRO_ORDER_BOOK_PERCENT_ANIMATION = {
  durationMs: 250,
  easing: Easing.bezier(0, 0, 0.2, 1),
} as const;

type PercentPresentation = {
  animationIdentity: string;
  hasValue: boolean;
  valueIdentity: string;
};

type PreviousPercentPresentation = PercentPresentation & {
  targetPercent: number;
};

const normalizePercent = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

export const usePerpsProOrderBookPercentAnimation = ({
  animationIdentity,
  hasValue,
  targetPercent,
  valueIdentity,
}: PercentPresentation & { targetPercent: number }): Animated.Value => {
  const normalizedTarget = normalizePercent(targetPercent);
  const animatedPercent = useAnimatedValue(normalizedTarget, {
    useNativeDriver: true,
  });
  const reducedMotion = useReducedMotion();
  const previousPresentationRef = useRef<PreviousPercentPresentation | null>(
    null,
  );

  useLayoutEffect(() => {
    const previous = previousPresentationRef.current;
    const next = {
      animationIdentity,
      hasValue,
      targetPercent: normalizedTarget,
      valueIdentity,
    };
    previousPresentationRef.current = next;

    const canAnimate =
      previous?.hasValue === true &&
      hasValue &&
      previous.animationIdentity === animationIdentity &&
      previous.valueIdentity === valueIdentity;

    if (!canAnimate || reducedMotion) {
      // setValue cancels the previous native timing before snapping. Do not
      // asynchronously read back an old value when a newer snapshot arrives.
      animatedPercent.setValue(normalizedTarget);
      return;
    }

    if (previous.targetPercent === normalizedTarget) {
      return;
    }

    Animated.timing(animatedPercent, {
      toValue: normalizedTarget,
      duration: PERPS_PRO_ORDER_BOOK_PERCENT_ANIMATION.durationMs,
      easing: PERPS_PRO_ORDER_BOOK_PERCENT_ANIMATION.easing,
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [
    animatedPercent,
    animationIdentity,
    hasValue,
    normalizedTarget,
    reducedMotion,
    valueIdentity,
  ]);

  useEffect(
    () => () => {
      animatedPercent.stopAnimation();
    },
    [animatedPercent],
  );

  return animatedPercent;
};
