import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { findBridgeHistory, isStaleUnmatchedLocal } from './record';
import { getBridgeStatus } from './status';

export type BridgeArrivalResolution =
  | { type: 'pending' }
  | { type: 'notFoundTimeout' }
  | {
      type: 'settled';
      status: 'allSuccess' | 'fromFailed' | 'failed';
      bridgeTx: BridgeHistory;
    };

/** Settles a local bridge record by the same rules as useBridgeRecord. */
export const resolveBridgeArrival = (
  list: BridgeHistory[],
  local: BridgeTxHistoryItem,
): BridgeArrivalResolution => {
  const history = findBridgeHistory(list, {
    chain: local.fromToken.chain,
    hash: local.hash,
    acceleratedHash: local.acceleratedHash,
  });
  if (!history) {
    return isStaleUnmatchedLocal(local)
      ? { type: 'notFoundTimeout' }
      : { type: 'pending' };
  }
  const status = getBridgeStatus({ address: local.address, local, history });
  const terminal =
    status.scene === 'succeeded'
      ? 'allSuccess'
      : status.scene === 'sourceFailed'
      ? 'fromFailed'
      : status.failed
      ? 'failed'
      : undefined;
  return terminal
    ? { type: 'settled', status: terminal, bridgeTx: history }
    : { type: 'pending' };
};
