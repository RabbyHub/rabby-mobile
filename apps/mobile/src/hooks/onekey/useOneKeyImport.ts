import type { SearchDevice } from '@onekeyfe/hd-core';
import { apiOneKey } from '@/core/apis';
import React from 'react';
import { useOneKeyDevices } from '@/core/apis/onekey';
import { requestAndroidBleScanPermissions } from '@/utils/bluetoothPermissions';
import { ONEKEY_ERROR_CODE, getOneKeyErrorCode } from '@/utils/onekeyError';

export type OneKeyScanStatus =
  | 'idle'
  | 'scanning'
  | 'found'
  | 'notFound'
  | 'error';

export function useOneKeyImport() {
  const { devices, setOneKeyDevices } = useOneKeyDevices();
  const [error, setError] = React.useState<string | number | undefined>();
  const [status, setStatus] = React.useState<OneKeyScanStatus>('idle');
  // Bumped on every new scan and on stopScan(); together with mountedRef it
  // keeps a scan that is still running from updating state that belongs to a
  // newer scan or to a sheet that was already closed.
  const scanIdRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startScan = React.useCallback(async () => {
    const scanId = ++scanIdRef.current;
    const isCurrent = () => mountedRef.current && scanIdRef.current === scanId;

    setError(undefined);
    setStatus('scanning');
    // Drop devices from an earlier scan so a stale list is never offered.
    setOneKeyDevices([]);

    const granted = await requestAndroidBleScanPermissions();
    if (!isCurrent()) {
      return;
    }
    if (!granted) {
      setError(ONEKEY_ERROR_CODE.BleLocationError);
      setStatus('error');
      return;
    }

    try {
      const res = await apiOneKey.searchDevices({
        shouldStop: () => !isCurrent(),
      });
      if (!isCurrent()) {
        return;
      }
      if (!res.success) {
        setError(getOneKeyErrorCode(res) ?? res.payload?.error);
        setStatus('error');
        return;
      }
      const found = (res.payload || []) as SearchDevice[];
      setOneKeyDevices(found);
      setStatus(found.length ? 'found' : 'notFound');
    } catch (e) {
      if (!isCurrent()) {
        return;
      }
      setError(
        getOneKeyErrorCode(e) ?? (e instanceof Error ? e.message : String(e)),
      );
      setStatus('error');
    }
  }, [setOneKeyDevices]);

  const stopScan = React.useCallback(() => {
    scanIdRef.current++;
  }, []);

  const cleanDevices = React.useCallback(() => {
    setOneKeyDevices([]);
  }, [setOneKeyDevices]);

  return { startScan, stopScan, devices, error, status, cleanDevices };
}
