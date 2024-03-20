import { RootNames } from '@/constant/layout';
import { apiKeystone } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React from 'react';
import { settingAtom } from '../HDSetting/MainContainer';
import { CameraPermissionScreen } from './CameraPermissionScreen';
import { ScanDeviceScreen } from './ScanDeviceScreen';

export const ConnectKeystone: React.FC<{
  onDone?: () => void;
}> = ({ onDone }) => {
  const [_2, setSetting] = useAtom(settingAtom);
  const [currentScreen, setCurrentScreen] = React.useState<'scan' | 'camera'>(
    'camera',
  );

  const handleCameraNext = React.useCallback(async () => {
    if (await apiKeystone.isReady()) {
      navigate(RootNames.ImportHardware, {
        type: KEYRING_CLASS.HARDWARE.KEYSTONE,
      }); // TODO
      onDone?.();
    } else {
      setCurrentScreen('scan');
    }
  }, [onDone]);

  const handleImportAddress = React.useCallback(async () => {
    const address = await apiKeystone.importFirstAddress({});

    if (address) {
      navigate(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          type: KEYRING_TYPE.KeystoneKeyring,
          brandName: KEYRING_CLASS.HARDWARE.KEYSTONE,
          address,
          isKeystoneFirstImport: true,
        },
      });
      onDone?.();
    } else {
      await apiKeystone
        .getCurrentUsedHDPathType()
        .then(res => {
          const hdPathType = res ?? LedgerHDPathType.BIP44;
          setSetting({
            startNumber: 1,
            hdPath: hdPathType,
          });
        })
        .then(() => {
          navigate(RootNames.ImportHardware, {
            type: KEYRING_CLASS.HARDWARE.KEYSTONE,
          });
          onDone?.();
        });
    }
  }, [onDone, setSetting]);

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
