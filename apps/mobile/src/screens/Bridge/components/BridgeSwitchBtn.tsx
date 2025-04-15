import React, { FC, useEffect, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtn.svg';
import RcIconSwitchBtnDark from '@/assets2024/icons/bridge/IconSwitchBtnDark.svg';
import RcIconSwitchBtnPressing from '@/assets2024/icons/bridge/IconSwitchBtnPress.svg';
import SwapLoadingPng from '@/assets2024/images/swap/loading.png';
import { useTheme2024 } from '@/hooks/theme';
import { GestureResponderEvent, TouchableOpacityProps } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

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

      <Loading isLoading={loading} />
    </TouchableOpacity>
  );
};

function Loading({ isLoading }: { isLoading?: boolean }) {
  const opacity = useSharedValue(0);
  const rotation = useSharedValue('0deg');
  useEffect(() => {
    if (isLoading) {
      opacity.value = withTiming(1, { duration: 500 });
      rotation.value = withRepeat(
        withTiming('360deg', { duration: 1000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      opacity.value = withTiming(0, { duration: 500 }, () => {
        cancelAnimation(rotation);
        rotation.value = withTiming('0deg', { duration: 0 });
      });
    }

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(opacity);
      opacity.value = withTiming(0, { duration: 0 });
      rotation.value = withTiming('0deg', { duration: 0 });
    };
  }, [isLoading, opacity, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: rotation.value }],
    width: '100%',
    height: '100%',
    position: 'absolute',
  }));

  return <Animated.Image source={SwapLoadingPng} style={animatedStyle} />;
}

export default BridgeSwitchBtn;
