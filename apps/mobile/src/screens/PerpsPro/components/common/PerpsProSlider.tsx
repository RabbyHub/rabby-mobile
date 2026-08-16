import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import React, { useMemo } from 'react';
import { View } from 'react-native';

export const PerpsProSlider: React.FC<{
  disabled?: boolean;
  dimWhenDisabled?: boolean;
  hideMinimumPoint?: boolean;
  maximumValue?: number;
  minimumValue?: number;
  onSlidingComplete?: (value: number) => void;
  onSlidingStart?: (value: number) => void;
  onValueChange?: (value: number) => void;
  pointCount?: number;
  showPoints?: boolean;
  step?: number;
  tone?: 'brand' | 'neutral';
  value: number;
}> = React.memo(
  ({
    disabled = false,
    dimWhenDisabled = true,
    hideMinimumPoint = false,
    maximumValue = 100,
    minimumValue = 0,
    onSlidingComplete,
    onSlidingStart,
    onValueChange,
    pointCount = 7,
    showPoints = true,
    step = 1,
    tone = 'brand',
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const showDisabledAppearance = disabled && dimWhenDisabled;
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
      <View
        style={[
          styles.container,
          tone === 'neutral' && styles.neutralContainer,
        ]}>
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
              : showDisabledAppearance
              ? colors2024['neutral-secondary']
              : colors2024['brand-default']
          }
          minimumValue={minimumValue}
          onSlidingComplete={onSlidingComplete}
          onSlidingStart={onSlidingStart}
          onValueChange={onValueChange}
          step={step}
          style={[styles.slider, tone === 'neutral' && styles.neutralSlider]}
          thumbStyle={
            tone === 'neutral'
              ? styles.invisibleThumb
              : showDisabledAppearance
              ? styles.disabledThumb
              : styles.thumb
          }
          trackStyle={
            tone === 'neutral' ? styles.neutralInputTrack : styles.track
          }
          value={value}
        />
        {tone === 'neutral' ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.neutralTrack,
                showDisabledAppearance && styles.neutralTrackDisabled,
              ]}
              testID="perps-pro-slider-neutral-track"
            />
            <View
              pointerEvents="none"
              style={[
                styles.neutralTrackProgressStart,
                showDisabledAppearance && styles.neutralTrackProgressDisabled,
              ]}
              testID="perps-pro-slider-neutral-track-progress-start"
            />
            <View
              pointerEvents="none"
              style={styles.neutralTrackProgressRail}
              testID="perps-pro-slider-neutral-track-progress-rail">
              <View
                style={[
                  styles.neutralTrackProgress,
                  showDisabledAppearance && styles.neutralTrackProgressDisabled,
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
                  showDisabledAppearance && styles.neutralThumbDisabled,
                  { left: `${neutralProgress * 100}%` },
                ]}
                testID="perps-pro-slider-neutral-thumb"
              />
            </View>
          </>
        ) : null}
        {tone !== 'neutral' || showPoints ? (
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
        ) : null}
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
  neutralContainer: {
    height: 32,
  },
  neutralSlider: {
    height: 32,
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
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    position: 'absolute',
    width: 16,
    zIndex: 3,
  },
  neutralThumbRail: {
    height: 16,
    left: 0,
    position: 'absolute',
    right: 16,
    top: 8,
    zIndex: 3,
  },
  neutralThumbDisabled: {
    borderColor: colors2024['neutral-secondary'],
  },
  invisibleThumb: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 16,
    width: 16,
  },
  neutralInputTrack: {
    borderRadius: 1,
    height: 2,
  },
  neutralTrack: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 1,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 15,
    zIndex: 1,
  },
  neutralTrackDisabled: {
    backgroundColor: colors2024['neutral-secondary'],
  },
  neutralTrackProgress: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 2,
  },
  neutralTrackProgressStart: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 2,
    left: 0,
    position: 'absolute',
    top: 15,
    width: 8,
    zIndex: 1,
  },
  neutralTrackProgressRail: {
    height: 2,
    left: 8,
    overflow: 'hidden',
    position: 'absolute',
    right: 8,
    top: 15,
    zIndex: 1,
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
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  neutralPointActive: {
    borderColor: colors2024['neutral-title-1'],
  },
  neutralPoints: {
    height: 8,
    left: 0,
    right: 8,
    top: 12,
  },
}));
