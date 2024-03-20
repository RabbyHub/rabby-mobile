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
import { Text } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { isLoadedAtom, settingAtom } from '../HDSetting/MainContainer';
import { toast } from '../Toast';
import { CameraPermissionScreen } from './CameraPermissionScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';

export const ConnectKeystone: React.FC<{
  onDone?: () => void;
  onSelectDevice?: (d: Device) => void;
  deviceId?: string;
}> = ({ onDone, onSelectDevice, deviceId }) => {
  const [_1, setIsLoaded] = useAtom(isLoadedAtom);
  const [_2, setSetting] = useAtom(settingAtom);
  const { t } = useTranslation();
  const [currentScreen, setCurrentScreen] = React.useState<'scan' | 'camera'>(
    'camera',
  );

  const handleCameraNext = React.useCallback(() => {
    setCurrentScreen('scan');
  }, []);

  return (
    <BottomSheetView>
      {currentScreen === 'camera' && (
        <CameraPermissionScreen onNext={handleCameraNext} />
      )}
      {currentScreen === 'scan' && <ScanDeviceScreen />}
    </BottomSheetView>
  );
};
