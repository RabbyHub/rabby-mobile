import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import RcIconSwitchBtn from '@/assets2024/icons/bridge/IconSwitchBtn.svg';
import RcIconSwitchBtnPressing from '@/assets2024/icons/bridge/IconSwitchBtnPress.svg';
const BridgeSwitchBtn = ({ onPress, ...others }) => {
  const [isPressed, setIsPressed] = useState(false);

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
      {isPressed ? <RcIconSwitchBtnPressing /> : <RcIconSwitchBtn />}
    </TouchableOpacity>
  );
};

export default BridgeSwitchBtn;
