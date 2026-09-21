import { useCallback, useEffect, useRef } from 'react';

import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';

export function useMiniSignerEffectPause(miniSignLoading: boolean) {
  const miniSignLoadingRef = useRef(false);

  useEffect(() => {
    miniSignLoadingRef.current = miniSignLoading;
  }, [miniSignLoading]);

  return useCallback(
    () => miniSignLoadingRef.current || isGasAccountDepositFlowActive(),
    [],
  );
}
