import { RootNames } from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React, { useEffect } from 'react';
import { settingAtom } from '../HDSetting/MainContainer';
import { useShowImportMoreAddressPopup } from '@/hooks/useShowImportMoreAddressPopup';
import { apiKeystone } from '@/core/apis';

export const useImportKeystone = () => {
  const [_2, setSetting] = useAtom(settingAtom);
  const { showImportMorePopup } = useShowImportMoreAddressPopup();
  const ref = React.useRef<LedgerHDPathType>(LedgerHDPathType.BIP44);

  useEffect(() => {
    apiKeystone
      .getCurrentUsedHDPathType()
      .then(type => {
        if (type) {
          ref.current = type;
        }
      })
      .catch(() => {
        console.log("Failed to get Keystone's HD Path Type, use default BIP44");
        ref.current = LedgerHDPathType.BIP44;
      });
  }, []);

  const goImport = React.useCallback(() => {
    setSetting({
      startNumber: 1,
      hdPath: ref.current || LedgerHDPathType.BIP44,
    });
    // navigateDeprecated(RootNames.StackAddress, {
    //   screen: RootNames.ImportMoreAddress,
    //   params: {
    //     type: HARDWARE_KEYRING_TYPES.Keystone.type as KEYRING_TYPE,
    //     brand: HARDWARE_KEYRING_TYPES.Keystone.brandName,
    //   },
    // });
    showImportMorePopup({
      type: HARDWARE_KEYRING_TYPES.Keystone.type as KEYRING_TYPE,
      brandName: HARDWARE_KEYRING_TYPES.Keystone.brandName,
    });
  }, [setSetting, showImportMorePopup]);

  return goImport;
};
