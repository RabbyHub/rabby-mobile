import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
// Figma cNPc4bz8P8QBjkPk2huEml / 83992:156879; original 13px circle geometry.
import RcAmountSliderThumb from '@/assets2024/icons/perps/PerpsProTradeAmountSliderThumb.svg';
import { Text } from '@/components/Typography';
import { PerpsGestureSlider as Slider } from '@/components/perps/PerpsGestureSlider';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import { Keyboard, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';

const TRADE_SLIDER_POINTS = [0, 25, 50, 75, 100] as const;
const TRADE_SLIDER_THUMB_SIZE = 13;
const TRADE_SLIDER_TRACK_INSET = 9;
const TRADE_SLIDER_TOOLTIP_WIDTH = 36;

const toFraction = (value: number) => {
  'worklet';
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;
};

const TradeSliderPoint: React.FC<{
  point: number;
  progress: SharedValue<number>;
  styles: Record<'activePoint' | 'point' | 'pointPosition', ViewStyle>;
}> = ({ point, progress, styles }) => {
  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.value >= point ? 1 : 0,
  }));
  return (
    <View style={[styles.pointPosition, { left: `${point}%` }]}>
      <View style={styles.point} testID="perps-pro-trade-amount-slider-point">
        <Animated.View
          style={[styles.point, styles.activePoint, activeStyle]}
          testID="perps-pro-trade-amount-slider-point-active"
        />
      </View>
    </View>
  );
};

export const PerpsProTradeAmountSlider: React.FC<{
  onChange?: (value: number) => void;
  value?: number;
}> = React.memo(({ onChange, value = 0 }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const [dragging, setDragging] = useState(false);
  const points = useMemo(() => [...TRADE_SLIDER_POINTS], []);
  // The gesture mirrors its UI-thread position here, so the artwork moves in
  // the same frame as the touch instead of waiting for the Trade form render.
  const progress = useSharedValue(Number.isFinite(value) ? value : 0);
  const railWidth = useSharedValue(0);
  const activeTrackStyle = useAnimatedStyle(() => ({
    opacity: railWidth.value > 0 ? 1 : 0,
    transform: [
      { translateX: (toFraction(progress.value) - 1) * railWidth.value },
    ],
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    opacity: railWidth.value > 0 ? 1 : 0,
    transform: [{ translateX: toFraction(progress.value) * railWidth.value }],
  }));
  const tooltipStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          toFraction(progress.value) * railWidth.value -
          TRADE_SLIDER_TOOLTIP_WIDTH / 2,
      },
    ],
  }));
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
      <View
        onLayout={event => {
          railWidth.value = event.nativeEvent.layout.width;
        }}
        pointerEvents="none"
        style={styles.trackBase}
        testID="perps-pro-trade-amount-slider-rail">
        <Animated.View
          style={[styles.activeTrack, activeTrackStyle]}
          testID="perps-pro-trade-amount-slider-active-track"
        />
      </View>
      <View pointerEvents="none" style={styles.points}>
        {points.map(point => (
          <TradeSliderPoint
            key={point}
            point={point}
            progress={progress}
            styles={styles}
          />
        ))}
      </View>
      <View pointerEvents="none" style={styles.thumbRail}>
        <Animated.View
          style={[styles.thumbPosition, thumbStyle]}
          testID="perps-pro-trade-amount-slider-thumb-position">
          <RcAmountSliderThumb
            accessible={false}
            fill={colors2024['neutral-bg-1']}
            height={TRADE_SLIDER_THUMB_SIZE}
            pointerEvents="none"
            stroke={colors2024['neutral-title-1']}
            testID="perps-pro-trade-amount-slider-thumb"
            width={TRADE_SLIDER_THUMB_SIZE}
          />
        </Animated.View>
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
        progressValue={progress}
        step={1}
        style={styles.slider}
        thumbStyle={styles.thumb}
        trackStyle={styles.track}
        value={value}
      />
      {dragging ? (
        <View pointerEvents="none" style={styles.tooltipTrack}>
          <Animated.View
            pointerEvents="none"
            style={[styles.tooltip, tooltipStyle]}
            testID="perps-pro-trade-amount-slider-tooltip">
            <Text style={styles.tooltipText}>{Math.round(value)}%</Text>
          </Animated.View>
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
    // The gesture thumb travels containerWidth - thumbWidth. Match its center
    // to the same inset used by the track, quarter points and tooltip.
    marginHorizontal: TRADE_SLIDER_TRACK_INSET - TRADE_SLIDER_THUMB_SIZE / 2,
    zIndex: 4,
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
    width: '100%',
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
    left: -1,
    position: 'absolute',
    top: -1,
  },
  thumbRail: {
    left: TRADE_SLIDER_TRACK_INSET,
    position: 'absolute',
    right: TRADE_SLIDER_TRACK_INSET,
    // Original visual centre: (24 - 13) / 2 with the -0.5 rail alignment.
    top: (24 - TRADE_SLIDER_THUMB_SIZE) / 2 - 0.5,
    zIndex: 3,
  },
  thumbPosition: {
    height: TRADE_SLIDER_THUMB_SIZE,
    marginLeft: -TRADE_SLIDER_THUMB_SIZE / 2,
    width: TRADE_SLIDER_THUMB_SIZE,
  },
  thumb: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
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
    left: 0,
    paddingHorizontal: 4,
    position: 'absolute',
    top: -18,
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
