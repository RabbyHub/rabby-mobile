// Forked from: https://github.com/rainbow-me/rainbow/blob/5ae2fba13376609907fa823e27e5d3ee8dfa4664/src/hooks/useLedgerImport.ts

import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Subscription } from '@ledgerhq/hw-transport';
import {
  checkAndRequestAndroidBluetooth,
  showBluetoothPermissionsAlert,
  showBluetoothPoweredOffAlert,
} from '../../utils/bluetoothPermissions';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from './error';
import { Platform } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { apiLedger } from '@/core/apis';

/**
 * React hook used for checking connecting to a ledger device for the first time
 */
export function useLedgerImport() {
  const observer = useRef<Subscription | undefined>(undefined);
  const listener = useRef<Subscription | undefined>(undefined);
  const [devices, setDevices] = useState<Device[]>([]);
  const [errorCode, setErrorCode] = useState<LEDGER_ERROR_CODES>();
  const handleCleanUp = () => {
    console.log('[LedgerImport] - Cleaning up');
    observer?.current?.unsubscribe();
    listener?.current?.unsubscribe();
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
  const handlePairSuccess = useCallback((device: Device) => {
    console.log('[LedgerImport] - Pairing Success');
    setDevices(prev => [...prev, device]);
  }, []);

  /**
   * searches & pairs to the first found ledger device
   */
  const searchAndPair = useCallback(() => {
    let currentDeviceId = '';

    console.debug('[LedgerImport] - Searching for Ledger Device', {});
    const newObserver = TransportBLE.observeState({
      // havnt seen complete or error fire yet but its in the docs so keeping for reporting purposes
      complete: () => {
        console.log('[LedgerImport] Observer complete');
      },
      error: (e: any) => {
        console.log('[LedgerImport] Observer error ', { e });
      },
      next: async (e: any) => {
        // App is not authorized to use Bluetooth
        if (e.type === 'Unauthorized') {
          console.log('[LedgerImport] - Bluetooth Unauthorized', {});
          if (Platform.OS === 'ios') {
            await showBluetoothPermissionsAlert();
          } else {
            await checkAndRequestAndroidBluetooth();
          }
        }
        // Bluetooth is turned off
        if (e.type === 'PoweredOff') {
          console.log('[LedgerImport] - Bluetooth Powered Off');
          apiLedger.cleanUp();
          await showBluetoothPoweredOffAlert();
        }
        if (e.available) {
          const newListener = TransportBLE.listen({
            complete: () => {},
            error: error => {
              console.error(new Error('[Ledger Import] - Error Pairing'), {
                errorMessage: (error as Error).message,
              });
            },
            next: async e => {
              if (e.type === 'add') {
                const device = e.descriptor;
                // prevent duplicate alerts
                if (currentDeviceId === device.id) {
                  return;
                }
                // set the current device id to prevent duplicate alerts
                currentDeviceId = device.id;

                try {
                  handlePairSuccess(device);
                } catch (e) {
                  handlePairError(e as Error);
                  currentDeviceId === '';
                }
              }
            },
          });
          listener.current = newListener;
        }
      },
    });

    observer.current = newObserver;
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
