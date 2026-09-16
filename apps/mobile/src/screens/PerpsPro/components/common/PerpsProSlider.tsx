import DialogPoint from '@/assets2024/icons/perps/PerpsProDialogSliderPoint.svg';
import { resolvePerpsProDialogCardBackground } from './perpsProDialogVisual';
import LeverageThumb from '@/assets2024/icons/perps/PerpsProLeverageThumb.svg';
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
  appearance?: 'default' | 'leverage-dialog' | 'order-dialog';
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
    appearance = 'default',
    value,
  }) => {
    const { colors2024, styles, isLight } = useTheme2024({ getStyle });
    const isLeverageDialog =
      tone === 'neutral' && appearance === 'leverage-dialog';
    const isOrderDialog = tone === 'neutral' && appearance === 'order-dialog';
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
          isLeverageDialog && styles.leverageContainer,
          isOrderDialog && styles.orderContainer,
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
          style={[
            styles.slider,
            tone === 'neutral' && styles.neutralSlider,
            isLeverageDialog && styles.leverageSlider,
            isOrderDialog && styles.orderSlider,
          ]}
          thumbStyle={
            tone === 'neutral'
              ? [
                  styles.invisibleThumb,
                  (isLeverageDialog || isOrderDialog) &&
                    styles.leverageInvisibleThumb,
                ]
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
                isLeverageDialog && styles.leverageTrack,
                isOrderDialog && styles.orderTrack,
                showDisabledAppearance && styles.neutralTrackDisabled,
              ]}
              testID="perps-pro-slider-neutral-track"
            />
            <View
              pointerEvents="none"
              style={[
                styles.neutralTrackProgressStart,
                isLeverageDialog && styles.leverageProgressStart,
                isOrderDialog && styles.orderProgressStart,
                showDisabledAppearance && styles.neutralTrackProgressDisabled,
              ]}
              testID="perps-pro-slider-neutral-track-progress-start"
            />
            <View
              pointerEvents="none"
              style={[
                styles.neutralTrackProgressRail,
                isLeverageDialog && styles.leverageProgressRail,
                isOrderDialog && styles.orderProgressRail,
              ]}
              testID="perps-pro-slider-neutral-track-progress-rail">
              <View
                style={[
                  styles.neutralTrackProgress,
                  isLeverageDialog && styles.leverageProgress,
                  isOrderDialog && styles.orderProgress,
                  showDisabledAppearance && styles.neutralTrackProgressDisabled,
                  { width: `${neutralProgress * 100}%` },
                ]}
                testID="perps-pro-slider-neutral-track-progress"
              />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.neutralThumbRail,
                isLeverageDialog && styles.leverageThumbRail,
                isOrderDialog && styles.orderThumbRail,
              ]}
              testID="perps-pro-slider-neutral-thumb-rail">
              <View
                style={[
                  styles.neutralThumb,
                  (isLeverageDialog || isOrderDialog) && styles.leverageThumb,
                  showDisabledAppearance && styles.neutralThumbDisabled,
                  { left: `${neutralProgress * 100}%` },
                ]}
                testID="perps-pro-slider-neutral-thumb">
                {isLeverageDialog || isOrderDialog ? (
                  <LeverageThumb
                    width={20}
                    height={20}
                    fill={colors2024['neutral-bg-0']}
                    color={
                      showDisabledAppearance
                        ? colors2024['neutral-secondary']
                        : colors2024['neutral-title-1']
                    }
                  />
                ) : null}
              </View>
            </View>
          </>
        ) : null}
        {tone !== 'neutral' || showPoints ? (
          <View
            pointerEvents="none"
            testID="perps-pro-slider-points"
            style={[
              styles.points,
              tone === 'neutral' && styles.neutralPoints,
              isOrderDialog && styles.orderPoints,
            ]}>
            {points.map((point, index) =>
              hideMinimumPoint && index === 0 ? null : isOrderDialog ? (
                <View
                  key={point}
                  style={{
                    position: 'absolute',
                    left: `${(index * 100) / (points.length - 1)}%`,
                  }}
                  testID="perps-pro-slider-neutral-point">
                  <DialogPoint
                    width={8}
                    height={8}
                    fill={resolvePerpsProDialogCardBackground(
                      colors2024,
                      isLight,
                    )}
                    color={
                      index / (points.length - 1) <= neutralProgress
                        ? colors2024['neutral-title-1']
                        : colors2024['neutral-info']
                    }
                  />
                </View>
              ) : (
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
  leverageContainer: { height: 48 },
  leverageSlider: { height: 48, marginHorizontal: 3 },
  leverageInvisibleThumb: { height: 20, width: 20 },
  leverageTrack: { height: 4, borderRadius: 2, left: 13, right: 13, top: 22 },
  leverageProgressStart: { width: 0 },
  leverageProgressRail: {
    height: 4,
    left: 13,
    right: 13,
    top: 22,
    borderRadius: 2,
  },
  leverageProgress: { height: 4, borderRadius: 2 },
  leverageThumbRail: { height: 20, left: 3, right: 23, top: 14 },
  leverageThumb: {
    height: 20,
    width: 20,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  // RNEUI travels containerWidth - thumbWidth. The -6 outer margin with
  // a 20px native thumb makes its center travel 4 .. width-4, exactly the
  // same rail as the five 8px points and the visible SVG thumb.
  orderContainer: { height: 40 },
  orderSlider: { height: 40, marginHorizontal: -6 },
  orderTrack: { height: 4, borderRadius: 2, top: 18 },
  orderProgressStart: { width: 4, height: 4, top: 18, borderRadius: 2 },
  orderProgressRail: { height: 4, left: 4, right: 4, top: 18 },
  orderProgress: { height: 4, borderRadius: 2 },
  orderThumbRail: { height: 20, left: -6, right: 14, top: 10 },
  orderPoints: { top: 16 },
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
