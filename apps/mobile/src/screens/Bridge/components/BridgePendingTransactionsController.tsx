import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
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
};

export const BridgePendingTransactionsController = forwardRef<
  BridgePendingTransactionsControllerRef,
  BridgePendingTransactionsControllerProps
>(({ disableHeaderRight, enabled }, ref) => {
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const headerRef = useRef<BridgeHeaderRef>(null);
  const {
    runAsync: runFetchPendingCount,
    runFetchLocalPendingTx,
    clearBridgeHistoryRedDot,
  } = usePollBridgePendingNumber(10000, enabled);

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
        ref={headerRef}
        clearBridgeHistoryRedDot={clearBridgeHistoryRedDot}
      />
    ),
    [clearBridgeHistoryRedDot],
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
