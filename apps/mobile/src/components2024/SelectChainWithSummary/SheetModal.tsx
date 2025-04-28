import React, { useEffect, useRef } from 'react';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';

import SelectChainWithSummary, {
  SelectSortedChainProps,
} from './SelectChainWithSummary';
import { ModalLayouts } from '@/constant/layout';

export default function SelectSortedChainModal({
  visible,
  onCancel,
  ...props
}: RNViewProps &
  SelectSortedChainProps & {
    visible?: boolean;
    onCancel?(): void;
  }) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    selectAddress: modalRef,
  });

  useEffect(() => {
    toggleShowSheetModal('selectAddress', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[ModalLayouts.defaultHeightPercentText]}
      onDismiss={onCancel}>
      <SelectChainWithSummary
        {...props}
        onClose={() => {
          toggleShowSheetModal('selectAddress', 'destroy');
        }}
      />
    </AppBottomSheetModal>
  );
}
