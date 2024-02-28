import { RootNames } from '@/constant/layout';
import { apiLedger } from '@/core/apis';
import { useLedgerImport } from '@/hooks/ledger/useLedgerImport';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useAtom } from 'jotai';
import React from 'react';
import { Device } from 'react-native-ble-plx';
import { isLoadedAtom, settingAtom } from '../HDSetting/MainContainer';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { SelectDeviceScreen } from './SelectDeviceScreen';

export const ConnectLedger: React.FC<{
  onDone?: () => void;
  onSelectDevice?: (d: Device) => void;
}> = ({ onDone, onSelectDevice }) => {
  const { searchAndPair, devices, errorCode } = useLedgerImport();
  const [_1, setIsLoaded] = useAtom(isLoadedAtom);
  const [_2, setSetting] = useAtom(settingAtom);

  const [currentScreen, setCurrentScreen] = React.useState<
    'scan' | 'select' | 'ble'
  >('ble');

  const handleBleNext = React.useCallback(() => {
    setCurrentScreen('scan');
    searchAndPair();
  }, [searchAndPair]);

  const handleScanDone = React.useCallback(() => {
    setCurrentScreen('select');
  }, []);

  const handleSelectDevice = React.useCallback(
    async device => {
      apiLedger.setDeviceId(device.id);
      if (onSelectDevice) {
        onSelectDevice(device);
      } else {
        setIsLoaded(false);
        await apiLedger
          .getCurrentUsedHDPathType()
          .then(res => {
            setSetting(prev => ({
              ...prev,
              hdPath: res ?? LedgerHDPathType.LedgerLive,
            }));
          })
          .then(() => {
            navigate(RootNames.ImportLedger, {});
            onDone?.();
          });
      }
    },

    [onDone, onSelectDevice, setIsLoaded, setSetting],
  );

  React.useEffect(() => {
    if (devices.length) {
      handleScanDone();
    }
  }, [devices, handleScanDone]);

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
          errorCode={errorCode}
        />
      )}
    </BottomSheetView>
  );
};
