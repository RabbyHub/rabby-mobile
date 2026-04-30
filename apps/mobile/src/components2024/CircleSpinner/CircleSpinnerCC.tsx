import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import RcPending from '@/assets2024/icons/swap/loading-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export const CircleSpinnerCC: React.FC<{
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ size = 16, color: currentColor, style }) => {
  const { colors2024 } = useTheme2024();
  const spinValue = useSharedValue(0);

  React.useEffect(() => {
    spinValue.value = withRepeat(
      withTiming(1, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(spinValue);
    };
  }, [spinValue]);

  const spinStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinValue.value * 360}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
        },
        style,
        spinStyle,
      ]}>
      <RcPending
        style={{
          width: size,
          height: size,
        }}
        color={currentColor || colors2024['neutral-InvertHighlight']}
      />
    </Animated.View>
  );
};
