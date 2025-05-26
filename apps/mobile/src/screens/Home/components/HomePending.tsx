/* eslint-disable react-native/no-inline-styles */
import { View, Text } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { Animated } from 'react-native';
import RcIconPending from '@/assets2024/icons/history/IconPending.svg';
import { Easing } from 'react-native';

export const HomePendingBadge = ({ number }: { number: number }) => {
  const { styles, colors2024 } = useTheme2024();
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  return (
    <View
      style={{
        // flexDirection: 'row',
        // alignItems: 'center',
        position: 'relative',
      }}>
      <Animated.View
        style={{
          transform: [{ rotate: spin }],
        }}>
        <RcIconPending width={24} height={24} />
      </Animated.View>
      <Text
        style={{
          color: colors2024['orange-default'],
          position: 'absolute',
          left: 9,
          top: 3,
          fontFamily: 'SF Pro Rounded',
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '700',
        }}>
        {number}
      </Text>
    </View>
  );
};
