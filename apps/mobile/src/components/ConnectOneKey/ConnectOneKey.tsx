import { RootNames } from '@/constant/layout';
import { apiOneKey } from '@/core/apis';
import { navigateDeprecated } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React from 'react';
import { Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components2024/Toast';
import {
  ONEKEY_ERROR_CODE,
  getOneKeyErrorCode,
  getOneKeyErrorMessage,
  isOneKeyUserCancelError,
} from '@/utils/onekeyError';
import { settingAtom } from '../HDSetting/MainContainer';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { NotFoundDeviceScreen } from './NotFoundDeviceScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { SelectDeviceScreen } from './SelectDeviceScreen';
import { useOneKeyImport } from '@/hooks/onekey/useOneKeyImport';
import AutoLockView from '../AutoLockView';
import { useShowImportMoreAddressPopup } from '@/hooks/useShowImportMoreAddressPopup';

export const ConnectOneKey: React.FC<{
  onDone?: () => void;
  onSelectDeviceId?: (id: string) => void | Promise<void>;
  deviceId?: string;
}> = ({ onDone, onSelectDeviceId, deviceId }) => {
  const { t } = useTranslation();
  const [_2, setSetting] = useAtom(settingAtom);
  const [currentScreen, setCurrentScreen] = React.useState<
    'scan' | 'select' | 'ble' | 'notfound' | 'error'
  >('ble');
  const { devices, startScan, stopScan, error, status } = useOneKeyImport();
  // True while a device is selected and we wait for it (unlock, PIN,
  // passphrase, address import). Guards double taps and tells unmount that
  // the device has to be released.
  const connectingRef = React.useRef(false);
  const unmountedRef = React.useRef(false);

  const { showImportMorePopup } = useShowImportMoreAddressPopup();

  const handleBleNext = React.useCallback(async () => {
    setCurrentScreen('scan');
    startScan();
  }, [startScan]);

  React.useEffect(() => {
    if (status === 'found') {
      setCurrentScreen('select');
    } else if (status === 'notFound') {
      setCurrentScreen('notfound');
    } else if (status === 'error') {
      setCurrentScreen('error');
    }
  }, [status]);

  React.useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopScan();
      if (connectingRef.current) {
        // The sheet was closed while the device was still waiting for the
        // user (PIN, passphrase, confirmation): release it.
        apiOneKey.cancel();
      }
    };
  }, [stopScan]);

  const importFirstAddress = React.useCallback(async () => {
    const address = await apiOneKey.importFirstAddress({});

    if (address) {
      navigateDeprecated(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: KEYRING_TYPE.OneKeyKeyring,
          brandName: KEYRING_CLASS.HARDWARE.ONEKEY,
          address,
          isFirstImport: true,
        },
      });
      onDone?.();
    } else {
      setSetting({
        startNumber: 1,
        hdPath: LedgerHDPathType.BIP44,
      });
      showImportMorePopup({
        type: KEYRING_TYPE.OneKeyKeyring,
        brandName: KEYRING_CLASS.HARDWARE.ONEKEY,
      });
      onDone?.();
    }
  }, [onDone, setSetting, showImportMorePopup]);

  const handleSelectDevice = React.useCallback(
    async ({ id }) => {
      if (connectingRef.current) {
        return;
      }
      connectingRef.current = true;
      try {
        await apiOneKey.setDeviceConnectId(id);

        if (onSelectDeviceId) {
          await onSelectDeviceId(id);
          return;
        }

        await apiOneKey.unlockDevice();
        await importFirstAddress();
      } catch (e: any) {
        console.error('OneKey import error', e);
        if (unmountedRef.current) {
          // Closed by the user; the failure is just our own cancel.
          return;
        }
        if (!isOneKeyUserCancelError(getOneKeyErrorCode(e))) {
          toast.show(
            getOneKeyErrorMessage(e, t) ||
              e?.message ||
              t('page.newAddress.onekey.error.disconnected'),
          );
        }
        setCurrentScreen('select');
      } finally {
        connectingRef.current = false;
      }
    },

    [importFirstAddress, onSelectDeviceId, t],
  );

  const isPermissionError =
    getOneKeyErrorCode(error) === ONEKEY_ERROR_CODE.BleLocationError;

  return (
    <AutoLockView as="View" style={{ height: '100%' }}>
      {currentScreen === 'ble' && (
        <BluetoothPermissionScreen onNext={handleBleNext} />
      )}
      {currentScreen === 'scan' && <ScanDeviceScreen />}
      {currentScreen === 'select' && (
        <SelectDeviceScreen
          onSelect={handleSelectDevice}
          devices={devices}
          errorCode={error}
          currentDeviceId={deviceId}
        />
      )}
      {currentScreen === 'notfound' && (
        <NotFoundDeviceScreen
          footerButtonText={t('page.newAddress.onekey.notFound.retry')}
          onFooterButton={handleBleNext}
        />
      )}
      {currentScreen === 'error' && (
        <NotFoundDeviceScreen
          titleText={t('page.newAddress.onekey.ble.title')}
          descriptionText={
            getOneKeyErrorMessage(error, t) ||
            t('page.newAddress.onekey.error.scanFailed')
          }
          footerButtonText={
            isPermissionError
              ? t('page.newAddress.onekey.error.openSettings')
              : t('page.newAddress.onekey.notFound.retry')
          }
          onFooterButton={
            isPermissionError ? () => Linking.openSettings() : handleBleNext
          }
        />
      )}
    </AutoLockView>
  );
};
