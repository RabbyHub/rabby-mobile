import { useEffect, useRef } from 'react';

export const useBalanceUpdate = (triggerUpdate: (force: boolean) => void) => {
  const firstUpdate = useRef(true);
  useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }
    triggerUpdate(true);
  }, [triggerUpdate]);
};
