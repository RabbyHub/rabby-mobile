import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { HeaderButtonProps } from '@react-navigation/native-stack/lib/typescript/src/types';
import React from 'react';
import { RcIconScannerCC } from '@/assets/icons/address';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const ImportPrivateKeyScreenButton: React.FC<HeaderButtonProps> = ({
  tintColor,
}) => {
  return (
    <CustomTouchableOpacity hitSlop={hitSlop} onPress={() => {}}>
      <RcIconScannerCC width={24} height={24} color={tintColor} />
    </CustomTouchableOpacity>
  );
};
