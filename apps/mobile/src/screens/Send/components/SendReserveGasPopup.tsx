import { AppBottomSheetModal } from '@/components';
import AutoLockView from '@/components/AutoLockView';
import {
  ReserveGasContent,
  ReserveGasType,
} from '@/components/ReserveGasPopup';
import { useThemeStyles } from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import React from 'react';

type ReserveGasContentProps = React.ComponentProps<typeof ReserveGasContent>;

export const SendReserveGasPopup = (
  props: ReserveGasContentProps & {
    visible: boolean;
    onClose?: (gasLevel?: GasLevel | null) => void;
    onCancel?: (gasLevel?: GasLevel | null) => void;
  },
) => {
  const {
    gasList,
    chain,
    onGasChange,
    limit,
    selectedItem,
    rawHexBalance,
    visible,
    onClose,
    onCancel,
  } = props;
  const { styles } = useThemeStyles(getStyles);

  const { sheetModalRef } = useSheetModal();
  React.useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [visible, sheetModalRef]);

  const reverseGasContentRef = React.useRef<ReserveGasType>(null);

  const { safeSizes } = useSafeAndroidBottomSizes({
    snapPointH: 500,
  });
  const snapPoints = React.useMemo(
    () => [safeSizes.snapPointH],
    [safeSizes.snapPointH],
  );

  const handleClose = React.useCallback(() => {
    const gasLevel = reverseGasContentRef.current?.getSelectedGasLevel();
    onClose?.(gasLevel);
  }, [onClose]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      snapPoints={snapPoints}
      enableDismissOnClose
      // onDismiss={handleClose}
      handleStyle={styles.sheetBg}
      backgroundStyle={styles.sheetBg}>
      <AutoLockView style={styles.flex1}>
        {gasList && (
          <ReserveGasContent
            ref={reverseGasContentRef}
            gasList={gasList}
            chain={chain}
            limit={limit}
            selectedItem={selectedItem}
            onGasChange={onGasChange}
            rawHexBalance={rawHexBalance}
          />
        )}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  sheetBg: {
    backgroundColor: colors['neutral-bg-2'],
  },
  flex1: {
    flex: 1,
  },
}));
