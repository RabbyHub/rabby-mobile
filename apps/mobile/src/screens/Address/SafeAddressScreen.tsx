import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { CommonAddressList } from './CommonAddressList';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTranslation } from 'react-i18next';

export function SafeAddressListScreen(): JSX.Element {
  const handlePress = () => {
    navigate(RootNames.StackAddress, {
      screen: RootNames.ImportSafeAddress2024,
    });
  };
  const { t } = useTranslation();

  return (
    <NormalScreenContainer2024>
      <CommonAddressList
        type={KEYRING_CLASS.GNOSIS}
        footerButtonText={t(
          'page.addressDetail.safeAddressListScreen.addSafeAddress',
        )}
        footerButtonPress={handlePress}
      />
    </NormalScreenContainer2024>
  );
}
