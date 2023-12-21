import * as React from 'react';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { atom, useAtomValue } from 'jotai';
import { useToggleShowNavHeader } from '@/hooks/navigation';

interface SheetModalDict {
  webviewTesterRef: BottomSheetModal | null;
}

const sheetModalRefAtom = atom<
  Record<keyof SheetModalDict, React.RefObject<BottomSheetModal>>
>({
  webviewTesterRef: React.createRef<BottomSheetModal>(),
});

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

export function useSheetModalRefs() {
  const sheetModals = useAtomValue(sheetModalRefAtom);

  const { toggleShowNavHeader } = useToggleShowNavHeader();

  const toggleShowSheetModal = React.useCallback(
    async (
      type: keyof SheetModalDict,
      isShown: boolean,
      options?:
        | boolean
        | {
            autoToggleNavHeader?: boolean;
          },
    ) => {
      options =
        typeof options === 'boolean'
          ? { autoToggleNavHeader: options }
          : options;

      // FIXME: temporary solution, change to TRULY cover bottom-sheet on header of navigator layer later
      if (!isShown && options?.autoToggleNavHeader) {
        toggleShowNavHeader(true);
      }

      doToggleShowModal(sheetModals[type], isShown);

      if (options?.autoToggleNavHeader && isShown) {
        toggleShowNavHeader(false);
      }
    },
    [sheetModals, toggleShowNavHeader],
  );

  return {
    sheetModals,
    toggleShowSheetModal,
  };
}
