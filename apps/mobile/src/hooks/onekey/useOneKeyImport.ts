import { useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import { apiOneKey } from '@/core/apis';
import React from 'react';
import { oneKeyDevices } from '@/core/apis/onekey';
import { checkAndRequestAndroidBluetooth } from '@/utils/bluetoothPermissions';
import { Platform } from 'react-native';

export function useOneKeyImport() {
  const [devices, setDevices] = useAtom(oneKeyDevices);
  const [error, setError] = React.useState<string | number | undefined>();

  const startScan = React.useCallback(async () => {
    const isBluetoothEnabled =
      Platform.OS === 'android'
        ? await checkAndRequestAndroidBluetooth()
        : true;

    console.log('[OneKeyImport] - bluetooth enabled? ', {
      isBluetoothEnabled,
    });

    apiOneKey.searchDevices().then(res => {
      if (res.success) {
        setDevices(res.payload as SearchDevice[]);
      } else {
        setError(res.payload.code);
      }
    });
  }, [setDevices]);

  const cleanDevices = React.useCallback(() => {
    setDevices([]);
  }, [setDevices]);

  return { startScan, devices, error, cleanDevices };
}
