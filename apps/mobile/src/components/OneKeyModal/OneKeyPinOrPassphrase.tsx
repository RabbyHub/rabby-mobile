import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanOneKeySVG from '@/assets/icons/sign/scan-onekey.svg';
import { CommonScanDeviceScreen } from '../ConnectCommon/ScanDeviceScreen';

export const OneKeyPinOrPassphrase: React.FC<{}> = ({}) => {
  const { t } = useTranslation();

  return (
    <CommonScanDeviceScreen
      titleText={t('page.newAddress.onekey.connect.title')}
      descriptionText={t('page.newAddress.onekey.connect.description')}
      DeviceLogo={ScanOneKeySVG}
    />
  );
};
