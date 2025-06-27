import React, { useEffect, useRef } from 'react';
import { Easing, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import RcIconloading from '@/assets2024/icons/home/Iconloading.svg';
import { Animated } from 'react-native';

export const LoadingCircle = () => {
  const { styles } = useTheme2024({ getStyle });
  const spinValue = useRef(new Animated.Value(0)).current;

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    return () => {
      spinValue.resetAnimation();
    };
  }, [spinValue]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [{ rotate: spin }],
        }}>
        <RcIconloading />
      </Animated.View>
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
}));

export default LoadingCircle;
