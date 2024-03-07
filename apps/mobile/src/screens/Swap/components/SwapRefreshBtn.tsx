import React, { useRef } from 'react';
import { Animated, Easing } from 'react-native';
import {
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native-gesture-handler';
import RcSwapRefresh from '@/assets/icons/swap/refresh.svg';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const SwapRefreshBtn = (
  props: TouchableOpacityProps & { size?: number },
) => {
  const { size = 16, onPress, style, ...others } = props;
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = useRef(
    spinValue.interpolate({
      inputRange: [0, 0.99, 1],
      outputRange: ['0deg', '362deg', '360deg'],
    }),
  ).current;

  const onRefresh = React.useCallback(() => {
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    onPress?.();
  }, [onPress, spinValue]);

  return (
    <AnimatedTouchableOpacity
      onPress={onRefresh}
      style={React.useMemo(
        () => [
          {
            transform: [{ rotate: spin }],
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ],
        [spin, style],
      )}
      {...others}>
      <RcSwapRefresh width={size} height={size} />
    </AnimatedTouchableOpacity>
  );
};
