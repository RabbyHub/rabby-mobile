import { apiLedger } from '@/core/apis';
import { useLedgerImport } from '@/hooks/ledger/useLedgerImport';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React from 'react';
import { Device } from 'react-native-ble-plx';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { SelectDeviceScreen } from './SelectDeviceScreen';

export const ConnectLedger: React.FC<{
  onDone?: () => void;
  onSelectDevice?: (d: Device) => void;
}> = ({ onDone, onSelectDevice }) => {
  const { searchAndPair, devices, errorCode } = useLedgerImport();

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
    device => {
      apiLedger.setDeviceId(device.id);
      if (onSelectDevice) {
        onSelectDevice(device);
      } else {
        const id = createGlobalBottomSheetModal({
          name: MODAL_NAMES.IMPORT_LEDGER,
          onDone: () => {
            removeGlobalBottomSheetModal(id);
            onDone?.();
          },
        });
      }
    },

    [onDone, onSelectDevice],
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
