import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
  snapToIndexGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { atom, useAtom } from 'jotai';
import React, { useCallback } from 'react';
import { getActiveDappState } from '@/core/bridges/state';

const ids = new Set<string>();
const idAtom = atom<string | null>(null);

const clearPopup = (idToClear: string | null) => {
  if (!idToClear) return;
  removeGlobalBottomSheetModal(idToClear);
  ids.delete(idToClear);
};

/**
 * New popup window for approval
 */
export const useApprovalPopup = () => {
  const [id, setId] = useAtom(idAtom);

  const showPopup = useCallback(() => {
    const _id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.APPROVAL,
    });
    setId(_id);
    ids.add(_id);
  }, [setId]);

  const enablePopup = useCallback((type: string) => {
    if (type) {
      return true;
    }

    return false;
  }, []);

  const closePopup = useCallback(() => {
    clearPopup(id);
  }, [id]);

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
