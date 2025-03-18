import React from 'react';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { CommonAddressList } from './CommonAddressList';
import { RootNames } from '@/constant/layout';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTranslation } from 'react-i18next';
import { StackActions, useNavigation } from '@react-navigation/native';
import { CurrentAddressProps } from './components/AddressListScreenContainer';

export function WatchAddressListScreen(): JSX.Element {
  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const handlePress = () => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ImportWatchAddress2024,
        params: {},
      }),
    );
  };
  const { t } = useTranslation();

  return (
    <NormalScreenContainer2024>
      <CommonAddressList
        type={KEYRING_CLASS.WATCH}
        footerButtonText={t(
          'page.addressDetail.watchAddressListScreen.addWatchAddress',
        )}
        footerButtonPress={handlePress}
      />
    </NormalScreenContainer2024>
  );
}
