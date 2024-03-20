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
import { toast, toastIndicator } from '../Toast';
import { BluetoothPermissionScreen } from './BluetoothPermissionScreen';
import { NotFoundDeviceScreen } from './NotFoundDeviceScreen';
import { OpenEthAppScreen } from './OpenEthAppScreen';
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
    'scan' | 'select' | 'ble' | 'notfound' | 'openEthApp'
  >('ble');
  const notfoundTimerRef = React.useRef<any>(null);
  const openEthAppExpiredTimerRef = React.useRef<any>(null);
  let toastHiddenRef = React.useRef<() => void>(() => {});
  let loopCountRef = React.useRef(0);

  const handleBleNext = React.useCallback(async () => {
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

  const checkEthApp = React.useCallback(async () => {
    try {
      return await apiLedger.checkEthApp(result => {
        if (!result) {
          setCurrentScreen('openEthApp');
          clearTimeout(openEthAppExpiredTimerRef.current);
          openEthAppExpiredTimerRef.current = setTimeout(() => {
            setCurrentScreen('select');
          }, 60000);
        }
      });
    } catch (err: any) {
      // maybe session is disconnect, just try to reconnect
      if (loopCountRef.current < 3) {
        loopCountRef.current++;
        console.log('checkEthApp isConnected error', err);
        return await checkEthApp();
      }
      toast.show(t('page.newAddress.ledger.error.lockedOrNoEthApp'));
      setCurrentScreen('select');
      console.error('checkEthApp', err);
      throw err;
    }
  }, [t]);

  const importFirstAddress = React.useCallback(
    async (retryCount: number) => {
      loopCountRef.current = 0;
      setIsLoaded(false);
      let address;
      try {
        address = await apiLedger.importFirstAddress({
          retryCount,
        });
      } catch (err: any) {
        const code = ledgerErrorHandler(err);
        if (code === LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP) {
          toast.show(t('page.newAddress.ledger.error.lockedOrNoEthApp'));
        }
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
            navigate(RootNames.ImportHardware, {
              type: KEYRING_TYPE.LedgerKeyring,
            });
            onDone?.();
          });
      }
    },
    [onDone, setIsLoaded, setSetting, t],
  );

  const handleSelectDevice = React.useCallback(
    async device => {
      apiLedger.setDeviceId(device.id);
      if (onSelectDevice) {
        onSelectDevice(device);
      } else {
        if (await checkEthApp()) {
          await importFirstAddress(1);
        } else {
          toastHiddenRef.current = toastIndicator('Connecting', {
            isTop: true,
          });
          // maybe need to reconnect device
          await importFirstAddress(5);
          toastHiddenRef.current?.();
        }
      }
    },

    [checkEthApp, importFirstAddress, onSelectDevice],
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
          errorCode={errorCode}
          currentDeviceId={deviceId}
        />
      )}
      {currentScreen === 'notfound' && <NotFoundDeviceScreen />}
      {currentScreen === 'openEthApp' && <OpenEthAppScreen />}
    </BottomSheetView>
  );
};
