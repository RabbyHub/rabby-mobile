import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const PERPS_PRO_ORDER_BOOK_PERCENT_ANIMATION = {
  durationMs: 200,
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
}: PercentPresentation & { targetPercent: number }) => {
  const normalizedTarget = normalizePercent(targetPercent);
  const animatedPercent = useSharedValue(normalizedTarget);
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

    if (!canAnimate) {
      cancelAnimation(animatedPercent);
      animatedPercent.value = normalizedTarget;
      return;
    }

    if (previous.targetPercent === normalizedTarget) {
      return;
    }

    animatedPercent.value = withTiming(normalizedTarget, {
      duration: PERPS_PRO_ORDER_BOOK_PERCENT_ANIMATION.durationMs,
      easing: PERPS_PRO_ORDER_BOOK_PERCENT_ANIMATION.easing,
      reduceMotion: ReduceMotion.System,
    });
  }, [
    animatedPercent,
    animationIdentity,
    hasValue,
    normalizedTarget,
    valueIdentity,
  ]);

  useEffect(
    () => () => {
      cancelAnimation(animatedPercent);
    },
    [animatedPercent],
  );

  return animatedPercent;
};
