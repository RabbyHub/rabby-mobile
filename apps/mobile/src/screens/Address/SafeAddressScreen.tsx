import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { CommonAddressList } from './CommonAddressList';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';

export function SafeAddressListScreen(): JSX.Element {
  const handlePress = () => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportSafeAddress2024,
    });
  };

  return (
    <NormalScreenContainer>
      <CommonAddressList
        type={KEYRING_CLASS.GNOSIS}
        footerButtonText="Add Safe Addresses"
        footerButtonPress={handlePress}
      />
    </NormalScreenContainer>
  );
}
