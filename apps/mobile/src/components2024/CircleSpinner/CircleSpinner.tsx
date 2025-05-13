import React from 'react';
import { Animated, Easing } from 'react-native';
import RcPending from '@/assets/icons/swap/pending.svg';

export const CircleSpinner: React.FC<{
  size?: number;
}> = ({ size = 16 }) => {
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
        style={{
          width: size,
          height: size,
        }}
      />
    </Animated.View>
  );
};
