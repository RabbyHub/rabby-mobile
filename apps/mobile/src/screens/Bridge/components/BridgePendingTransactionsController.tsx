import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { useIsFocused } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { usePollBridgePendingNumber } from '../hooks';
import { BridgeHeader, type BridgeHeaderRef } from './BridgeHeader';

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
>(({ disableHeaderRight, enabled, isForMultipleAddress }, ref) => {
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const focused = useIsFocused();
  const appState = useAppState();
  const active = enabled && focused && appState === 'active';
  const headerRef = useRef<BridgeHeaderRef>(null);
  const {
    runAsync: runFetchPendingCount,
    runFetchLocalPendingTx,
    clearBridgeHistoryRedDot,
  } = usePollBridgePendingNumber(10000, active);

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
      <BridgeHeader
        isForMultipleAddress={isForMultipleAddress}
        ref={headerRef}
        clearBridgeHistoryRedDot={clearBridgeHistoryRedDot}
      />
    ),
    [clearBridgeHistoryRedDot, isForMultipleAddress],
  );

  useEffect(() => {
    if (disableHeaderRight) {
      return;
    }
    setNavigationOptions({
      headerRight,
    });
  }, [disableHeaderRight, headerRight, setNavigationOptions]);

  return null;
});

BridgePendingTransactionsController.displayName =
  'BridgePendingTransactionsController';
