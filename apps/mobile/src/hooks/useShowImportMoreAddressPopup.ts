import { useRef } from 'react';

import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';
import { Keyboard } from 'react-native';
import { KeyringAccountWithAlias } from './account';

export const useShowImportMoreAddressPopup = () => {
  const modalRef =
    useRef<ReturnType<typeof createGlobalBottomSheetModal2024>>();

  const showImportMorePopup = useMemoizedFn(
    (params: {
      type: KEYRING_TYPE;
      mnemonics?: string;
      passphrase?: string;
      keyringId?: number;
      account?: KeyringAccountWithAlias;
      brandName: string;
    }) => {
      Keyboard.dismiss();
      if (modalRef.current) {
        return;
      }

      modalRef.current = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.IMPORT_MORE_ADDRESS,
        params,
        bottomSheetModalProps: {
          onDismiss: () => {
            modalRef.current = undefined;
          },
        },
        onCancel: () => {
          if (modalRef.current) {
            removeGlobalBottomSheetModal2024(modalRef.current);
          }
        },
      });
    },
  );

  return {
    showImportMorePopup,
  };
};
