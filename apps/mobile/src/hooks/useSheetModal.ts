import React from 'react';

import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useToggleShowNavHeader } from './navigation';

function doToggleShowModal(
  ref: React.RefObject<BottomSheetModal>,
  isShown: boolean,
) {
  if (isShown) {
    ref.current?.present();
  } else {
    ref.current?.dismiss();
  }
}

export type DappBottomSheetModalRefs<T extends string = string> = Record<
  T,
  | React.MutableRefObject<BottomSheetModal>
  | React.RefObject<BottomSheetModal>
  | null
>;

export function useSheetModals<T extends string>(
  sheetModalRefs: DappBottomSheetModalRefs<T>,
) {
  const { toggleShowNavHeader } = useToggleShowNavHeader();

  const toggleShowSheetModal = React.useCallback(
    async (type: T, isShown: boolean) => {
      if (sheetModalRefs[type]) {
        doToggleShowModal(sheetModalRefs[type]!, isShown);
      }
    },
    [sheetModalRefs, toggleShowNavHeader],
  );

  return {
    sheetModalRefs,
    toggleShowSheetModal,
  };
}
