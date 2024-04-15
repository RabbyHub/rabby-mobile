import React from 'react';
import { useTranslation } from 'react-i18next';
import { Device } from 'react-native-ble-plx';
import {
  CommonSelectDeviceScreen,
  Props,
} from '../ConnectCommon/SelectDeviceScreen';

export const SelectDeviceScreen: React.FC<
  Pick<Props, 'errorCode' | 'onSelect' | 'currentDeviceId'> & {
    devices: Device[];
  }
> = ({ devices, ...props }) => {
  const { t } = useTranslation();

  return (
    <CommonSelectDeviceScreen
      {...props}
      titleText={t('page.newAddress.ledger.select.title')}
      descriptionText={t('page.newAddress.ledger.select.description')}
      currentDeviceText={t('page.newAddress.ledger.select.currentDevice')}
      devices={devices}
    />
  );
};
