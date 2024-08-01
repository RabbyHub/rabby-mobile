import { RootNames } from '@/constant/layout';
import { apiOneKey } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React from 'react';
import { settingAtom } from '../HDSetting/MainContainer';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { NotFoundDeviceScreen } from './NotFoundDeviceScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { SelectDeviceScreen } from './SelectDeviceScreen';
import { useOneKeyImport } from '@/hooks/onekey/useOneKeyImport';
import { ConnectDeviceScreen } from './ConnectDeviceScreen';
import { eventBus, EVENTS } from '@/utils/events';
import AutoLockView from '../AutoLockView';

export const ConnectOneKey: React.FC<{
  onDone?: () => void;
  onSelectDeviceId?: (id: string) => void;
  deviceId?: string;
}> = ({ onDone, onSelectDeviceId, deviceId }) => {
  const [_2, setSetting] = useAtom(settingAtom);
  const [currentScreen, setCurrentScreen] = React.useState<
    'scan' | 'select' | 'ble' | 'notfound' | 'connect'
  >('ble');
  const notfoundTimerRef = React.useRef<any>(null);
  const { devices, startScan, error, cleanDevices } = useOneKeyImport();

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
      navigate(RootNames.ImportMoreAddress, {
        type: KEYRING_TYPE.OneKeyKeyring,
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

      try {
        await apiOneKey.unlockDevice();
        await importFirstAddress();
      } catch (e) {
        console.error('OneKey import error', e);
        setCurrentScreen('select');
      }
    },

    [importFirstAddress, onSelectDeviceId],
  );

  React.useEffect(() => {
    if (devices.length) {
      handleScanDone();
    }
  }, [devices, handleScanDone]);

  return (
    <AutoLockView as="BottomSheetView">
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
      {currentScreen === 'connect' && <ConnectDeviceScreen />}
    </AutoLockView>
  );
};
