import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
import { CommonScanDeviceScreen } from '../ConnectCommon/ScanDeviceScreen';

export const ScanDeviceScreen: React.FC<{}> = () => {
  const { t } = useTranslation();

  return (
    <CommonScanDeviceScreen
      titleText={t('page.newAddress.ledger.scan.title')}
      descriptionText={t('page.newAddress.ledger.scan.description')}
      DeviceLogo={ScanLedgerSVG}
    />
  );
};
