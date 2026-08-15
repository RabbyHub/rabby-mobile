import RcEndpoint from '@/assets2024/icons/perps/PerpsProMarginSliderEndpoint.svg';
import RcThumb from '@/assets2024/icons/perps/PerpsProMarginSliderThumb.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import BigNumber from 'bignumber.js';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { formatPositionMarginTarget } from '../../model/positionMargin';

const toFinite = (value: string) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

export const PerpsProManageMarginSlider: React.FC<{
  disabled?: boolean;
  maximum: string;
  minimum: string;
  onValueChange: (value: string) => void;
  value: string;
}> = React.memo(
  ({ disabled = false, maximum, minimum, onValueChange, value }) => {
    const { styles } = useTheme2024({ getStyle });
    const min = toFinite(minimum) ?? 0;
    const max = toFinite(maximum) ?? min;
    const input = toFinite(value) ?? min;
    const safeValue = Math.min(max, Math.max(min, input));
    const range = max - min;
    const progress = range > 0 ? (safeValue - min) / range : 0;
    const isDisabled = disabled || range <= 0;
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
        style={[styles.container, isDisabled && styles.disabled]}
        testID="perps-pro-manage-margin-slider">
        <Slider
          allowTouchTrack={!isDisabled}
          disabled={isDisabled}
          maximumTrackTintColor="transparent"
          maximumValue={max}
          minimumTrackTintColor="transparent"
          minimumValue={min}
          onValueChange={next => {
            const normalized = formatPositionMarginTarget(
              new BigNumber(next).toFixed(),
            );
            if (normalized != null) {
              onValueChange(normalized);
            }
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
          testID="perps-pro-manage-margin-slider-track">
          <View
            style={[styles.progress, progressStyle]}
            testID="perps-pro-manage-margin-slider-progress"
          />
        </View>
        <View
          pointerEvents="none"
          style={styles.endpoints}
          testID="perps-pro-manage-margin-slider-endpoints">
          <RcEndpoint height={7} width={7} />
          <RcEndpoint height={7} width={7} />
        </View>
        <View pointerEvents="none" style={styles.thumbRail}>
          <View
            style={[styles.thumb, thumbStyle]}
            testID="perps-pro-manage-margin-slider-thumb">
            <RcThumb height={16} width={16} />
          </View>
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
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 15,
    zIndex: 1,
  },
  progress: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 2,
  },
  endpoints: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 12.5,
    zIndex: 2,
  },
  thumbRail: {
    height: 16,
    left: 8,
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 3,
  },
  thumb: {
    marginLeft: -8,
    position: 'absolute',
  },
}));
