import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { formatPositionMarginTarget } from '../../model/positionMargin';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';

const HAPTIC_MAXIMUM_PROGRESS = 100;
const HAPTIC_MINIMUM_PROGRESS = 0;
const HAPTIC_PROGRESS_STEP = 1;

const toFinite = (value: string) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const resolveProgress = ({
  maximum,
  minimum,
  value,
}: {
  maximum: number;
  minimum: number;
  value: number;
}) => {
  const range = maximum - minimum;
  if (!Number.isFinite(range) || range <= 0 || !Number.isFinite(value)) {
    return 0;
  }

  const safeValue = Math.min(maximum, Math.max(minimum, value));
  return (safeValue - minimum) / range;
};

export const PerpsProManageMarginSlider: React.FC<{
  disabled?: boolean;
  dimWhenDisabled?: boolean;
  maximum: string;
  minimum: string;
  onValueChange: (value: string) => void;
  value: string;
}> = React.memo(
  ({
    disabled = false,
    dimWhenDisabled = true,
    maximum,
    minimum,
    onValueChange,
    value,
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const min = toFinite(minimum) ?? 0;
    const max = toFinite(maximum) ?? min;
    const input = toFinite(value) ?? min;
    const safeValue = Math.min(max, Math.max(min, input));
    const range = max - min;
    const progress = resolveProgress({
      maximum: max,
      minimum: min,
      value: safeValue,
    });
    const isDisabled = disabled || range <= 0;
    const showDisabledAppearance = isDisabled && dimWhenDisabled;
    const sliderHaptics = usePerpsProSliderHaptics({
      disabled: isDisabled,
      maximumValue: HAPTIC_MAXIMUM_PROGRESS,
      minimumValue: HAPTIC_MINIMUM_PROGRESS,
      step: HAPTIC_PROGRESS_STEP,
      value: progress * HAPTIC_MAXIMUM_PROGRESS,
    });
    const progressStyle = useMemo(
      () => ({ width: `${progress * 100}%` as `${number}%` }),
      [progress],
    );
    const thumbStyle = useMemo(
      () => ({ left: `${progress * 100}%` as `${number}%` }),
      [progress],
    );

    return (
      <View
        accessibilityRole="adjustable"
        accessibilityState={{ disabled: isDisabled }}
        style={[styles.container, showDisabledAppearance && styles.disabled]}
        testID="perps-pro-manage-margin-slider">
        <Slider
          allowTouchTrack={!isDisabled}
          disabled={isDisabled}
          maximumTrackTintColor="transparent"
          maximumValue={max}
          minimumTrackTintColor="transparent"
          minimumValue={min}
          onSlidingComplete={sliderHaptics.onSlidingComplete}
          onSlidingStart={next => {
            if (isDisabled) {
              return;
            }
            sliderHaptics.onSlidingStart(
              resolveProgress({ maximum: max, minimum: min, value: next }) *
                HAPTIC_MAXIMUM_PROGRESS,
            );
          }}
          onValueChange={next => {
            if (isDisabled) {
              return;
            }
            const normalized = formatPositionMarginTarget(
              new BigNumber(next).toFixed(),
            );
            if (normalized == null) {
              return;
            }
            const normalizedValue = Number(normalized);
            if (!Number.isFinite(normalizedValue)) {
              return;
            }

            sliderHaptics.onValueChange(
              resolveProgress({
                maximum: max,
                minimum: min,
                value: normalizedValue,
              }) * HAPTIC_MAXIMUM_PROGRESS,
            );
            onValueChange(normalized);
          }}
          step={0.01}
          style={styles.nativeSlider}
          thumbStyle={styles.invisibleThumb}
          trackStyle={styles.invisibleTrack}
          value={safeValue}
        />
        <View
          pointerEvents="none"
          style={styles.track}
          testID="perps-pro-manage-margin-slider-track"
        />
        <View pointerEvents="none" style={styles.progressStart} />
        <View
          pointerEvents="none"
          style={styles.progressRail}
          testID="perps-pro-manage-margin-slider-progress-rail">
          <View
            style={[styles.progress, progressStyle]}
            testID="perps-pro-manage-margin-slider-progress"
          />
        </View>
        <View
          pointerEvents="none"
          style={styles.thumbRail}
          testID="perps-pro-manage-margin-slider-thumb-rail">
          <View
            style={[styles.thumb, thumbStyle]}
            testID="perps-pro-manage-margin-slider-thumb"
          />
        </View>
      </View>
    );
  },
);

PerpsProManageMarginSlider.displayName = 'PerpsProManageMarginSlider';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  disabled: { opacity: 0.5 },
  nativeSlider: { height: 32, zIndex: 4 },
  invisibleTrack: { height: 2 },
  invisibleThumb: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 16,
    width: 16,
  },
  track: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 999,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 15,
    zIndex: 1,
  },
  progress: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 2,
  },
  progressStart: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 2,
    left: 0,
    position: 'absolute',
    top: 15,
    width: 8,
    zIndex: 2,
  },
  progressRail: {
    height: 2,
    left: 8,
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
    top: 15,
    zIndex: 2,
  },
  thumbRail: {
    height: 16,
    left: 0,
    position: 'absolute',
    right: 16,
    top: 8,
    zIndex: 3,
  },
  thumb: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-title-1'],
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    position: 'absolute',
    width: 16,
  },
}));
