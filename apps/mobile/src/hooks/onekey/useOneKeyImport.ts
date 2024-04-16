import { useAtom } from 'jotai';
import type { SearchDevice } from '@onekeyfe/hd-core';
import { apiOneKey } from '@/core/apis';
import React from 'react';
import { oneKeyDevices } from '@/core/apis/onekey';

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

  const cleanDevices = React.useCallback(() => {
    setDevices([]);
  }, [setDevices]);

  return { startScan, devices, error, cleanDevices };
}
