import React, { useCallback, useEffect, useMemo } from 'react';

import { MiniWaiting } from '../MiniSignTx/MiniWaiting';
import {
  useMiniSignTypedDataState,
  retryMiniSignTypedData,
  cancelMiniSignTypedData,
  getMiniSignTypedDataContext,
} from '@/hooks/useMiniSignTypedData';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import {
  MiniActionStatus,
  type MiniActionStatusTask,
} from '../MiniSignTx/MiniActionStatus';
import { AppBottomSheetModal } from '@/components';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTheme2024 } from '@/hooks/theme';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';

export const GlobalMiniSignTypedDataPortal: React.FC = () => {
  const state = useMiniSignTypedDataState();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const context = useMemo(() => getMiniSignTypedDataContext(), [state]);

  const error = state.error || undefined;
  const account = context?.account;
  const visible = state.status === 'failed' && !!error && !!account;

  const isHardware = Boolean(
    account &&
      (account.type === KEYRING_CLASS.HARDWARE.LEDGER ||
        account.type === KEYRING_CLASS.HARDWARE.ONEKEY),
  );

  const actionTask = useMemo<MiniActionStatusTask | null>(() => {
    if (!account || !isHardware) return null;
    const total = context?.txs?.length ?? state.totalTxs ?? 0;
    if (!total) return null;
    const currentIndex = Math.min(
      Math.max(context?.currentIndex ?? state.currentTxIndex ?? 0, 0),
      total - 1,
    );
    const status =
      state.status === 'signed'
        ? 'completed'
        : state.status === 'signing' || state.status === 'failed'
        ? 'active'
        : 'idle';
    if (status === 'idle') return null;
    let txStatus: MiniActionStatusTask['txStatus'] = 'idle';
    if (state.lastProgress === 'signed') {
      txStatus = 'signed';
    } else if (state.lastProgress === 'builded') {
      txStatus = 'sended';
    } else {
      txStatus = 'idle';
    }
    if (state.status === 'failed') {
      txStatus = 'idle';
    }
    return {
      status,
      txStatus,
      total,
      currentActiveIndex: currentIndex,
    };
  }, [
    account,
    context,
    isHardware,
    state.currentTxIndex,
    state.lastProgress,
    state.status,
    state.totalTxs,
  ]);

  const handleRetry = useCallback(() => {
    retryMiniSignTypedData().catch(() => undefined);
  }, []);

  const handleCancel = useCallback((reason?: any) => {
    cancelMiniSignTypedData(reason);
  }, []);

  const { styles } = useTheme2024({
    getStyle,
  });

  const { sheetModalRef } = useSheetModal();

  const showStatus = Boolean(actionTask);

  useEffect(() => {
    if (showStatus) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, showStatus]);

  if (!account) {
    return null;
  }

  return (
    <>
      <AppBottomSheetModal
        ref={sheetModalRef}
        enableDismissOnClose
        onDismiss={() => {
          handleCancel();
        }}
        handleStyle={styles.handleStyle}
        enableDynamicSizing
        handleIndicatorStyle={styles.handleIndicatorStyle}
        backgroundStyle={styles.sheetBg}>
        <BottomSheetView style={styles.warper}>
          <MiniActionStatus account={account} task={actionTask!} />
        </BottomSheetView>
      </AppBottomSheetModal>

      <MiniWaiting
        visible={visible}
        error={error}
        onRetry={handleRetry}
        onCancel={handleCancel}
        account={account}
      />
    </>
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
