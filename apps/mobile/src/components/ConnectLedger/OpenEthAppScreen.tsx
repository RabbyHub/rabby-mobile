import React from 'react';
import { useTranslation } from 'react-i18next';
import OpenLedgerSVG from '@/assets/icons/sign/open-ledger.svg';
import { CommonScanDeviceScreen } from '../ConnectCommon/ScanDeviceScreen';

export const OpenEthAppScreen: React.FC<{}> = ({}) => {
  const { t } = useTranslation();

  return (
    <CommonScanDeviceScreen
      titleText={t('page.newAddress.ledger.openEthApp.title')}
      descriptionText={t('page.newAddress.ledger.openEthApp.description')}
      DeviceLogo={OpenLedgerSVG}
    />
  );
};
