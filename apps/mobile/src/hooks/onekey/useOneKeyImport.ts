import { useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import { apiOneKey } from '@/core/apis';
import React from 'react';
import { useOneKeyDevices } from '@/core/apis/onekey';
import { checkAndRequestAndroidBluetooth } from '@/utils/bluetoothPermissions';
import { Platform } from 'react-native';

export function useOneKeyImport() {
  const { devices, setOneKeyDevices } = useOneKeyDevices();
  const [error, setError] = React.useState<string | number | undefined>();

  const startScan = React.useCallback(async () => {
    const isBluetoothEnabled =
      Platform.OS === 'android'
        ? await checkAndRequestAndroidBluetooth()
        : true;

    console.log('[OneKeyImport] - bluetooth enabled? ', {
      isBluetoothEnabled,
    });

    setError(undefined);
    try {
      const res = await apiOneKey.searchDevices();
      if (res.success) {
        setOneKeyDevices(res.payload as SearchDevice[]);
      } else {
        setError(res.payload.code);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [setOneKeyDevices]);

  const cleanDevices = React.useCallback(() => {
    setOneKeyDevices([]);
  }, [setOneKeyDevices]);

  return { startScan, devices, error, cleanDevices };
}
