import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LedgerDmkDevice } from '@/core/keyring-bridge/ledger/ledger-dmk';
import {
  CommonSelectDeviceScreen,
  Props,
} from '../ConnectCommon/SelectDeviceScreen';

export const SelectDeviceScreen: React.FC<
  Pick<Props, 'errorCode' | 'onSelect' | 'currentDeviceId'> & {
    devices: LedgerDmkDevice[];
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
      DeviceLogo={
        <WalletIcon type={KEYRING_TYPE.LedgerKeyring} borderRadius={20} />
      }
    />
  );
};
