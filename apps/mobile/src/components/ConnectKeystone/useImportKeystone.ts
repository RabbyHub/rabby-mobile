import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { useAtom } from 'jotai';
import React from 'react';
import { settingAtom } from '../HDSetting/MainContainer';

export const useImportKeystone = () => {
  const [_2, setSetting] = useAtom(settingAtom);

  const goImport = React.useCallback(() => {
    setSetting({
      startNumber: 1,
      hdPath: LedgerHDPathType.BIP44,
    });
    navigate(RootNames.ImportMoreAddress, {
      type: HARDWARE_KEYRING_TYPES.Keystone.type as KEYRING_TYPE,
      brand: HARDWARE_KEYRING_TYPES.Keystone.brandName,
    });
  }, [setSetting]);

  return goImport;
};
