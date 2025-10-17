import { AppBottomSheetModal } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React, { useEffect, useMemo } from 'react';
import { MiniLedgerHardwareWaiting } from './MiniLedgerHardwareWaiting';
import { MiniPrivatekeyWaiting } from './MiniPrivatekeyWaiting';
import { BatchSignTxTaskType } from './useBatchSignTxTask';
import { MiniOneKeyHardwareWaiting } from './MiniOneKeyHardwareWaiting';
import { useMemoizedFn } from 'ahooks';
import { Account } from '@/core/services/preference';

export const MiniWaiting = ({
  visible,
  onRetry,
  onCancel,
  onDone,
  error: _error,
  account,
  ga,
}: {
  visible?: boolean;
  onRetry?: () => void;
  onCancel?: (e?: any) => void;
  onDone?: () => void;
  error?: BatchSignTxTaskType['error'];
  account: Account;
  ga?: Record<string, any>;
}) => {
  const error = useMemo(() => {
    if (ga?.category && _error?.status === 'FAILED') {
      return {
        ..._error,
        content: `Failed to ${ga?.category}`,
      } as BatchSignTxTaskType['error'];
    }
    return _error;
  }, [_error, ga?.category]);

  const { styles } = useTheme2024({
    getStyle,
  });

  const { sheetModalRef } = useSheetModal();

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, visible]);

  const currentAccount = account;

  const handleCancel = useMemoizedFn(() => {
    onCancel?.(error?.description);
  });

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      enableDismissOnClose
      onDismiss={() => {
        if (visible) {
          onCancel?.();
        }
      }}
      handleStyle={styles.handleStyle}
      enableDynamicSizing
      handleIndicatorStyle={styles.handleIndicatorStyle}
      backgroundStyle={styles.sheetBg}>
      <BottomSheetView style={styles.warper}>
        {error ? (
          <>
            {currentAccount?.type === KEYRING_TYPE.LedgerKeyring ? (
              <MiniLedgerHardwareWaiting
                error={error}
                onCancel={handleCancel}
                onDone={onDone}
                onRetry={onRetry}
              />
            ) : currentAccount?.type === KEYRING_TYPE.OneKeyKeyring ? (
              <MiniOneKeyHardwareWaiting
                error={error}
                onCancel={handleCancel}
                onDone={onDone}
                onRetry={onRetry}
              />
            ) : (
              <MiniPrivatekeyWaiting
                error={error}
                onCancel={handleCancel}
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetBg: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  handleStyle: {
    paddingTop: 10,
    backgroundColor: colors2024['neutral-bg-1'],
    height: 36,
  },
  handleIndicatorStyle: {
    backgroundColor: colors2024['neutral-line'],
    height: 6,
    width: 50,
  },
  sheet: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  warper: {
    paddingBottom: 52,
  },
}));
