import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal/utils';
import { atom, useAtom } from 'jotai';

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

  return {
    closePopup,
    showPopup,
    enablePopup,
  };
};
