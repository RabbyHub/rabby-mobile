import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity } from 'react-native';
import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtn.svg';
import RcIconSwitchBtnDark from '@/assets2024/icons/bridge/IconSwitchBtnDark.svg';
import RcIconSwitchBtnPressing from '@/assets2024/icons/bridge/IconSwitchBtnPress.svg';
import SwapLoadingPng from '@/assets2024/images/swap/loading.png';
import { useTheme2024 } from '@/hooks/theme';
import { GestureResponderEvent, TouchableOpacityProps } from 'react-native';

interface BridgeSwitchBtnProps extends TouchableOpacityProps {
  onPress?: (event?: GestureResponderEvent) => void;
  loading?: boolean;
}

const BridgeSwitchBtn: FC<BridgeSwitchBtnProps> = ({
  onPress,
  loading,
  ...others
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const { colors2024, isLight } = useTheme2024();

  const handlePressIn = () => {
    setIsPressed(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...others}>
      {isPressed ? (
        <RcIconSwitchBtnPressing />
      ) : !isLight ? (
        <RcIconSwitchBtnDark />
      ) : (
        <RcIconSwitchBtn color={colors2024['neutral-bg-3']} />
      )}

      {loading && <Loading />}
    </TouchableOpacity>
  );
};
// todo move to components fold
export function Loading() {
  const rotateValue = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]).start();
  }, [opacityValue, rotateValue]);

  const animatedStyle = useMemo(
    () => ({
      opacity: opacityValue,
      transform: [{ rotate: rotate }],
    }),
    [opacityValue, rotate],
  );

  return (
    <Animated.Image
      source={SwapLoadingPng}
      style={[
        animatedStyle,
        {
          width: '100%',
          height: '100%',
          position: 'absolute',
        },
      ]}
    />
  );
}

export default BridgeSwitchBtn;
