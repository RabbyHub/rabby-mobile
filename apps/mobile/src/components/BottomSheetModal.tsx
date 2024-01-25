import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback } from 'react';
import { AppBottomSheetModal } from './customized/BottomSheet';

export const BSheetModal = forwardRef<BottomSheetModal, BottomSheetModalProps>(
  (props, ref) => {
    const Backdrop = useCallback(
      (p: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );
    return (
      <AppBottomSheetModal ref={ref} backdropComponent={Backdrop} {...props}>
        {props.children}
      </AppBottomSheetModal>
    );
  },
);
