import { useIsFocused } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
import { forwardRef, useImperativeHandle } from 'react';
import { usePollBridgePendingNumber } from '../hooks';

export type BridgePendingTransactionsControllerRef = {
  refreshLocal: () => void;
  refreshRemote: () => void;
};

type BridgePendingTransactionsControllerProps = {
  disableHeaderRight: boolean;
  enabled: boolean;
  isForMultipleAddress?: boolean;
};

export const BridgePendingTransactionsController = forwardRef<
  BridgePendingTransactionsControllerRef,
  BridgePendingTransactionsControllerProps
>(({ enabled }, ref) => {
  const focused = useIsFocused();
  const appState = useAppState();
  const active = enabled && focused && appState === 'active';
  const { runAsync: runFetchPendingCount, runFetchLocalPendingTx } =
    usePollBridgePendingNumber(10000, active);

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

  return null;
});

BridgePendingTransactionsController.displayName =
  'BridgePendingTransactionsController';
