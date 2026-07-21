// Forked from: https://github.com/rainbow-me/rainbow/blob/5ae2fba13376609907fa823e27e5d3ee8dfa4664/src/hooks/useLedgerImport.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkAndRequestAndroidBluetooth,
  showBluetoothPermissionsAlert,
  showBluetoothPoweredOffAlert,
} from '../../utils/bluetoothPermissions';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from './error';
import { Platform } from 'react-native';
import { apiLedger } from '@/core/apis';
import type { LedgerDmkDevice } from '@/core/keyring-bridge/ledger/ledger-dmk';

/**
 * React hook used for checking connecting to a ledger device for the first time
 */
export function useLedgerImport() {
  const stopSearchRef = useRef<(() => void | Promise<void>) | undefined>(
    undefined,
  );
  const searchTransitionRef = useRef(Promise.resolve());
  const searchVersionRef = useRef(0);
  const [devices, setDevices] = useState<LedgerDmkDevice[]>([]);
  const [errorCode, setErrorCode] = useState<LEDGER_ERROR_CODES>();

  const stopCurrentSearch = useCallback(async () => {
    const stopSearch = stopSearchRef.current;
    stopSearchRef.current = undefined;
    await stopSearch?.();
  }, []);

  const handleCleanUp = useCallback(() => {
    console.log('[LedgerImport] - Cleaning up');
    searchVersionRef.current += 1;
    searchTransitionRef.current = searchTransitionRef.current
      .catch(() => undefined)
      .then(stopCurrentSearch);
  }, [stopCurrentSearch]);
  /**
   * Handles local error handling for useLedgerStatusCheck
   */
  const handlePairError = useCallback(async (error: Error) => {
    console.error(new Error('[LedgerImport] - Pairing Error'), {
      error,
    });

    const errorCode = ledgerErrorHandler(error);
    if (errorCode === LEDGER_ERROR_CODES.BLUETOOTH_PERMISSION_DENIED) {
      setErrorCode(errorCode);
      if (Platform.OS === 'ios') {
        await showBluetoothPermissionsAlert();
      } else {
        await checkAndRequestAndroidBluetooth();
      }
      return;
    }

    if (errorCode === LEDGER_ERROR_CODES.BLUETOOTH_POWERED_OFF) {
      setErrorCode(errorCode);
      void apiLedger.cleanUp().catch(() => {});
      await showBluetoothPoweredOffAlert();
      return;
    }

    setErrorCode?.(errorCode);
  }, []);

  /**
   * Handles successful ledger connection events after opening transport
   */
  const handlePairSuccess = useCallback((device: LedgerDmkDevice) => {
    console.log('[LedgerImport] - Pairing Success');
    setDevices(prev =>
      prev.some(item => item.id === device.id) ? prev : [...prev, device],
    );
  }, []);

  /**
   * searches & pairs to the first found ledger device
   */
  const searchAndPair = useCallback(() => {
    console.debug('[LedgerImport] - Searching for Ledger Device', {});
    setErrorCode(undefined);
    setDevices([]);
    const searchVersion = ++searchVersionRef.current;
    const transition = searchTransitionRef.current
      .catch(() => undefined)
      .then(async () => {
        await stopCurrentSearch();
        if (searchVersion !== searchVersionRef.current) {
          return;
        }

        stopSearchRef.current = apiLedger.searchDevices({
          next: device => {
            try {
              handlePairSuccess(device);
            } catch (e) {
              handlePairError(e as Error);
            }
          },
          error: handlePairError,
        });
      });

    searchTransitionRef.current = transition;
    return transition;
  }, [handlePairError, handlePairSuccess, stopCurrentSearch]);

  /**
   * Init ledger device search
   * Reset conn for testing purposes when sheet is closed
   */

  useEffect(() => {
    const asyncFn = async () => {
      console.log('[LedgerImport] - init device polling', {});

      const isBluetoothEnabled =
        Platform.OS === 'android'
          ? await checkAndRequestAndroidBluetooth()
          : true;
      console.log('[LedgerImport] - bluetooth enabled? ', {
        isBluetoothEnabled,
      });
    };

    asyncFn();

    // cleanup
    return () => {
      handleCleanUp();
    };
  }, [handleCleanUp]);

  return {
    searchAndPair,
    devices,
    errorCode,
  };
}
