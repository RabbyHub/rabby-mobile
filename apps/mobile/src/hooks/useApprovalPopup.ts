import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
  snapToIndexGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { atom, useAtom } from 'jotai';
import React from 'react';

const idAtom = atom<string | null>(null);

/**
 * New popup window for approval
 */
export const useApprovalPopup = () => {
  const [id, setId] = useAtom(idAtom);

  const showPopup = () => {
    const _id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.APPROVAL,
    });
    setId(_id);
  };

  const enablePopup = (type: string) => {
    if (type) {
      return true;
    }

    return false;
  };

  const closePopup = () => {
    removeGlobalBottomSheetModal(id);
  };

  const snapToIndexPopup = React.useCallback(
    (index: number) => {
      if (id) {
        snapToIndexGlobalBottomSheetModal(id, index);
      }
    },
    [id],
  );

  return {
    closePopup,
    showPopup,
    enablePopup,
    snapToIndexPopup,
  };
};
