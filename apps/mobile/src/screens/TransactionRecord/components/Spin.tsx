import RcIconSpinCC from '@/assets/icons/transaction-record/icon-spin-cc.svg';
import RcIconItemPendingCC from '@/assets2024/icons/history/IconItemPending.svg';
import React from 'react';
import { useEffect, useRef } from 'react';
import {
  Animated,
  ColorValue,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';

export const Spin = React.memo(
  ({ style, color }: { style?: StyleProp<ViewStyle>; color?: ColorValue }) => {
    const spinAnim = useRef(new Animated.Value(0)).current;

    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    useEffect(() => {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    }, [spinAnim]);

    return (
      <Animated.View
        style={[
          // eslint-disable-next-line react-native/no-inline-styles
          {
            transform: [
              {
                rotate: spin,
              },
            ],
            width: 14,
            height: 14,
          },
          style,
        ]}>
        <RcIconItemPendingCC
          color={color}
          viewBox="0 0 14 14"
          width={'100%'}
          height={'100%'}
        />
      </Animated.View>
    );
  },
);
