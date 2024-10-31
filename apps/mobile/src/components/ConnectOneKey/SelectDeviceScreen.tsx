import React from 'react';
import type { SearchDevice } from '@onekeyfe/hd-core';
import {
  CommonSelectDeviceScreen,
  Props,
} from '../ConnectCommon/SelectDeviceScreen';
import { useTranslation } from 'react-i18next';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

export const SelectDeviceScreen: React.FC<
  Pick<Props, 'errorCode' | 'onSelect' | 'currentDeviceId'> & {
    devices: SearchDevice[];
  }
> = ({ devices, ...props }) => {
  const deviceMeta = React.useMemo(
    () => devices.map(d => ({ id: d.connectId, name: d.name })),
    [devices],
  );
  const { t } = useTranslation();

  return (
    <CommonSelectDeviceScreen
      {...props}
      titleText={t('page.newAddress.onekey.select.title')}
      descriptionText={t('page.newAddress.onekey.select.description')}
      currentDeviceText={t('page.newAddress.onekey.select.currentDevice')}
      devices={deviceMeta}
      DeviceLogo={
        <WalletIcon type={KEYRING_TYPE.OneKeyKeyring} borderRadius={20} />
      }
    />
  );
};
