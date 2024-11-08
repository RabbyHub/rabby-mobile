import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { KeyringAccountWithAlias } from '@/hooks/account';
import React from 'react';

export const useAddressDetailModal = () => {
  const gotoDetail = React.useCallback(
    ({
      account,
      onCancel,
    }: {
      account: KeyringAccountWithAlias;
      onCancel?: () => void;
    }) => {
      const id = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.ADDRESS_DETAIL,
        account,
        onCancel: () => {
          removeGlobalBottomSheetModal2024(id);
          onCancel?.();
        },
      });
    },
    [],
  );

  return gotoDetail;
};
