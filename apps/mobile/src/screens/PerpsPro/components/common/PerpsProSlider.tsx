import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import React, { useMemo } from 'react';
import { View } from 'react-native';

export const PerpsProSlider: React.FC<{
  disabled?: boolean;
  hideMinimumPoint?: boolean;
  maximumValue?: number;
  minimumValue?: number;
  onSlidingComplete?: (value: number) => void;
  onSlidingStart?: (value: number) => void;
  onValueChange?: (value: number) => void;
  pointCount?: number;
  step?: number;
  tone?: 'brand' | 'neutral';
  value: number;
}> = React.memo(
  ({
    disabled = false,
    hideMinimumPoint = false,
    maximumValue = 100,
    minimumValue = 0,
    onSlidingComplete,
    onSlidingStart,
    onValueChange,
    pointCount = 7,
    step = 1,
    tone = 'brand',
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const points = useMemo(
      () =>
        Array.from({ length: Math.max(2, pointCount) }, (_, index) => index),
      [pointCount],
    );
    const neutralProgress = useMemo(() => {
      const range = maximumValue - minimumValue;
      if (!Number.isFinite(range) || range <= 0) return 0;
      return Math.max(0, Math.min(1, (value - minimumValue) / range));
    }, [maximumValue, minimumValue, value]);

    return (
      <View style={styles.container}>
        <Slider
          allowTouchTrack={!disabled}
          disabled={disabled}
          maximumTrackTintColor={
            tone === 'neutral' ? 'transparent' : colors2024['neutral-line']
          }
          maximumValue={maximumValue}
          minimumTrackTintColor={
            tone === 'neutral'
              ? 'transparent'
              : disabled
              ? colors2024['neutral-secondary']
              : colors2024['brand-default']
          }
          minimumValue={minimumValue}
          onSlidingComplete={onSlidingComplete}
          onSlidingStart={onSlidingStart}
          onValueChange={onValueChange}
          step={step}
          style={styles.slider}
          thumbStyle={
            tone === 'neutral'
              ? styles.invisibleThumb
              : disabled
              ? styles.disabledThumb
              : styles.thumb
          }
          trackStyle={styles.track}
          value={value}
        />
        {tone === 'neutral' ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.neutralTrack,
                disabled && styles.neutralTrackDisabled,
              ]}
              testID="perps-pro-slider-neutral-track">
              <View
                style={[
                  styles.neutralTrackProgress,
                  disabled && styles.neutralTrackProgressDisabled,
                  { width: `${neutralProgress * 100}%` },
                ]}
                testID="perps-pro-slider-neutral-track-progress"
              />
            </View>
            <View
              pointerEvents="none"
              style={styles.neutralThumbRail}
              testID="perps-pro-slider-neutral-thumb-rail">
              <View
                style={[
                  styles.neutralThumb,
                  disabled && styles.neutralThumbDisabled,
                  { left: `${neutralProgress * 100}%`, marginLeft: -6.5 },
                ]}
                testID="perps-pro-slider-neutral-thumb"
              />
            </View>
          </>
        ) : null}
        <View
          pointerEvents="none"
          style={[styles.points, tone === 'neutral' && styles.neutralPoints]}>
          {points.map((point, index) =>
            hideMinimumPoint && index === 0 ? null : (
              <View
                key={point}
                style={[
                  styles.point,
                  tone === 'neutral' && styles.neutralPoint,
                  tone === 'neutral' &&
                    index / (points.length - 1) <= neutralProgress &&
                    styles.neutralPointActive,
                  tone === 'neutral' && {
                    left: `${(index * 100) / (points.length - 1)}%`,
                    marginLeft: -3.5,
                    position: 'absolute',
                  },
                ]}
                testID={
                  tone === 'neutral'
                    ? 'perps-pro-slider-neutral-point'
                    : undefined
                }
              />
            ),
          )}
        </View>
      </View>
    );
  },
);

PerpsProSlider.displayName = 'PerpsProSlider';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  slider: {
    height: 24,
    zIndex: 2,
  },
  track: {
    borderRadius: 1,
    height: 1,
  },
  thumb: {
    backgroundColor: colors2024['brand-default'],
    borderColor: colors2024['neutral-bg-1'],
    borderRadius: 7,
    borderWidth: 2,
    height: 13,
    width: 13,
  },
  disabledThumb: {
    backgroundColor: colors2024['neutral-secondary'],
    borderColor: colors2024['neutral-bg-1'],
    borderRadius: 7,
    borderWidth: 2,
    height: 13,
    width: 13,
  },
  neutralThumb: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-title-1'],
    borderRadius: 7,
    borderWidth: 1,
    height: 13,
    position: 'absolute',
    width: 13,
    zIndex: 3,
  },
  neutralThumbRail: {
    height: 13,
    left: 6.5,
    position: 'absolute',
    right: 6.5,
    top: 5.5,
    zIndex: 3,
  },
  neutralThumbDisabled: {
    borderColor: colors2024['neutral-secondary'],
  },
  invisibleThumb: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 13,
    width: 13,
  },
  neutralTrack: {
    backgroundColor: colors2024['neutral-line'],
    height: 1,
    left: 6.5,
    overflow: 'hidden',
    position: 'absolute',
    right: 6.5,
    zIndex: 1,
  },
  neutralTrackDisabled: {
    backgroundColor: colors2024['neutral-secondary'],
  },
  neutralTrackProgress: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 1,
  },
  neutralTrackProgressDisabled: {
    backgroundColor: colors2024['neutral-secondary'],
  },
  points: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  point: {
    backgroundColor: colors2024['neutral-line'],
    borderColor: colors2024['neutral-bg-1'],
    borderRadius: 2,
    borderWidth: 1,
    height: 4,
    width: 4,
  },
  neutralPoint: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  neutralPointActive: {
    borderColor: colors2024['neutral-title-1'],
  },
  neutralPoints: {
    left: 6.5,
    right: 6.5,
  },
}));
