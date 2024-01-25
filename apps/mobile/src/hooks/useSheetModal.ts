import React from 'react';

import { BottomSheetModal } from '@gorhom/bottom-sheet';

export type DappBottomSheetModalRefs<T extends string = string> = Record<
  T,
  | React.MutableRefObject<BottomSheetModal>
  | React.RefObject<BottomSheetModal>
  | null
>;

export function useSheetModals<T extends string>(
  sheetModalRefs: DappBottomSheetModalRefs<T>,
) {
  const toggleShowSheetModal = React.useCallback(
    async (type: T, shownType: boolean | 'destroy' | 'collapse' | number) => {
      switch (shownType) {
        case 'destroy':
          sheetModalRefs[type]?.current?.dismiss();
          return;
        case 'collapse':
          sheetModalRefs[type]?.current?.collapse();
          return;
        case true:
          sheetModalRefs[type]?.current?.present();
          return;
        case false:
          sheetModalRefs[type]?.current?.close();
          return;
        default:
          sheetModalRefs[type]?.current?.snapToIndex(shownType);
          return;
      }
    },
    [sheetModalRefs],
  );

  return {
    sheetModalRefs,
    toggleShowSheetModal,
  };
}
