import React from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import RcPending from '@/assets2024/icons/swap/loading-cc.svg';
import { useTheme2024 } from '@/hooks/theme';

export const CircleSpinnerCC: React.FC<{
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ size = 16, color: currentColor, style }) => {
  const { colors2024 } = useTheme2024();
  const spinValue = React.useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ rotate: spin }],
        width: size,
        height: size,
      }}>
      <RcPending
        style={[
          {
            width: size,
            height: size,
          },
          style,
        ]}
        color={currentColor || colors2024['neutral-InvertHighlight']}
      />
    </Animated.View>
  );
};
