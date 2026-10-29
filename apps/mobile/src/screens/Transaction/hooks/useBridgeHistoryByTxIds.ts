import { useEffect, useMemo, useRef, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import type { HistoryDisplayItem } from '@/types/history';
import {
  getBridgeHistorySnapshot,
  subscribeBridgeHistory,
} from '../bridgeHistoryLookup';
import {
  BRIDGE_HISTORY_INIT_SCAN_LIMIT,
  BRIDGE_HISTORY_TX_BATCH,
  canDisplayBridge,
  collectBridgeQueries,
  historyTxKey,
  isBridgeHistoryRow,
  isBridgeCandidate,
  type BridgeAwareHistoryItem,
  type BridgeHistoryQuery,
} from '../utils/bridgeHistory';

const EMPTY_RECORDS: BridgeHistory[] = [];

export function useBridgeHistoryByTxIds({
  items,
  pollableKeys,
  active,
}: {
  items: HistoryDisplayItem[];
  pollableKeys: Set<string>;
  active: boolean;
}) {
  const subscription = useRef<
    ReturnType<typeof subscribeBridgeHistory> | undefined
  >(undefined);
  const viewport = useRef(new Map<string, BridgeHistoryQuery>());
  const initialQueries = useMemo(
    () => collectBridgeQueries(items, 0, BRIDGE_HISTORY_INIT_SCAN_LIMIT),
    [items],
  );
  const { transactionKeys, indices, byHash } = useMemo(() => {
    const keys = new Set<string>();
    const positions = new Map<string, number>();
    const byKey = new Map<string, HistoryDisplayItem>();
    items.forEach((item, index) => {
      positions.set(item.key, index);
      const key = historyTxKey(item.chain, item.id);
      byKey.set(key, item);
      if (canDisplayBridge(item)) {
        keys.add(key);
      }
    });
    return { transactionKeys: keys, indices: positions, byHash: byKey };
  }, [items]);

  const [publishedRecords, setRecords] = useState(() =>
    getBridgeHistorySnapshot(transactionKeys, EMPTY_RECORDS),
  );
  // 列表数据到达时同步合并缓存，避免先显示普通交易再替换。
  const records = useMemo(
    () => getBridgeHistorySnapshot(transactionKeys, publishedRecords),
    [transactionKeys, publishedRecords],
  );

  const buildInput = useMemoizedFn(() => {
    const queries = new Map<string, BridgeHistoryQuery>();
    for (const [key, query] of viewport.current) {
      const item = byHash.get(key);
      if (item && isBridgeCandidate(item)) {
        queries.set(key, query);
      }
    }
    for (const query of initialQueries) {
      queries.set(historyTxKey(query.chain, query.hash), query);
    }
    return {
      queries: [...queries.values()],
      transactionKeys,
      pollableKeys,
    };
  });

  // 失焦或退后台即释放订阅，重新活跃时先用快照再补查空结果和 pending。
  useEffect(() => {
    if (!active) {
      return;
    }
    const current = subscribeBridgeHistory(next => {
      if (subscription.current === current) {
        setRecords(next);
      }
    }, records);
    subscription.current = current;
    current.update(buildInput(), true);
    return () => {
      subscription.current = undefined;
      current.dispose();
    };
    // 快照变化只更新展示，不重建订阅或重启远程轮询。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, buildInput]);

  useEffect(() => {
    subscription.current?.update(buildInput());
  }, [items, pollableKeys, buildInput]);

  const onVisibleItemsChange = useMemoizedFn(
    (visible: BridgeAwareHistoryItem[]) => {
      if (!active || !subscription.current) {
        return;
      }
      const batches = new Set<number>();
      for (const entry of visible) {
        const item = isBridgeHistoryRow(entry) ? entry.anchor : entry;
        if ('project_item' in item) {
          const index = indices.get(item.key);
          if (index !== undefined) {
            batches.add(Math.floor(index / BRIDGE_HISTORY_TX_BATCH));
          }
        }
      }
      const queries = new Map<string, BridgeHistoryQuery>();
      for (const batch of batches) {
        const start = batch * BRIDGE_HISTORY_TX_BATCH;
        for (const query of collectBridgeQueries(
          items,
          start,
          start + BRIDGE_HISTORY_TX_BATCH,
        )) {
          const key = historyTxKey(query.chain, query.hash);
          queries.set(key, query);
        }
      }
      if (
        viewport.current.size !== queries.size ||
        [...queries.keys()].some(key => !viewport.current.has(key))
      ) {
        // 只订阅初始化窗口和当前可见批次，避免滚动历史无限扩大查询集合。
        viewport.current = queries;
        subscription.current.update(buildInput());
      }
    },
  );

  const refresh = useMemoizedFn(() => subscription.current?.refresh());
  return { records, onVisibleItemsChange, refresh };
}
