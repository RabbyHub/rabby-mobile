import { RootNames } from '@/constant/layout';
import { apiKeystone } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import React from 'react';
import { CameraPermissionScreen } from './CameraPermissionScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { useImportKeystone } from './useImportKeystone';

export const ConnectKeystone: React.FC<{
  onDone?: () => void;
}> = ({ onDone }) => {
  const [currentScreen, setCurrentScreen] = React.useState<'scan' | 'camera'>(
    'camera',
  );

  const handleCameraNext = React.useCallback(async () => {
    setCurrentScreen('scan');
  }, []);

  const goImport = useImportKeystone();

  const handleImportAddress = React.useCallback(async () => {
    const address = await apiKeystone.importFirstAddress({});

    if (address) {
      navigate(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          type: HARDWARE_KEYRING_TYPES.Keystone.type as KEYRING_TYPE,
          brandName: HARDWARE_KEYRING_TYPES.Keystone.brandName,
          address,
          isKeystoneFirstImport: true,
        },
      });
      onDone?.();
    } else {
      goImport();
      onDone?.();
    }
  }, [goImport, onDone]);

  return (
    <BottomSheetView>
      {currentScreen === 'camera' && (
        <CameraPermissionScreen onNext={handleCameraNext} />
      )}
      {currentScreen === 'scan' && (
        <ScanDeviceScreen onScanFinish={handleImportAddress} />
      )}
    </BottomSheetView>
  );
};
