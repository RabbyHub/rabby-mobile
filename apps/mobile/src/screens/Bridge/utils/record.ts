import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { ONE_HOUR_MS } from '../constants';
import type { BridgeRecordData } from './statusTypes';

export const getBridgeRecordKey = (record: BridgeRecordData) =>
  `${record.address.toLowerCase()}:${
    record.local?.fromToken.chain || record.history?.from_token.chain
  }:${record.local?.hash || record.history?.from_tx.tx_id}`;

export const getBridgeHistoryTxId = ({ history, local }: BridgeRecordData) =>
  history?.from_tx?.tx_id || local?.acceleratedHash || local?.hash || '';

// 只放行聚合器 scan_url 拼出来的 https 详情页。
const BRIDGE_DETAIL_URL_PREFIXES = [
  'https://explorer.li.fi/tx/',
  'https://across.to/transfer/',
  'https://www.socketscan.io/tx/',
  'https://explorer.mayan.finance/swap/',
  'https://layerzeroscan.com/tx/',
  'https://axelarscan.io/gmp/',
  'https://www.relay.link/transaction/',
  'https://explorer.near-intents.org/transactions/',
];

export function getAllowedBridgeDetailUrl(url?: string | null) {
  if (!url) {
    return '';
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return '';
  }
  const allowed = BRIDGE_DETAIL_URL_PREFIXES.some(prefix => {
    const expected = new URL(prefix);
    return (
      parsed.origin === expected.origin &&
      parsed.pathname.startsWith(expected.pathname) &&
      parsed.pathname.length > expected.pathname.length
    );
  });
  return allowed ? parsed.href : '';
}

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
