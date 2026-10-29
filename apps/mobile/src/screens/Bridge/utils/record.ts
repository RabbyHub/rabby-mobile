import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { ONE_HOUR_MS } from '../constants';
import type { BridgeRecordData } from './statusTypes';

export const getBridgeRecordKey = (record: BridgeRecordData) =>
  `${record.address.toLowerCase()}:${
    record.local?.fromToken.chain || record.history?.from_token.chain
  }:${record.local?.hash || record.history?.from_tx.tx_id}`;

export const getBridgeHistoryTxId = ({ history, local }: BridgeRecordData) =>
  history?.from_tx?.tx_id ||
  history?.detail_url?.split('/').pop() ||
  local?.acceleratedHash ||
  local?.hash ||
  '';

export const sameBridgeHash = (left?: string, right?: string) =>
  !!left && !!right && left.toLowerCase() === right.toLowerCase();

type BridgeHistoryLookup = {
  chain?: string;
  hash?: string;
  acceleratedHash?: string;
};

export function findBridgeHistory(
  list: BridgeHistory[],
  source: BridgeHistoryLookup,
) {
  const byHash = (hash?: string) =>
    list.find(
      item =>
        item.from_token.chain === source.chain &&
        sameBridgeHash(item.from_tx?.tx_id, hash),
    );
  return byHash(source.acceleratedHash) || byHash(source.hash);
}

/** 本地还在等远程记录，且创建已超过 1 小时。终态和已取消不算。 */
export function isStaleUnmatchedLocal(local: BridgeTxHistoryItem) {
  return (
    !local.isCanceled &&
    (local.status === 'pending' || local.status === 'fromSuccess') &&
    !!local.createdAt &&
    Date.now() - local.createdAt > ONE_HOUR_MS
  );
}
