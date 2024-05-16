import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
import { CommonBluetoothPermissionScreen } from '../ConnectCommon/BluetoothPermissionScreen';

export const BluetoothPermissionScreen: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const { t } = useTranslation();

  return (
    <CommonBluetoothPermissionScreen
      titleText={t('page.newAddress.ledger.ble.title')}
      descriptionText={t('page.newAddress.ledger.ble.description')}
      onNext={onNext}
      DeviceLogo={ScanLedgerSVG}
    />
  );
};
