import { LRUCache } from 'lru-cache';
import { isEqual } from 'lodash';
import type { BridgeHistory } from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import {
  BRIDGE_HISTORY_TX_BATCH,
  bridgeReceiveKey,
  bridgeSourceKey,
  historyTxKey,
  shouldPollPendingBridge,
  type BridgeHistoryQuery,
} from './utils/bridgeHistory';

type SubscriptionInput = {
  queries: BridgeHistoryQuery[];
  transactionKeys: Set<string>;
  pollableKeys: Set<string>;
};
type Subscriber = SubscriptionInput & {
  records: Map<string, BridgeHistory>;
  onChange: (records: BridgeHistory[]) => void;
};
type Task = { query: BridgeHistoryQuery; priority: number };
type Request = { tasks: Task[]; controller: AbortController };

// 仅缓存接口原始记录和成功空结果，不持久化到账 hash 的反向映射。
const cache = new LRUCache<string, { history: BridgeHistory | null }>({
  max: 2000,
});
const subscribers = new Set<Subscriber>();
// 预热查询没有页面订阅，单独登记以免被 prune 丢弃；请求结束即移除，失败不重试。
const prefetchKeys = new Set<string>();
const PREFETCH_PRIORITY = 2;
const queue = new Map<string, Task>();
let request: Request | undefined;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let rateTimer: ReturnType<typeof setTimeout> | undefined;
let lastStartedAt = 0;

const queryKey = (query: BridgeHistoryQuery) =>
  historyTxKey(query.chain, query.hash);

function isRelevant(transactionKeys: Set<string>, history: BridgeHistory) {
  return (
    transactionKeys.has(bridgeSourceKey(history)) ||
    transactionKeys.has(bridgeReceiveKey(history))
  );
}

export function getBridgeHistorySnapshot(
  transactionKeys: Set<string>,
  records: BridgeHistory[],
) {
  if (!transactionKeys.size) {
    return [];
  }
  const next = new Map<string, BridgeHistory>();
  // 保留页面快照，避免共享 LRU 淘汰后已展示的条目退回普通交易。
  for (const history of records) {
    const key = bridgeSourceKey(history);
    const latest = cache.peek(key)?.history || history;
    if (isRelevant(transactionKeys, latest)) {
      next.set(key, latest);
    }
  }
  for (const [key, entry] of cache) {
    if (entry.history && isRelevant(transactionKeys, entry.history)) {
      next.set(key, entry.history);
    }
  }
  return [...next.values()];
}

function publish(subscriber: Subscriber) {
  const next = new Map(
    getBridgeHistorySnapshot(subscriber.transactionKeys, [
      ...subscriber.records.values(),
    ]).map(history => [bridgeSourceKey(history), history]),
  );
  const changed =
    next.size !== subscriber.records.size ||
    [...next].some(([key, history]) => subscriber.records.get(key) !== history);
  subscriber.records = next;
  if (changed) {
    subscriber.onChange([...next.values()]);
  }
}

function isNeeded(key: string) {
  if (prefetchKeys.has(key)) {
    return true;
  }
  return [...subscribers].some(
    subscriber =>
      subscriber.records.has(key) ||
      subscriber.queries.some(query => queryKey(query) === key),
  );
}

function enqueue(query: BridgeHistoryQuery, force = false, priority = 1) {
  const key = queryKey(query);
  if (
    (!force && cache.has(key)) ||
    request?.tasks.some(task => queryKey(task.query) === key)
  ) {
    return;
  }
  const old = queue.get(key);
  if (!old || priority < old.priority) {
    queue.set(key, { query, priority });
  }
}

function pendingQueries() {
  const result = new Map<string, BridgeHistoryQuery>();
  for (const subscriber of subscribers) {
    for (const [key, history] of subscriber.records) {
      if (
        shouldPollPendingBridge(history) &&
        (subscriber.pollableKeys.has(key) ||
          subscriber.pollableKeys.has(bridgeReceiveKey(history)))
      ) {
        result.set(key, {
          chain: history.from_token.chain,
          hash: history.from_tx.tx_id,
        });
      }
    }
  }
  return result;
}

function syncPolling() {
  if (!pendingQueries().size) {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  } else if (!pollTimer) {
    pollTimer = setTimeout(() => {
      pollTimer = undefined;
      for (const query of pendingQueries().values()) {
        enqueue(query, true, 0);
      }
      drain();
      syncPolling();
    }, 3000);
  }
}

function prune() {
  for (const key of queue.keys()) {
    if (!isNeeded(key)) {
      queue.delete(key);
    }
  }
  // 其他活跃页面仍需要本批结果时保留请求，全部不需要时真正中止 HTTP。
  if (request && !request.tasks.some(task => isNeeded(queryKey(task.query)))) {
    request.controller.abort();
    request = undefined;
  }
  if (!queue.size) {
    clearTimeout(rateTimer);
    rateTimer = undefined;
  }
  syncPolling();
}

function drain() {
  if (
    request ||
    rateTimer ||
    (!subscribers.size && !prefetchKeys.size) ||
    !queue.size
  ) {
    return;
  }
  const wait = lastStartedAt + 500 - Date.now();
  if (wait > 0) {
    rateTimer = setTimeout(() => {
      rateTimer = undefined;
      drain();
    }, wait);
    return;
  }
  const tasks = [...queue.values()]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, BRIDGE_HISTORY_TX_BATCH);
  for (const task of tasks) {
    queue.delete(queryKey(task.query));
  }
  const current: Request = { tasks, controller: new AbortController() };
  request = current;
  lastStartedAt = Date.now();
  const isCurrent = () =>
    request === current && !current.controller.signal.aborted;
  openapi.request
    .post<Awaited<ReturnType<typeof openapi.getBridgeHistoryListByTxIds>>>(
      '/v1/bridge/history_list_by_tx_ids',
      {
        from_tx_ids: [
          ...new Set(tasks.map(task => task.query.hash.toLowerCase())),
        ],
      },
      { signal: current.controller.signal },
    )
    .then(({ data }) => {
      if (!isCurrent() || !Array.isArray(data.history_list)) {
        return;
      }
      const received = new Map(
        data.history_list.map(history => [bridgeSourceKey(history), history]),
      );
      // 只接纳本批源链和 hash 匹配的结果，未匹配时保留已识别记录。
      for (const { query } of tasks) {
        const key = queryKey(query);
        const old = cache.peek(key)?.history;
        const history = received.get(key) || old || null;
        cache.set(key, {
          history: isEqual(old, history) ? old ?? null : history,
        });
      }
      for (const subscriber of subscribers) {
        publish(subscriber);
      }
      syncPolling();
    })
    .catch(error => {
      if (isCurrent()) {
        console.warn('[BridgeHistoryLookup] query failed', error);
      }
    })
    .finally(() => {
      for (const { query } of tasks) {
        prefetchKeys.delete(queryKey(query));
      }
      if (request === current) {
        request = undefined;
        drain();
      }
    });
}

export function prefetchBridgeHistory(queries: BridgeHistoryQuery[]) {
  for (const query of queries) {
    enqueue(query, false, PREFETCH_PRIORITY);
    const key = queryKey(query);
    if (queue.has(key)) {
      prefetchKeys.add(key);
    }
  }
  drain();
}

export function subscribeBridgeHistory(
  onChange: Subscriber['onChange'],
  records: BridgeHistory[],
) {
  const subscriber: Subscriber = {
    queries: [],
    transactionKeys: new Set(),
    pollableKeys: new Set(),
    records: new Map(
      records.map(history => [bridgeSourceKey(history), history]),
    ),
    onChange,
  };
  subscribers.add(subscriber);

  const update = (input: SubscriptionInput, refresh = false) => {
    if (!subscribers.has(subscriber)) {
      return;
    }
    const previousQueries = new Set(subscriber.queries.map(queryKey));
    Object.assign(subscriber, input);
    publish(subscriber);
    for (const query of input.queries) {
      const key = queryKey(query);
      const cached = cache.get(key);
      // 新进入查询范围的交易补查一次空缓存，避免预热过早时漏掉新 Bridge。
      enqueue(
        query,
        !cached?.history && (refresh || !previousQueries.has(key)),
      );
    }
    if (refresh) {
      for (const history of subscriber.records.values()) {
        if (history.status === 'pending') {
          enqueue(
            { chain: history.from_token.chain, hash: history.from_tx.tx_id },
            true,
            0,
          );
        }
      }
    }
    prune();
    drain();
  };

  return {
    update,
    refresh: () => update(subscriber, true),
    dispose: () => {
      subscribers.delete(subscriber);
      // 最后一个订阅退出时，prune 同时清空队列、中止请求并停止两类计时器。
      prune();
      drain();
    },
  };
}
