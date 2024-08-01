import { apisLock } from '@/core/apis';
import { useEffect } from 'react';

export function useClearOnAutoLock(clearFunc: () => void) {
  useEffect(() => {
    if (typeof clearFunc !== 'function') return;

    const dispose = apisLock.subscribeAppLock(clearFunc);

    return dispose;
  }, [clearFunc]);
}
