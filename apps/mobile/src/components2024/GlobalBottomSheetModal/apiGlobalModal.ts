import { type RefLikeObject } from '@/utils/type';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from './types';
import { shouldRedirectToSetPasswordBefore2024 } from '@/hooks/useLock';

const modalRef: RefLikeObject<
  ReturnType<typeof createGlobalBottomSheetModal2024> | undefined
> = { current: undefined };
function showAddSelectMethodModal() {
  if (modalRef.current) {
    removeGlobalBottomSheetModal2024(modalRef.current);
    modalRef.current = undefined;
  }

  const id = createGlobalBottomSheetModal2024({
    name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
    onDone: () => {
      removeGlobalBottomSheetModal2024(id);
    },
    shouldRedirectToSetPasswordBefore2024,
  });

  modalRef.current = id;

  return modalRef.current;
}

export const apiGlobalModal = {
  showAddSelectMethodModal,
};
