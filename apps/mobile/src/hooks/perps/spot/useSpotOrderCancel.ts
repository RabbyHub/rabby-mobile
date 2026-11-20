import { useCallback, useRef, useState } from 'react';

import type { Account } from '@/core/startupServices/preference';

import { cancelPerpsSpotOrder } from './spotActions';

/**
 * Cancels one spot order at a time. The ref is a synchronous lock: state
 * updates land a render late, so a fast double tap would otherwise sign two
 * cancels.
 */
export const useSpotOrderCancel = (
  account: Account | null,
  onCancelled: () => void,
) => {
  const [cancellingOid, setCancellingOid] = useState<number | null>(null);
  const lockRef = useRef(false);

  const cancel = useCallback(
    async (pairIndex: number, oid: number) => {
      if (lockRef.current) {
        return;
      }
      lockRef.current = true;
      setCancellingOid(oid);
      try {
        const ok = await cancelPerpsSpotOrder(account, { pairIndex, oid });
        if (ok) {
          onCancelled();
        }
      } finally {
        lockRef.current = false;
        setCancellingOid(null);
      }
    },
    [account, onCancelled],
  );

  return { cancel, cancellingOid };
};
