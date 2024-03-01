import { RootNames } from '@/constant/layout';
import { apiLedger } from '@/core/apis';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { useLedgerImport } from '@/hooks/ledger/useLedgerImport';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Device } from 'react-native-ble-plx';
import { isLoadedAtom, settingAtom } from '../HDSetting/MainContainer';
import { toast } from '../Toast';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { NotFoundDeviceScreen } from './NotFoundDeviceScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { SelectDeviceScreen } from './SelectDeviceScreen';

export const ConnectLedger: React.FC<{
  onDone?: () => void;
  onSelectDevice?: (d: Device) => void;
  deviceId?: string;
}> = ({ onDone, onSelectDevice, deviceId }) => {
  const { searchAndPair, devices, errorCode } = useLedgerImport();
  const [_1, setIsLoaded] = useAtom(isLoadedAtom);
  const [_2, setSetting] = useAtom(settingAtom);
  const { t } = useTranslation();
  const [currentScreen, setCurrentScreen] = React.useState<
    'scan' | 'select' | 'ble' | 'notfound'
  >('ble');
  const notfoundTimerRef = React.useRef<any>(null);

  const handleBleNext = React.useCallback(() => {
    setCurrentScreen('scan');
    searchAndPair();
    notfoundTimerRef.current = setTimeout(() => {
      setCurrentScreen('notfound');
    }, 5000);
  }, [searchAndPair]);

  const handleScanDone = React.useCallback(() => {
    setCurrentScreen('select');
    clearTimeout(notfoundTimerRef.current);
  }, []);

  const handleSelectDevice = React.useCallback(
    async device => {
      apiLedger.setDeviceId(device.id);
      if (onSelectDevice) {
        onSelectDevice(device);
      } else {
        setIsLoaded(false);
        let address;
        try {
          address = await apiLedger.importFirstAddress();
        } catch (err: any) {
          const code = ledgerErrorHandler(err);
          if (code === LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP) {
            toast.show(t('page.newAddress.ledger.error.lockedOrNoEthApp'));
          }
          console.error(err);
          setIsLoaded(true);

          return;
        }

        if (address) {
          navigate(RootNames.StackAddress, {
            screen: RootNames.ImportSuccess,
            params: {
              type: KEYRING_TYPE.LedgerKeyring,
              brandName: KEYRING_CLASS.HARDWARE.LEDGER,
              address,
              isLedgerFirstImport: true,
            },
          });
          onDone?.();
        } else {
          await apiLedger
            .getCurrentUsedHDPathType()
            .then(res => {
              const hdPathType = res ?? LedgerHDPathType.LedgerLive;
              apiLedger.setHDPathType(hdPathType);
              setSetting({
                startNumber: 1,
                hdPath: hdPathType,
              });
            })
            .then(() => {
              navigate(RootNames.ImportLedger, {});
              onDone?.();
            });
        }
      }
    },

    [onDone, onSelectDevice, setIsLoaded, setSetting, t],
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
          currentDeviceId={deviceId}
        />
      )}
      {currentScreen === 'notfound' && <NotFoundDeviceScreen />}
    </BottomSheetView>
  );
};
