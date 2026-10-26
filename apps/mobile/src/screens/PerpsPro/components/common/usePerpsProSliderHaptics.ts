import { useCallback, useEffect, useRef } from 'react';

import { triggerPerpsProLightHaptic } from './triggerPerpsProLightHaptic';

export const PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS = 80;

const getPerpsProSliderStepIndex = ({
  maximumValue,
  minimumValue,
  step,
  value,
}: {
  maximumValue: number;
  minimumValue: number;
  step: number;
  value: number;
}) => {
  const range = maximumValue - minimumValue;
  if (
    !Number.isFinite(range) ||
    range <= 0 ||
    !Number.isFinite(step) ||
    step <= 0 ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const clampedValue = Math.max(minimumValue, Math.min(maximumValue, value));
  return Math.round((clampedValue - minimumValue) / step);
};

export const changesPerpsProSliderStep = ({
  maximumValue,
  minimumValue,
  nextValue,
  previousValue,
  step,
}: {
  maximumValue: number;
  minimumValue: number;
  nextValue: number;
  previousValue: number;
  step: number;
}) => {
  const previousStepIndex = getPerpsProSliderStepIndex({
    maximumValue,
    minimumValue,
    step,
    value: previousValue,
  });
  const nextStepIndex = getPerpsProSliderStepIndex({
    maximumValue,
    minimumValue,
    step,
    value: nextValue,
  });

  return (
    previousStepIndex !== null &&
    nextStepIndex !== null &&
    previousStepIndex !== nextStepIndex
  );
};

export const usePerpsProSliderHaptics = ({
  disabled = false,
  maximumValue,
  minimumValue,
  step = 1,
  value,
}: {
  disabled?: boolean;
  maximumValue: number;
  minimumValue: number;
  step?: number;
  value: number;
}) => {
  const controlledValueRef = useRef(value);
  const previousUserValueRef = useRef<number | null>(null);
  const lastTriggeredAtRef = useRef(Number.NEGATIVE_INFINITY);
  controlledValueRef.current = value;

  useEffect(() => {
    previousUserValueRef.current = null;
  }, [disabled, maximumValue, minimumValue, step]);

  const onSlidingStart = useCallback((startValue: number) => {
    previousUserValueRef.current = startValue;
  }, []);

  const onValueChange = useCallback(
    (nextValue: number) => {
      if (disabled) {
        previousUserValueRef.current = null;
        return;
      }

      const previousValue =
        previousUserValueRef.current ?? controlledValueRef.current;
      previousUserValueRef.current = nextValue;

      if (
        !changesPerpsProSliderStep({
          maximumValue,
          minimumValue,
          nextValue,
          previousValue,
          step,
        })
      ) {
        return;
      }

      const now = Date.now();
      const elapsed = now - lastTriggeredAtRef.current;
      if (elapsed >= 0 && elapsed < PERPS_PRO_SLIDER_HAPTIC_MIN_INTERVAL_MS) {
        return;
      }

      lastTriggeredAtRef.current = now;
      triggerPerpsProLightHaptic();
    },
    [disabled, maximumValue, minimumValue, step],
  );

  const onSlidingComplete = useCallback(() => {
    previousUserValueRef.current = null;
  }, []);

  return {
    onSlidingComplete,
    onSlidingStart,
    onValueChange,
  };
};
