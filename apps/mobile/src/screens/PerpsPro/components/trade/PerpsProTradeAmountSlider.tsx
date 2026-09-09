import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import React, { useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';

import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';

const TRADE_SLIDER_POINTS = [0, 25, 50, 75, 100] as const;
const TRADE_SLIDER_THUMB_SIZE = 13;
const TRADE_SLIDER_TRACK_INSET = 9;
const TRADE_SLIDER_TOOLTIP_WIDTH = 36;

export const PerpsProTradeAmountSlider: React.FC<{
  onChange?: (value: number) => void;
  value?: number;
}> = React.memo(({ onChange, value = 0 }) => {
  const { styles } = useTheme2024({ getStyle });
  const [dragging, setDragging] = useState(false);
  const points = useMemo(() => [...TRADE_SLIDER_POINTS], []);
  const sliderHaptics = usePerpsProSliderHaptics({
    disabled: !onChange,
    maximumValue: 100,
    minimumValue: 0,
    step: 1,
    value,
  });

  return (
    <View
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityRole="adjustable"
      accessibilityValue={{ max: 100, min: 0, now: value }}
      accessible
      onAccessibilityAction={event => {
        Keyboard.dismiss();
        onChange?.(
          Math.max(
            0,
            Math.min(
              100,
              value + (event.nativeEvent.actionName === 'increment' ? 25 : -25),
            ),
          ),
        );
      }}
      style={styles.container}
      testID="perps-pro-trade-amount-slider">
      <View pointerEvents="none" style={styles.trackBase}>
        <View style={[styles.activeTrack, { width: `${value}%` }]} />
      </View>
      <Slider
        allowTouchTrack
        maximumTrackTintColor="transparent"
        maximumValue={100}
        minimumTrackTintColor="transparent"
        minimumValue={0}
        onSlidingComplete={() => {
          sliderHaptics.onSlidingComplete();
          setDragging(false);
        }}
        onSlidingStart={next => {
          sliderHaptics.onSlidingStart(next);
          Keyboard.dismiss();
          setDragging(true);
        }}
        onValueChange={next => {
          const roundedNext = Math.round(next);
          sliderHaptics.onValueChange(roundedNext);
          onChange?.(roundedNext);
        }}
        step={1}
        style={styles.slider}
        thumbStyle={styles.thumb}
        trackStyle={styles.track}
        value={value}
      />
      <View pointerEvents="none" style={styles.points}>
        {points.map(point => (
          <View
            key={point}
            style={[styles.pointPosition, { left: `${point}%` }]}>
            <View
              style={[styles.point, point <= value ? styles.activePoint : null]}
              testID="perps-pro-trade-amount-slider-point"
            />
          </View>
        ))}
      </View>
      {dragging ? (
        <View pointerEvents="none" style={styles.tooltipTrack}>
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              {
                left: `${value}%`,
              },
            ]}
            testID="perps-pro-trade-amount-slider-tooltip">
            <Text style={styles.tooltipText}>{Math.round(value)}%</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

PerpsProTradeAmountSlider.displayName = 'PerpsProTradeAmountSlider';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: 24,
    position: 'relative',
    width: '100%',
  },
  slider: {
    height: 24,
    // RNEUI's thumb travels containerWidth - thumbWidth. Match its center
    // to the same inset used by the track, quarter points and tooltip.
    marginHorizontal: TRADE_SLIDER_TRACK_INSET - TRADE_SLIDER_THUMB_SIZE / 2,
    transform: [{ translateY: -0.5 }],
    zIndex: 3,
  },
  track: {
    borderRadius: 1,
    height: 1,
  },
  trackBase: {
    backgroundColor: colors2024['neutral-line'],
    height: 1,
    left: TRADE_SLIDER_TRACK_INSET,
    overflow: 'hidden',
    position: 'absolute',
    right: TRADE_SLIDER_TRACK_INSET,
    top: 11,
    zIndex: 1,
  },
  activeTrack: {
    backgroundColor: colors2024['neutral-title-1'],
    height: 1,
  },
  points: {
    left: TRADE_SLIDER_TRACK_INSET,
    position: 'absolute',
    right: TRADE_SLIDER_TRACK_INSET,
    top: 8,
    zIndex: 2,
  },
  pointPosition: {
    marginLeft: -3.5,
    position: 'absolute',
  },
  point: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 3.5,
    borderWidth: 1,
    height: 7,
    width: 7,
  },
  activePoint: {
    borderColor: colors2024['neutral-title-1'],
  },
  thumb: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderColor: colors2024['neutral-title-1'],
    borderRadius: TRADE_SLIDER_THUMB_SIZE / 2,
    borderWidth: 1,
    height: TRADE_SLIDER_THUMB_SIZE,
    width: TRADE_SLIDER_THUMB_SIZE,
  },
  tooltipTrack: {
    left: TRADE_SLIDER_TRACK_INSET,
    position: 'absolute',
    right: TRADE_SLIDER_TRACK_INSET,
    top: 0,
    zIndex: 4,
  },
  tooltip: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-title-1'],
    borderRadius: 4,
    height: 20,
    justifyContent: 'center',
    width: TRADE_SLIDER_TOOLTIP_WIDTH,
    paddingHorizontal: 4,
    position: 'absolute',
    top: -18,
    transform: [{ translateX: -TRADE_SLIDER_TOOLTIP_WIDTH / 2 }],
    zIndex: 4,
  },
  tooltipText: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 12,
  },
}));
