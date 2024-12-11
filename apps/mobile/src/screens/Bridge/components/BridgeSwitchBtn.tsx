import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtn.svg';
import RcIconSwitchBtnPressing from '@/assets2024/icons/bridge/IconSwitchBtnPress.svg';
import { useTheme2024 } from '@/hooks/theme';
const BridgeSwitchBtn = ({ onPress, ...others }) => {
  const [isPressed, setIsPressed] = useState(false);
  const { styles, colors2024, colors } = useTheme2024();

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
      ) : (
        <RcIconSwitchBtn color={colors2024['neutral-bg-1']} />
      )}
    </TouchableOpacity>
  );
};

export default BridgeSwitchBtn;
