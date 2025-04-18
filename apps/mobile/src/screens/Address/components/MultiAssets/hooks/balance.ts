import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { useEffect, useRef } from 'react';

export const useBalanceUpdate = (triggerUpdate: (force: boolean) => void) => {
  const { balanceNonce } = useTriggerHomeBalanceUpdate();
  const firstUpdate = useRef(true);
  useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }
    if (balanceNonce > 0) {
      triggerUpdate(true);
    }
  }, [balanceNonce, triggerUpdate]);
};
