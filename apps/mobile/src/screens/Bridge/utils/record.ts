import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import type { BridgeRecordData } from './statusTypes';

export const getBridgeRecordKey = (record: BridgeRecordData) =>
  `${record.address.toLowerCase()}:${
    record.local?.fromToken.chain || record.history?.from_token.chain
  }:${record.local?.hash || record.history?.from_tx.tx_id}`;

export const sameBridgeHash = (left?: string, right?: string) =>
  !!left && !!right && left.toLowerCase() === right.toLowerCase();

export function findBridgeHistory(
  list: BridgeHistory[],
  local: BridgeTxHistoryItem,
) {
  return (
    list.find(
      item =>
        item.from_token.chain === local.fromToken.chain &&
        sameBridgeHash(item.from_tx?.tx_id, local.acceleratedHash),
    ) ||
    list.find(
      item =>
        item.from_token.chain === local.fromToken.chain &&
        sameBridgeHash(item.from_tx?.tx_id, local.hash),
    )
  );
}
