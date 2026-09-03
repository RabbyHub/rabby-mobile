import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { SwapHeader } from './Header';
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
    {
      disableHeaderRight,
      enabled,
      isForMultipleAddress,
      showPendingTransaction,
      onProgressChange,
    },
    ref,
  ) => {
    const { setNavigationOptions } = useSafeSetNavigationOptions();
    const {
      runAsync: runFetchPendingCount,
      localPendingTxData,
      clearLocalPendingTxData,
      runFetchLocalPendingTx,
      clearSwapHistoryRedDot,
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

    const headerRight = useCallback(
      () => (
        <SwapHeader
          isForMultipleAddress={isForMultipleAddress}
          clearSwapHistoryRedDot={clearSwapHistoryRedDot}
        />
      ),
      [clearSwapHistoryRedDot, isForMultipleAddress],
    );

    useEffect(() => {
      if (disableHeaderRight) {
        return;
      }
      setNavigationOptions({
        headerRight,
      });
    }, [disableHeaderRight, headerRight, setNavigationOptions]);

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
