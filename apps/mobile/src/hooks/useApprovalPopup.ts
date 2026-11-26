import {
  MODAL_NAMES,
  type APPROVAL_MODAL_NAMES,
} from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
  snapToIndexGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { atom, useAtom } from 'jotai';
import React, { useCallback } from 'react';

const ids = new Set<string>();
const idAtom = atom<string | null>(null);

let closeApprovalPopupImpl: (() => void) | null = null;

const clearPopup = (idToClear: string | null) => {
  if (!idToClear) return;
  removeGlobalBottomSheetModal(idToClear);
  ids.delete(idToClear);
};

/**
 * Close the currently presented approval popup from outside a component.
 *
 * Approval popups live in the legacy `GlobalBottomSheetModal` host, so the
 * 2024-wide "remove all modals" helper cannot dismiss them. Device automation
 * (biz-mock) needs to clear the sheet after rejecting an injected approval.
 */
export function closeApprovalPopup() {
  closeApprovalPopupImpl?.();
}

/**
 * New popup window for approval
 */
export const useApprovalPopup = () => {
  const [id, setId] = useAtom(idAtom);

  const showPopup = useCallback(
    (approvalComponent?: APPROVAL_MODAL_NAMES) => {
      const _id = createGlobalBottomSheetModal({
        name: MODAL_NAMES.APPROVAL,
        approvalComponent,
      });
      setId(_id);
      ids.add(_id);
    },
    [setId],
  );

  const enablePopup = useCallback((type: string) => {
    if (type) {
      return true;
    }

    return false;
  }, []);

  const closePopup = useCallback(() => {
    clearPopup(id);
  }, [id]);

  React.useEffect(() => {
    closeApprovalPopupImpl = closePopup;
    return () => {
      if (closeApprovalPopupImpl === closePopup) {
        closeApprovalPopupImpl = null;
      }
    };
  }, [closePopup]);

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
