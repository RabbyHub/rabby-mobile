import React from 'react';
import type { SearchDevice } from '@onekeyfe/hd-core';
import {
  CommonSelectDeviceScreen,
  Props,
} from '../ConnectCommon/SelectDeviceScreen';
import { useTranslation } from 'react-i18next';
import OneKeySVG from '@/assets/icons/wallet/onekey.svg';

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
      DeviceLogo={OneKeySVG}
    />
  );
};
