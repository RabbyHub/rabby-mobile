import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import React, { useMemo } from 'react';
import { View } from 'react-native';

export const PerpsProSlider: React.FC<{
  disabled?: boolean;
  maximumValue?: number;
  minimumValue?: number;
  onValueChange?: (value: number) => void;
  pointCount?: number;
  step?: number;
  value: number;
}> = React.memo(
  ({
    disabled = false,
    maximumValue = 100,
    minimumValue = 0,
    onValueChange,
    pointCount = 7,
    step = 1,
    value,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const points = useMemo(
      () =>
        Array.from({ length: Math.max(2, pointCount) }, (_, index) => index),
      [pointCount],
    );

    return (
      <View style={styles.container}>
        <Slider
          allowTouchTrack={!disabled}
          disabled={disabled}
          maximumTrackTintColor={colors2024['neutral-line']}
          maximumValue={maximumValue}
          minimumTrackTintColor={
            disabled
              ? colors2024['neutral-secondary']
              : colors2024['brand-default']
          }
          minimumValue={minimumValue}
          onValueChange={onValueChange}
          step={step}
          style={styles.slider}
          thumbStyle={disabled ? styles.disabledThumb : styles.thumb}
          trackStyle={styles.track}
          value={value}
        />
        <View pointerEvents="none" style={styles.points}>
          {points.map(point => (
            <View key={point} style={styles.point} />
          ))}
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
}));
