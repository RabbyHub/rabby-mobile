import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';

export type BridgeRecordData = {
  address: string;
  history?: BridgeHistory;
  local?: BridgeTxHistoryItem;
  isForMultipleAddress?: boolean;
};

// The status helpers only need this projection, including unindexed local records.
export type BridgeStatusHistory = Pick<BridgeHistory, 'status' | 'from_tx'> &
  Partial<
    Pick<
      BridgeHistory,
      'from_token' | 'to_token' | 'to_actual_token' | 'to_tx' | 'create_at'
    >
  > & {
    actual?: Partial<BridgeHistory['actual']>;
    quote?: Partial<BridgeHistory['quote']>;
  };

export type BridgeProgressRecord = Pick<
  BridgeTxHistoryItem,
  | 'status'
  | 'hash'
  | 'acceleratedHash'
  | 'fromToken'
  | 'estimatedDuration'
  | 'fromTxCompleteTs'
  | 'toTxId'
  | 'actualToToken'
>;
