import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { CommonAddressList } from './CommonAddressList';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';

export function SafeAddressListScreen(): JSX.Element {
  const handlePress = () => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportSafeAddress2024,
    });
  };

  return (
    <NormalScreenContainer2024>
      <CommonAddressList
        type={KEYRING_CLASS.GNOSIS}
        footerButtonText="Add Safe Addresses"
        footerButtonPress={handlePress}
      />
    </NormalScreenContainer2024>
  );
}
