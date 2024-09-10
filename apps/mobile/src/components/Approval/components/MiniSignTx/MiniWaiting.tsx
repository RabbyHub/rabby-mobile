import { AppBottomSheetModal } from '@/components';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeColors } from '@/hooks/theme';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React, { useEffect, useMemo } from 'react';
import { MiniLedgerHardwareWaiting } from './MiniLedgerHardwareWaiting';
import { MiniPrivatekeyWaiting } from './MiniPrivatekeyWaiting';
import { BatchSignTxTaskType } from './useBatchSignTxTask';

export const MiniWaiting = ({
  visible,
  onRetry,
  onCancel,
  onDone,
  error,
}: {
  visible?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  onDone?: () => void;
  error?: BatchSignTxTaskType['error'];
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getSheetStyles(colors), [colors]);

  const { sheetModalRef } = useSheetModal();

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, visible]);

  const { currentAccount } = useCurrentAccount();

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      enableDismissOnClose
      onDismiss={() => {
        if (visible) {
          onCancel?.();
        }
      }}
      handleStyle={styles.sheetBg}
      enableDynamicSizing
      backgroundStyle={styles.sheetBg}>
      <BottomSheetView style={styles.warper}>
        {error ? (
          <>
            {currentAccount?.type === KEYRING_TYPE.LedgerKeyring ? (
              <MiniLedgerHardwareWaiting
                error={error}
                onCancel={onCancel}
                onDone={onDone}
                onRetry={onRetry}
              />
            ) : (
              <MiniPrivatekeyWaiting
                error={error}
                onCancel={onCancel}
                onDone={onDone}
                onRetry={onRetry}
              />
            )}
          </>
        ) : null}
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getSheetStyles = createGetStyles(colors => ({
  sheetBg: {
    backgroundColor: colors['neutral-bg-1'],
  },
  warper: {
    paddingBottom: 40,
  },
}));
