import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import {
  BRIDGE_AGGREGATORS,
  getBridgeAltContracts,
  getBridgeRouter,
  isSupportedBridgeChain,
} from '@rabby-wallet/rabby-bridge';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { HistoryDisplayItem } from '@/types/history';
import type { TransactionGroup } from '@/core/services/transactionHistory';
import { BRIDGE_HISTORY_POLL_MAX_AGE_MS } from '@/screens/Bridge/constants';

export const BRIDGE_HISTORY_TX_BATCH = 20;
export const BRIDGE_HISTORY_INIT_SCAN_LIMIT = 100;

export const historyTxKey = (chain?: string, hash?: string) =>
  `${(chain || '').toLowerCase()}:${(hash || '').toLowerCase()}`;

export type BridgeHistoryQuery = { chain: string; hash: string };
export type BridgeHistoryRow = {
  kind: 'bridge';
  key: string;
  history: BridgeHistory;
  anchor: HistoryDisplayItem;
  source: HistoryDisplayItem;
  time_at: number;
};
export type BridgeAwareHistoryItem =
  | HistoryDisplayItem
  | TransactionGroup
  | BridgeHistoryRow;

export const isBridgeHistoryRow = (
  item: BridgeAwareHistoryItem,
): item is BridgeHistoryRow => 'kind' in item && item.kind === 'bridge';

export const canDisplayBridge = (item: HistoryDisplayItem) =>
  item.is_scam !== true && item.cate_id !== 'approve';

export function isBridgeCandidate(item: HistoryDisplayItem) {
  const to = item.tx?.to_addr;
  if (!item.id || !item.chain || !to || !canDisplayBridge(item)) {
    return false;
  }
  return BRIDGE_AGGREGATORS.some(aggregator => {
    if (!isSupportedBridgeChain(aggregator, item.chain)) {
      return false;
    }
    const router = getBridgeRouter(aggregator, item.chain);
    return (
      (!!router && isSameAddress(router, to)) ||
      getBridgeAltContracts(aggregator).some(address =>
        isSameAddress(address, to),
      )
    );
  });
}

// 移植插件的窗口收集规则，仅将候选条件收窄为 Router/Alt 白名单。
export function collectBridgeQueries(
  items: HistoryDisplayItem[],
  start: number,
  end: number,
  limit = BRIDGE_HISTORY_TX_BATCH,
) {
  const queries = new Map<string, BridgeHistoryQuery>();
  for (let index = start; index < Math.min(end, items.length); index += 1) {
    const item = items[index];
    if (!item || !isBridgeCandidate(item)) {
      continue;
    }
    queries.set(historyTxKey(item.chain, item.id), {
      chain: item.chain,
      hash: item.id,
    });
    if (queries.size >= limit) {
      break;
    }
  }
  return [...queries.values()];
}

export const bridgeSourceKey = (bridge: BridgeHistory) =>
  historyTxKey(bridge.from_token?.chain, bridge.from_tx?.tx_id);

export const bridgeReceiveKey = (bridge: BridgeHistory) =>
  bridge.to_tx?.tx_id
    ? historyTxKey(
        bridge.to_actual_token?.chain || bridge.to_token?.chain,
        bridge.to_tx.tx_id,
      )
    : '';

// 移植插件的两小时限制，仅停止轮询，不修改交易状态。
export const shouldPollPendingBridge = (
  item: BridgeHistory,
  now = Date.now(),
) =>
  item.status === 'pending' &&
  !!item.create_at &&
  now - item.create_at * 1000 < BRIDGE_HISTORY_POLL_MAX_AGE_MS;

// 沿用插件的到账位置优先规则，索引只在本次合并中存在。
export function mergeHistoryWithBridge(
  items: (HistoryDisplayItem | TransactionGroup)[],
  bridges: BridgeHistory[],
): BridgeAwareHistoryItem[] {
  if (!bridges.length) {
    return items;
  }
  const present = new Map<string, HistoryDisplayItem>();
  for (const item of items) {
    if ('project_item' in item && canDisplayBridge(item)) {
      const key = historyTxKey(item.chain, item.id);
      if (!present.has(key)) {
        present.set(key, item);
      }
    }
  }
  const bridgeByAnchor = new Map<string, BridgeHistoryRow>();
  const hiddenKeys = new Set<string>();
  for (const bridge of bridges) {
    if (!bridge.from_tx?.tx_id) {
      continue;
    }
    const fromKey = bridgeSourceKey(bridge);
    const toKey = bridgeReceiveKey(bridge);
    const source = present.get(fromKey);
    const anchor = present.get(toKey) || source;
    if (!anchor) {
      continue;
    }
    const anchorKey = historyTxKey(anchor.chain, anchor.id);
    bridgeByAnchor.set(anchorKey, {
      kind: 'bridge',
      key: `bridge:${fromKey}`,
      history: bridge,
      anchor,
      source: source || anchor,
      time_at: anchor.time_at,
    });
    if (anchorKey !== fromKey) {
      hiddenKeys.add(fromKey);
    }
  }
  const result: BridgeAwareHistoryItem[] = [];
  const displayed = new Set<string>();
  for (const item of items) {
    if (!('project_item' in item) || !canDisplayBridge(item)) {
      result.push(item);
      continue;
    }
    const key = historyTxKey(item.chain, item.id);
    if (hiddenKeys.has(key)) {
      continue;
    }
    const bridge = bridgeByAnchor.get(key);
    if (!bridge) {
      result.push(item);
    } else if (!displayed.has(bridge.key)) {
      displayed.add(bridge.key);
      result.push(bridge);
    }
  }
  return result;
}
