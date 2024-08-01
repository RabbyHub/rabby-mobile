import {
  BottomSheetModal,
  BottomSheetBackdropProps,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback } from 'react';
import { AppBottomSheetModal } from './customized/BottomSheet';
import { RefreshAutoLockBottomSheetBackdrop } from './patches/refreshAutoLockUI';

const Backdrop = (p: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...p}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);
export const BSheetModal = forwardRef<BottomSheetModal, BottomSheetModalProps>(
  (props, ref) => {
    return (
      <AppBottomSheetModal ref={ref} backdropComponent={Backdrop} {...props}>
        {props.children}
      </AppBottomSheetModal>
    );
  },
);
