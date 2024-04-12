import { atom, useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import { apiOneKey } from '@/core/apis';
import React from 'react';
import HardwareBleSdk from '@onekeyfe/hd-ble-sdk';
import { DEVICE_EVENT, DEVICE } from '@onekeyfe/hd-core';

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
    HardwareBleSdk.on(DEVICE_EVENT, e => {
      console.log('断开了啊啊啊啊啊', e);
      switch (e.type) {
        case DEVICE.DISCONNECT:
          setDevices(prev =>
            prev.filter(d => d.connectId !== e.payload?.device?.connectId),
          );
          break;

        default:
        // NOTHING
      }
    });
  }, [setDevices]);

  return { startScan, devices, error };
}
