import React, { useEffect, useRef } from 'react';

import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

import SelectSortedChain, { SelectSortedChainProps } from './SelectSortedChain';
import { ModalLayouts } from '@/constant/layout';

const getStyles = createGetStyles(colors => {
  return {
    sheet: {
      backgroundColor: colors['neutral-bg-1'],
    },
  };
});

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
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
      backgroundStyle={styles.sheet}
      onDismiss={onCancel}
      enableContentPanningGesture={false}>
      <SelectSortedChain {...props} />
    </AppBottomSheetModal>
  );
}
