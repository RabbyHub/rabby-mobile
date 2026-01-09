import React, { useCallback, useRef } from 'react';

import { StyleProp, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Slider } from '@rneui/themed';
import { useTheme2024 } from '@/hooks/theme';
import { IS_ANDROID } from '@/core/native/utils';
import { createGetStyles2024 } from '@/utils/styles';
import { BubbleWithText } from '@/screens/Swap/components/Slider';

import { SwappableToken } from '../../types/swap';
import { sliderHapticTriggerNumbers } from './utils';
import { trigger } from 'react-native-haptic-feedback';

interface DebtSwapModalSliderProps {
  fromToken: SwappableToken;
  slider: number;
  onChangeSlider: (value: number) => void;
  style?: StyleProp<ViewStyle>;
}
const DebtSwapModalSlider = ({
  fromToken,
  slider,
  onChangeSlider,
  style,
}: DebtSwapModalSliderProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const showBubble = useSharedValue(false);
  const previousSlider = useRef<number>(0);

  const { width } = useWindowDimensions();
  const sliderStyle = useAnimatedStyle(
    () => ({
      opacity: showBubble.value ? 1 : 0,
      display: showBubble.value ? 'flex' : 'none',
      position: 'absolute',
      top: IS_ANDROID ? -72 : -60,
      left: 0,
      height: 70,
      width,
      transform: [
        {
          translateX: 0 - width / 2 + (IS_ANDROID ? 7 : 6),
        },
      ],
    }),
    [width],
  );
  const handleSliderChange = useCallback(
    (v: number) => {
      if (
        v !== previousSlider.current &&
        sliderHapticTriggerNumbers.includes(v)
      ) {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }

      previousSlider.current = v;
      onChangeSlider(v);
    },
    [onChangeSlider],
  );
  return (
    <Slider
      key={`${fromToken?.underlyingAddress}`}
      allowTouchTrack={true}
      style={[styles.slider, style]}
      value={slider}
      onSlidingStart={() => {
        showBubble.value = true;
      }}
      onValueChange={onChangeSlider}
      onSlidingComplete={v => {
        showBubble.value = false;
        handleSliderChange(v);
      }}
      minimumValue={0}
      maximumValue={100}
      minimumTrackTintColor={colors2024['brand-default']}
      maximumTrackTintColor={colors2024['neutral-line']}
      step={1}
      thumbStyle={styles.thumbStyle}
      thumbProps={{
        children: (
          <View>
            <View style={[styles.outerThumb, styles.outerThumbWrapper]}>
              <View style={styles.innerThumb} />
              <Animated.View style={sliderStyle}>
                <BubbleWithText slide={slider || 0} />
              </Animated.View>
            </View>
          </View>
        ),
      }}
    />
  );
};

export default DebtSwapModalSlider;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  slider: {
    width: 126,
    height: 4,
  },
  thumbStyle: {
    backgroundColor: colors2024['brand-default'],
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  outerThumbWrapper: {
    position: 'relative',
  },
  outerThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors2024['brand-default'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerThumb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-1'],
  },
}));
