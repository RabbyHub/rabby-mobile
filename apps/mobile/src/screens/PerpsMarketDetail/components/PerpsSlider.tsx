import CloseThumb from '@/assets2024/icons/perps/PerpsSimpleAccount/slider-thumb.svg';
import SelectedPoint from '@/assets2024/icons/perps/PerpsSimpleAccount/slider-selected.svg';
import UnselectedPoint from '@/assets2024/icons/perps/PerpsSimpleAccount/slider-unselected.svg';
import { BubbleWithText } from '@/screens/Swap/components/Slider';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PerpsGestureSlider as Slider } from '@/components/perps/PerpsGestureSlider';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { Text } from '@/components/Typography';

const isAndroid = Platform.OS === 'android';
const sliderHapticTriggerNumbers = [0, 50, 100];
const closeHapticTriggerNumbers = [0, 25, 50, 75, 100];

interface PerpsSliderProps {
  variant?: 'close';
  value: number;
  key?: string;
  onValueChange: (value: number) => void;
  step?: number;
  maxValue?: number;
  showPercentage?: boolean;
  disabled?: boolean;
  minValue?: number;
  hightLightTriggerValue?: number[];
  onSlidingStart?: () => void;
  onSlidingComplete?: () => void;
}

export const PerpsSlider: React.FC<PerpsSliderProps> = ({
  value,
  variant,
  onValueChange,
  disabled = false,
  maxValue,
  step,
  key,
  showPercentage = true,
  minValue,
  hightLightTriggerValue,
  onSlidingStart,
  onSlidingComplete,
}) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const showBubbleValue = useSharedValue(false);
  const { width } = useWindowDimensions();
  const previousValue = useRef<number>(0);
  const controlledValue = useRef(value);
  controlledValue.current = value;
  const previousCloseValue = useRef<number | null>(null);

  useEffect(() => {
    previousCloseValue.current = null;
  }, [disabled, minValue, maxValue, step, variant]);

  const handleValueChange = useCallback(
    (v: number) => {
      if (variant === 'close' && disabled) return;
      const triggerValues =
        hightLightTriggerValue || sliderHapticTriggerNumbers;
      const previous = previousCloseValue.current ?? controlledValue.current;
      const crossedClosePoint = closeHapticTriggerNumbers.some(point =>
        v > previous
          ? previous < point && point <= v
          : v <= point && point < previous,
      );
      const shouldTrigger =
        variant === 'close'
          ? Number.isFinite(v) && Number.isFinite(previous) && crossedClosePoint
          : v !== previousValue.current && triggerValues.includes(v);
      if (shouldTrigger) {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      previousValue.current = v;
      previousCloseValue.current = v;
      onValueChange(v);
    },
    [onValueChange, hightLightTriggerValue, variant, disabled],
  );

  const handleSlidingStart = useCallback(
    (start: number) => {
      // Seed crossing detection before the native gesture publishes its first value.
      previousCloseValue.current = start;
      onSlidingStart?.();
    },
    [onSlidingStart],
  );
  const handleSlidingComplete = useCallback(() => {
    previousCloseValue.current = null;
    onSlidingComplete?.();
  }, [onSlidingComplete]);

  const sliderStyle = useAnimatedStyle(
    () => ({
      opacity: showBubbleValue.value ? 1 : 0,
      display: showBubbleValue.value ? 'flex' : 'none',
      position: 'absolute',
      top: isAndroid ? -72 : -60,
      left: 0,
      height: 70,
      width,
      transform: [
        {
          translateX: 0 - width / 2 + (isAndroid ? 7 : 6),
        },
      ],
    }),
    [width],
  );

  const thumbComponent = useMemo(() => {
    if (variant === 'close')
      return {
        children: (
          <CloseThumb
            fill={colors2024['neutral-bg-0']}
            stroke={colors2024['neutral-title-1']}
          />
        ),
      };
    return {
      children: (
        <View>
          <View style={[styles.outerThumb, styles.outerThumbRelative]}>
            <View style={styles.innerThumb} />
            <Animated.View style={sliderStyle}>
              <BubbleWithText slide={value || 0} />
            </Animated.View>
          </View>
        </View>
      ),
    };
  }, [
    variant,
    colors2024,
    styles.outerThumb,
    styles.innerThumb,
    sliderStyle,
    value,
    styles.outerThumbRelative,
  ]);

  return (
    <View
      key={key}
      style={[
        styles.sliderContainer,
        variant === 'close' && styles.closeContainer,
      ]}>
      <View style={styles.sliderWrapper}>
        {variant === 'close' && (
          <View
            pointerEvents="none"
            style={[
              styles.closeTrack,
              { backgroundColor: colors2024['neutral-line'] },
            ]}>
            <View
              style={[
                styles.closeProgress,
                {
                  width: `${value}%`,
                  backgroundColor: colors2024['neutral-title-1'],
                },
              ]}
            />
          </View>
        )}
        {variant === 'close' && (
          <View pointerEvents="none" style={styles.points}>
            {[0, 25, 50, 75, 100].map(point =>
              point <= value ? (
                <SelectedPoint
                  key={point}
                  fill={colors2024['neutral-bg-1']}
                  stroke={colors2024['neutral-title-1']}
                />
              ) : (
                <UnselectedPoint
                  key={point}
                  fill={colors2024['neutral-bg-1']}
                  stroke={colors2024['neutral-info']}
                />
              ),
            )}
          </View>
        )}
        <Slider
          style={variant === 'close' ? styles.closeSlider : undefined}
          allowTouchTrack={!disabled}
          disabled={disabled}
          value={value}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          onSlidingComplete={handleSlidingComplete}
          minimumValue={minValue || 0}
          maximumValue={maxValue || 100}
          step={step}
          trackStyle={styles.sliderTrack}
          minimumTrackTintColor={
            variant === 'close' ? 'transparent' : '#50D2C1'
          }
          maximumTrackTintColor={
            variant === 'close' ? 'transparent' : colors2024['neutral-line']
          }
          thumbStyle={
            variant === 'close'
              ? [styles.thumbStyle, styles.closeThumb]
              : styles.thumbStyle
          }
          thumbProps={thumbComponent}
        />
      </View>
      {showPercentage && (
        <Text style={styles.sliderPercentage}>{value.toFixed(0)}%</Text>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  closeContainer: { flex: 0, height: 20 },
  closeTrack: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 8,
    height: 4,
    borderRadius: 2,
  },
  closeProgress: { height: 4, borderRadius: 2 },
  closeSlider: { height: 20, zIndex: 2 },
  closeThumb: { width: 20, height: 20 },
  points: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    gap: 8,
  },
  sliderWrapper: {
    flex: 1,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  sliderPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    minWidth: 40,
    textAlign: 'right',
  },
  // For bubble slider
  thumbStyle: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 14,
    height: 14,
    backgroundColor: 'transparent',
  },
  outerThumb: {
    width: 14,
    height: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
  },
  outerThumbRelative: {
    position: 'relative',
  },
  innerThumb: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: '#50D2C1',
  },
}));
