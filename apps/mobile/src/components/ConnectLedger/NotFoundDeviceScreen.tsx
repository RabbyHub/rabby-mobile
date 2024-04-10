import React from 'react';
import { useTranslation } from 'react-i18next';
import ScanLedgerSVG from '@/assets/icons/sign/scan-ledger.svg';
import { openExternalUrl } from '@/core/utils/linking';
import { CommonNotFoundDeviceScreen } from '../ConnectCommon/NotFoundDeviceScreen';

export const NotFoundDeviceScreen: React.FC = () => {
  const { t } = useTranslation();

  const handleButton = React.useCallback(() => {
    openExternalUrl(
      'https://support.ledger.com/hc/en-us/articles/360025864773-Fix-Bluetooth-pairing-issues?support=true',
    );
  }, []);

  return (
    <CommonNotFoundDeviceScreen
      titleText={t('page.newAddress.ledger.notFound.title')}
      descriptionText={t('page.newAddress.ledger.notFound.description')}
      DeviceLogo={ScanLedgerSVG}
      footerButtonText={t('page.newAddress.ledger.notFound.buttonText')}
      onFooterButton={handleButton}
    />
  );
};
