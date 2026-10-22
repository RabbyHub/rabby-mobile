import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import { ONE_HOUR_MS } from '../constants';

export type BridgeArrivalResolution =
  | { type: 'pending' }
  | { type: 'notFoundTimeout' }
  | {
      type: 'settled';
      status: 'allSuccess' | 'failed';
      bridgeTx: BridgeHistory;
    };

export const resolveBridgeArrival = (
  list: BridgeHistory[],
  { hash, createdAt, now }: { hash: string; createdAt: number; now: number },
): BridgeArrivalResolution => {
  const found = list.find(item => item.from_tx?.tx_id === hash);
  if (!found) {
    // tx create time is more than 60 minutes, treat as failed
    return now - createdAt > ONE_HOUR_MS
      ? { type: 'notFoundTimeout' }
      : { type: 'pending' };
  }
  if (found.status === 'completed' || found.status === 'failed') {
    return {
      type: 'settled',
      status: found.status === 'completed' ? 'allSuccess' : 'failed',
      bridgeTx: found,
    };
  }
  return { type: 'pending' };
};
