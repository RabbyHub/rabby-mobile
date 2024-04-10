import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanOneKeySVG from '@/assets/icons/sign/scan-onekey.svg';
import { CommonScanDeviceScreen } from '../ConnectCommon/ScanDeviceScreen';

export const ScanDeviceScreen: React.FC<{}> = () => {
  const { t } = useTranslation();

  return (
    <CommonScanDeviceScreen
      titleText={t('page.newAddress.onekey.scan.title')}
      descriptionText={t('page.newAddress.onekey.scan.description')}
      DeviceLogo={ScanOneKeySVG}
    />
  );
};
