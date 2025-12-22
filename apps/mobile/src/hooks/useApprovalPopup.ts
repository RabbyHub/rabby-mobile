import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
  snapToIndexGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import React, { useCallback } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

const ids = new Set<string>();
const idState = zCreate<string | null>(() => null);
function setId(valOrFunc: UpdaterOrPartials<string | null>) {
  idState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

const clearPopup = (idToClear: string | null) => {
  if (!idToClear) return;
  removeGlobalBottomSheetModal(idToClear);
  ids.delete(idToClear);
};

/**
 * New popup window for approval
 */
export const useApprovalPopup = () => {
  // const [id, setId] = useAtom(idAtom);
  const id = idState();

  const showPopup = useCallback(() => {
    const _id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.APPROVAL,
    });
    setId(_id);
    ids.add(_id);
  }, []);

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
