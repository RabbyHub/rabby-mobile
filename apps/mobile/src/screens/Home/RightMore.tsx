import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { HeaderButtonProps } from '@react-navigation/native-stack/lib/typescript/src/types';
import React from 'react';
import { RcIconMore } from '@/assets/icons/home';
import { useAddressDetailModal } from '../Address/useAddressDetailModal';
import { useCurrentAccount } from '@/hooks/account';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const RightMore: React.FC<HeaderButtonProps> = ({}) => {
  const { currentAccount } = useCurrentAccount();
  const showAddressDetail = useAddressDetailModal();

  const onPress = () => {
    if (currentAccount) {
      showAddressDetail({ account: currentAccount });
    }
  };

  return (
    <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
      <RcIconMore width={24} height={24} />
    </CustomTouchableOpacity>
  );
};
