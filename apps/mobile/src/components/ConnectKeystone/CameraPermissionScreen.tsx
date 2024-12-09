import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanKeystoneSVG from '@/assets/icons/sign/scan-keystone.svg';
import { CommonBluetoothPermissionScreen } from '../ConnectCommon/BluetoothPermissionScreen';

export const CameraPermissionScreen: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();

  return (
    <CommonBluetoothPermissionScreen
      titleText={t('page.newAddress.keystone.camera.title')}
      descriptionText={t('page.newAddress.keystone.camera.description')}
      onNext={onNext}
      DeviceLogo={ScanKeystoneSVG}
    />
  );
};
