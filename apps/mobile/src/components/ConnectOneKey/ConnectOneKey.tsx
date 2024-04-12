import { RootNames } from '@/constant/layout';
import { apiOneKey } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React from 'react';
import { settingAtom } from '../HDSetting/MainContainer';
import { toastIndicator } from '../Toast';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { NotFoundDeviceScreen } from './NotFoundDeviceScreen';
import { OpenEthAppScreen } from './OpenEthAppScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { SelectDeviceScreen } from './SelectDeviceScreen';
import { useOneKeyImport } from '@/hooks/onekey/useOneKeyImport';

export const ConnectOneKey: React.FC<{
  onDone?: () => void;
  onSelectDeviceId?: (id: string) => void;
  deviceId?: string;
}> = ({ onDone, onSelectDeviceId, deviceId }) => {
  const [_2, setSetting] = useAtom(settingAtom);
  const [currentScreen, setCurrentScreen] = React.useState<
    'scan' | 'select' | 'ble' | 'notfound' | 'openEthApp'
  >('ble');
  const notfoundTimerRef = React.useRef<any>(null);
  let toastHiddenRef = React.useRef<() => void>(() => {});
  const { devices, startScan, error } = useOneKeyImport();

  const handleBleNext = React.useCallback(async () => {
    setCurrentScreen('scan');
    startScan();

    // notfoundTimerRef.current = setTimeout(() => {
    //   setCurrentScreen('notfound');
    // }, 5000);
  }, [startScan]);

  const handleScanDone = React.useCallback(() => {
    setCurrentScreen('select');
    clearTimeout(notfoundTimerRef.current);
  }, []);

  const importFirstAddress = React.useCallback(async () => {
    const address = await apiOneKey.importFirstAddress({});

    if (address) {
      navigate(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
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
      navigate(RootNames.ImportHardware, {
        type: HARDWARE_KEYRING_TYPES.OneKey.type as KEYRING_TYPE,
        brand: HARDWARE_KEYRING_TYPES.OneKey.brandName,
      });
      onDone?.();
    }
  }, [onDone, setSetting]);

  const handleSelectDevice = React.useCallback(
    async ({ id }) => {
      apiOneKey.setDeviceConnectId(id);

      if (onSelectDeviceId) {
        onSelectDeviceId(id);
        return;
      }

      toastHiddenRef.current = toastIndicator('Connecting', {
        isTop: true,
      });
      try {
        await apiOneKey.unlockDevice();
        await importFirstAddress();
      } catch (e) {
        console.error('OneKey import error', e);
      } finally {
        toastHiddenRef.current?.();
      }
    },

    [importFirstAddress, onSelectDeviceId],
  );

  React.useEffect(() => {
    if (devices.length) {
      handleScanDone();
    }
  }, [devices, handleScanDone]);

  React.useEffect(() => {
    return () => {
      toastHiddenRef.current?.();
    };
  }, []);

  return (
    <BottomSheetView>
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
      {currentScreen === 'notfound' && <NotFoundDeviceScreen />}
      {currentScreen === 'openEthApp' && <OpenEthAppScreen />}
    </BottomSheetView>
  );
};
