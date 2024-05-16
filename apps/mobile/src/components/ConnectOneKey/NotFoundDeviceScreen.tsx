import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanOneKeySVG from '@/assets/icons/sign/scan-onekey.svg';
import { CommonNotFoundDeviceScreen } from '../ConnectCommon/NotFoundDeviceScreen';

export const NotFoundDeviceScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <CommonNotFoundDeviceScreen
      titleText={t('page.newAddress.onekey.notFound.title')}
      descriptionText={t('page.newAddress.onekey.notFound.description')}
      DeviceLogo={ScanOneKeySVG}
    />
  );
};
