import { BubbleWithText } from '@/screens/Swap/components/Slider';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Slider } from '@rneui/themed';
import React, { useCallback, useMemo, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';

const isAndroid = Platform.OS === 'android';
const sliderHapticTriggerNumbers = [0, 50, 100];

interface PerpsSliderProps {
  value: number;
  key?: string;
  onValueChange: (value: number) => void;
  step?: number;
  maxValue?: number;
  showPercentage?: boolean;
  disabled?: boolean;
  minValue?: number;
  hightLightTriggerValue?: number[];
}

export const PerpsSlider: React.FC<PerpsSliderProps> = ({
  value,
  onValueChange,
  disabled = false,
  maxValue,
  step,
  key,
  showPercentage = true,
  minValue,
  hightLightTriggerValue,
}) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });

  const showBubbleValue = useSharedValue(false);
  const { width } = useWindowDimensions();
  const previousValue = useRef<number>(0);

  const handleValueChange = useCallback(
    (v: number) => {
      // Trigger haptic feedback when reaching specific values
      const triggerValues =
        hightLightTriggerValue || sliderHapticTriggerNumbers;
      if (v !== previousValue.current && triggerValues.includes(v)) {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      previousValue.current = v;
      onValueChange(v);
    },
    [onValueChange, hightLightTriggerValue],
  );

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
    styles.outerThumb,
    styles.innerThumb,
    sliderStyle,
    value,
    styles.outerThumbRelative,
  ]);

  return (
    <View key={key} style={styles.sliderContainer}>
      <View style={styles.sliderWrapper}>
        <Slider
          allowTouchTrack={!disabled}
          disabled={disabled}
          value={value}
          onValueChange={handleValueChange}
          minimumValue={minValue || 0}
          maximumValue={maxValue || 100}
          step={step}
          trackStyle={styles.sliderTrack}
          minimumTrackTintColor={colors2024['brand-default']}
          maximumTrackTintColor={colors2024['neutral-line']}
          thumbStyle={styles.thumbStyle}
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
    fontWeight: '600',
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
    backgroundColor: colors2024['brand-default'],
  },
  // For simple slider
  simpleThumbStyle: {
    width: 24,
    height: 24,
    backgroundColor: colors2024['brand-default'],
    borderRadius: 12,
  },
}));
