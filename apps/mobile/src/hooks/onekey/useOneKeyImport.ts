import { atom, useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import { apiOneKey } from '@/core/apis';
import React from 'react';
import HardwareBleSdk from '@onekeyfe/hd-ble-sdk';
import { DEVICE } from '@onekeyfe/hd-core';

const oneKeyDevices = atom<SearchDevice[]>([]);

export function useOneKeyImport() {
  const [devices, setDevices] = useAtom(oneKeyDevices);
  const [error, setError] = React.useState<string | number | undefined>();

  const startScan = React.useCallback(async () => {
    apiOneKey.searchDevices().then(res => {
      if (res.success) {
        setDevices(res.payload as SearchDevice[]);
      } else {
        setError(res.payload.code);
      }
    });
  }, [setDevices]);

  React.useEffect(() => {
    HardwareBleSdk.on(DEVICE.DISCONNECT, payload => {
      apiOneKey.cleanUp();
      setDevices(prev =>
        prev.filter(d => d.connectId !== payload?.device?.connectId),
      );
    });
  }, [setDevices]);

  return { startScan, devices, error };
}
