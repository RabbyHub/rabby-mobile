import { RootNames } from '@/constant/layout';
import { apiKeystone } from '@/core/apis';
import { navigateDeprecated } from '@/utils/navigation';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import React from 'react';
import { CameraPermissionScreen } from './CameraPermissionScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';
import { useImportKeystone } from './useImportKeystone';
import AutoLockView from '../AutoLockView';

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
      navigateDeprecated(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: HARDWARE_KEYRING_TYPES.Keystone.type as KEYRING_TYPE,
          brandName: HARDWARE_KEYRING_TYPES.Keystone.brandName,
          address,
          isFirstImport: true,
        },
      });
      onDone?.();
    } else {
      goImport();
      onDone?.();
    }
  }, [goImport, onDone]);

  return (
    <AutoLockView as="View" style={{ height: '100%' }}>
      {currentScreen === 'camera' && (
        <CameraPermissionScreen onNext={handleCameraNext} />
      )}
      {currentScreen === 'scan' && (
        <ScanDeviceScreen onScanFinish={handleImportAddress} />
      )}
    </AutoLockView>
  );
};
