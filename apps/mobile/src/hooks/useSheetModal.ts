import React from 'react';

import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export type SheetModalShowType = boolean | 'destroy' | 'collapse' | number;

export function useSheetModal(
  existingSheetModalRef?: React.RefObject<BottomSheetModal> | null,
) {
  const internalRef = React.useRef<BottomSheetModal>(null);

  const sheetModalRef = existingSheetModalRef || internalRef;

  const toggleShowSheetModal = React.useCallback(
    async (shownType: SheetModalShowType) => {
      switch (shownType) {
        case 'destroy':
          sheetModalRef.current?.dismiss();
          return;
        case 'collapse':
          sheetModalRef.current?.collapse();
          return;
        case true:
          sheetModalRef.current?.present();
          return;
        case false:
          sheetModalRef.current?.close();
          return;
        default:
          sheetModalRef.current?.snapToIndex(shownType);
          return;
      }
    },
    [sheetModalRef],
  );

  return {
    sheetModalRef,
    toggleShowSheetModal,
  };
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
  const toggleShowSheetModal = React.useCallback(
    async (
      type: T,
      shownType: SheetModalShowType,
      animationConfigs?: WithSpringConfig | WithTimingConfig,
    ) => {
      let finalAc: typeof animationConfigs;
      if (animationConfigs) {
        finalAc = {
          ...animationConfigs,
        };
      }
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
