import type { Ref } from 'react';
import {
  BottomSheetModal,
  BottomSheetBackdropProps,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { AppBottomSheetModal } from './customized/BottomSheet';
import { RefreshAutoLockBottomSheetBackdrop } from './patches/refreshAutoLockUI';

const renderBackdrop = (p: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...p}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);
export const BSheetModal = ({
  ref,
  ...props
}: BottomSheetModalProps & { ref?: Ref<BottomSheetModal> }) => {
  return (
    <AppBottomSheetModal
      ref={ref}
      backdropComponent={renderBackdrop}
      {...props}>
      {props.children}
    </AppBottomSheetModal>
  );
};
