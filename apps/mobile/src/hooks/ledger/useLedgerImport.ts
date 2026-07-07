// Forked from: https://github.com/rainbow-me/rainbow/blob/5ae2fba13376609907fa823e27e5d3ee8dfa4664/src/hooks/useLedgerImport.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import { checkAndRequestAndroidBluetooth } from '../../utils/bluetoothPermissions';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from './error';
import { Platform } from 'react-native';
import { apiLedger } from '@/core/apis';
import type { LedgerDmkDevice } from '@/core/keyring-bridge/ledger/ledger-dmk';

/**
 * React hook used for checking connecting to a ledger device for the first time
 */
export function useLedgerImport() {
  const stopSearchRef = useRef<(() => void) | undefined>(undefined);
  const [devices, setDevices] = useState<LedgerDmkDevice[]>([]);
  const [errorCode, setErrorCode] = useState<LEDGER_ERROR_CODES>();
  const handleCleanUp = () => {
    console.log('[LedgerImport] - Cleaning up');
    stopSearchRef.current?.();
    stopSearchRef.current = undefined;
  };
  /**
   * Handles local error handling for useLedgerStatusCheck
   */
  const handlePairError = useCallback((error: Error) => {
    console.error(new Error('[LedgerImport] - Pairing Error'), {
      error,
    });
    setErrorCode?.(ledgerErrorHandler(error));
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
    stopSearchRef.current?.();
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
  }, [handlePairError, handlePairSuccess]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    searchAndPair,
    devices,
    errorCode,
  };
}
