import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback } from 'react';

export const BSheetModal = forwardRef<BottomSheetModal, BottomSheetModalProps>(
  (props, ref) => {
    const Backdrop = useCallback(
      (p: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );
    return (
      <BottomSheetModal ref={ref} backdropComponent={Backdrop} {...props}>
        {props.children}
      </BottomSheetModal>
    );
  },
);
