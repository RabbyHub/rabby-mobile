import React, { useEffect, useRef } from 'react';

import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';

import SelectSortedChain, { SelectSortedChainProps } from './SelectSortedChain';

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
      snapPoints={['80%']}
      onDismiss={onCancel}
      enableContentPanningGesture={false}>
      <SelectSortedChain {...props} />
    </AppBottomSheetModal>
  );
}
