import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtnNew.svg';
import RcIconSwitchBtnDark from '@/assets2024/icons/bridge/IconSwitchBtnNewDark.svg';
import SwapLoadingPng from '@/assets2024/images/swap/loading.png';
import { useTheme2024 } from '@/hooks/theme';

const BUTTON_SIZE = 36;

interface BridgeSwitchBtnProps extends TouchableOpacityProps {
  onPress?: (event?: GestureResponderEvent) => void;
  loading?: boolean;
}

const BridgeSwitchBtn: FC<BridgeSwitchBtnProps> = ({
  onPress,
  loading,
  style,
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
      style={[styles.button, style]}
      {...others}>
      {isLight ? (
        <RcIconSwitchBtn
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          color={colors2024['neutral-bg-3']}
        />
      ) : (
        <RcIconSwitchBtnDark
          width={BUTTON_SIZE}
          height={BUTTON_SIZE}
          color={colors2024['neutral-bg-3']}
        />
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

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  swapButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 0.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BridgeSwitchBtn;
