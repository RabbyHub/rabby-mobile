import React, { useEffect, useRef } from 'react';

import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import SelectChainWithSummary, {
  SelectSortedChainProps,
} from './SelectChainWithSummary';
import { ModalLayouts } from '@/constant/layout';

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    sheet: {
      backgroundColor: colors2024['neutral-bg-0'],
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
  const { styles, colors2024 } = useTheme2024({ getStyle });
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
      handleStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
      }}>
      <SelectChainWithSummary
        {...props}
        onClose={() => {
          toggleShowSheetModal('selectAddress', 'destroy');
        }}
      />
    </AppBottomSheetModal>
  );
}
