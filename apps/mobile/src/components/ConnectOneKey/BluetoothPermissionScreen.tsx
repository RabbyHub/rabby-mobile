import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanOneKeySVG from '@/assets/icons/sign/scan-onekey.svg';
import { CommonBluetoothPermissionScreen } from '../ConnectCommon/BluetoothPermissionScreen';

export const BluetoothPermissionScreen: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();

  return (
    <CommonBluetoothPermissionScreen
      titleText={t('page.newAddress.onekey.ble.title')}
      descriptionText={t('page.newAddress.onekey.ble.description')}
      onNext={onNext}
      DeviceLogo={ScanOneKeySVG}
    />
  );
};
