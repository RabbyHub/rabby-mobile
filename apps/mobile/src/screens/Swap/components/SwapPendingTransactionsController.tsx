import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { PendingTxItem } from './PendingTxItem';
import { usePollSwapPendingNumber } from '../hooks';

export type SwapPendingTransactionsControllerRef = {
  refreshLocal: () => void;
  refreshRemote: () => void;
};

type SwapPendingTransactionsControllerProps = {
  disableHeaderRight: boolean;
  enabled: boolean;
  isForMultipleAddress: boolean;
  showPendingTransaction: boolean;
  onProgressChange?: (hasProgress: boolean) => void;
};

export const SwapPendingTransactionsController = forwardRef<
  SwapPendingTransactionsControllerRef,
  SwapPendingTransactionsControllerProps
>(
  (
    { enabled, isForMultipleAddress, showPendingTransaction, onProgressChange },
    ref,
  ) => {
    const {
      runAsync: runFetchPendingCount,
      localPendingTxData,
      clearLocalPendingTxData,
      runFetchLocalPendingTx,
    } = usePollSwapPendingNumber(5000, enabled);

    useImperativeHandle(
      ref,
      () => ({
        refreshLocal: runFetchLocalPendingTx,
        refreshRemote: () => {
          runFetchPendingCount();
        },
      }),
      [runFetchLocalPendingTx, runFetchPendingCount],
    );

    const hasSwapProgress = !!localPendingTxData;

    useEffect(() => {
      onProgressChange?.(hasSwapProgress);
      return () => onProgressChange?.(false);
    }, [hasSwapProgress, onProgressChange]);

    if (!showPendingTransaction || !localPendingTxData) {
      return null;
    }

    return (
      <PendingTxItem
        type="swap"
        isForMultipleAddress={isForMultipleAddress}
        data={localPendingTxData}
        clearLocalPendingTxData={clearLocalPendingTxData}
      />
    );
  },
);

SwapPendingTransactionsController.displayName =
  'SwapPendingTransactionsController';
