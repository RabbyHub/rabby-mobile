import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { CommonAddressList } from './CommonAddressList';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';

export function WatchAddressListScreen(): JSX.Element {
  const handlePress = () => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportWatchAddress2024,
    });
  };

  return (
    <NormalScreenContainer>
      <CommonAddressList
        type={KEYRING_CLASS.WATCH}
        footerButtonText="Add Watch-Only Addresses"
        footerButtonPress={handlePress}
      />
    </NormalScreenContainer>
  );
}
