import TransportBLE from '@ledgerhq/react-native-hw-transport-ble';
import { useCallback, useEffect, useRef } from 'react';
import { Subscription } from '@ledgerhq/hw-transport';
import { checkAndRequestAndroidBluetooth } from '../../utils/bluetoothPermissions';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from './error';
import { Platform } from 'react-native';

/**
 * React hook used for checking connecting to a ledger device for the first time
 */
export function useLedgerImport({
  errorCallback,
  successCallback,
}: {
  successCallback?: (deviceId: string) => void;
  errorCallback?: (errorType: LEDGER_ERROR_CODES) => void;
}) {
  const observer = useRef<Subscription | undefined>(undefined);
  const listener = useRef<Subscription | undefined>(undefined);

  const handleCleanUp = () => {
    observer?.current?.unsubscribe();
    listener?.current?.unsubscribe();
  };
  /**
   * Handles local error handling for useLedgerStatusCheck
   */
  const handlePairError = useCallback(
    (error: Error) => {
      console.error(new Error('[LedgerImport] - Pairing Error'), {
        error,
      });
      errorCallback?.(ledgerErrorHandler(error));
    },
    [errorCallback],
  );

  /**
   * Handles successful ledger connection events after opening transport
   */
  const handlePairSuccess = useCallback(
    (deviceId: string) => {
      console.log('[LedgerImport] - Pairing Success');
      successCallback?.(deviceId);
      handleCleanUp();
    },
    [successCallback],
  );

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
          // TODO
          // if (IS_IOS) {
          //   await showBluetoothPermissionsAlert();
          // } else {
          //   await checkAndRequestAndroidBluetooth();
          // }
        }
        // Bluetooth is turned off
        if (e.type === 'PoweredOff') {
          console.log('[LedgerImport] - Bluetooth Powered Off');
          // TODO
          // await showBluetoothPoweredOffAlert();
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
                  const transport = await TransportBLE.open(device.id);
                  handlePairSuccess(device.id);
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
    console.log('newObserver', newObserver);

    observer.current = newObserver;
  }, [handlePairError, handlePairSuccess]);

  /**
   * Init ledger device search
   * Reset conn for testing purposes when sheet is closed
   */

  useEffect(() => {
    const asyncFn = async () => {
      console.log('[LedgerImport] - init device polling', {});

      // const isBluetoothEnabled =
      //   Platform.OS === 'android'
      //     ? await checkAndRequestAndroidBluetooth()
      //     : true;
      // console.log('[LedgerImport] - bluetooth enabled? ', {
      //   isBluetoothEnabled,
      // });
      // if (isBluetoothEnabled) {
      searchAndPair();
      // }
    };

    asyncFn();

    // cleanup
    return () => {
      handleCleanUp();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
