import { useEffect, useRef, useState } from 'react';
import { useInterval, useMemoizedFn } from 'ahooks';
import { isEqual } from 'lodash';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { bridgeRemoteSourceCompleteTs } from '../utils/remoteFromTx';
import { getBridgeStatus } from '../utils/status';
import {
  findBridgeHistory,
  getBridgeRecordKey,
  isStaleUnmatchedLocal,
} from '../utils/record';
import type { BridgeRecordData } from '../utils/statusTypes';

async function readLocalBridgeRecord(local: BridgeTxHistoryItem) {
  const stored = (await transactionHistoryServiceApi.getRecentTxHistory(
    local.address,
    local.hash,
    local.fromChainId,
    'bridge',
  )) as BridgeTxHistoryItem | null;
  // 存储里还没有完成时间时，保留内存里已经记下的时间。
  return stored
    ? {
        ...stored,
        fromTxCompleteTs: stored.fromTxCompleteTs || local.fromTxCompleteTs,
      }
    : local;
}

export function useBridgeRecord(initial: BridgeRecordData, enabled: boolean) {
  const [saved, setRecord] = useState(initial);
  const generation = useRef(0);
  const inFlight = useRef<string | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const key = getBridgeRecordKey(initial);
  const identity = useRef(key);
  const active = useRef(enabled);
  identity.current = key;
  active.current = enabled;
  const record = getBridgeRecordKey(saved) === key ? saved : initial;
  useEffect(() => {
    setRecord(initial);
    // 同一笔交易保留已刷新的记录，避免入参覆盖最新状态。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = useMemoizedFn(async () => {
    if (!enabled || !active.current || !record.address) {
      return;
    }
    const requestGeneration = generation.current;
    const requestKey = `${key}:${requestGeneration}`;
    let controller: AbortController | undefined;
    const isCurrent = () =>
      !controller?.signal.aborted &&
      requestGeneration === generation.current &&
      identity.current === key &&
      active.current;
    try {
      const storedLocal = record.local
        ? await readLocalBridgeRecord(record.local)
        : undefined;
      if (!isCurrent()) {
        return;
      }
      // 本地确认结果先更新界面，不等待远程请求，也不覆盖期间更新的远程记录。
      if (storedLocal) {
        setRecord(current =>
          isEqual(current.local, storedLocal)
            ? current
            : { ...current, local: storedLocal },
        );
      }
      let local = storedLocal;
      // 远程请求去重不阻塞本地同步，取消后不再查询远程状态。
      if (local?.isCanceled || inFlight.current === requestKey) {
        return;
      }
      const hashes = [
        local?.acceleratedHash,
        local?.hash,
        record.history?.from_tx.tx_id,
      ].filter((value): value is string => !!value);
      if (!hashes.length) {
        return;
      }
      inFlight.current = requestKey;
      controller = new AbortController();
      request.current = controller;
      const { data: response } = await openapi.request.post<
        Awaited<ReturnType<typeof openapi.getBridgeHistoryListByTxIds>>
      >(
        '/v1/bridge/history_list_by_tx_ids',
        { from_tx_ids: [...new Set(hashes)] },
        {
          signal: controller.signal,
        },
      );
      if (!isCurrent()) {
        return;
      }
      // 请求期间本地状态仍会更新，返回后重读，避免旧快照覆盖确认或取消结果。
      if (local) {
        local = await readLocalBridgeRecord(local);
      }
      if (!isCurrent()) {
        return;
      }
      const list = Array.isArray(response.history_list)
        ? response.history_list
        : undefined;
      const history = list
        ? findBridgeHistory(list, {
            chain: local?.fromToken.chain ?? record.history?.from_token.chain,
            hash: local ? local.hash : record.history?.from_tx.tx_id,
            acceleratedHash: local?.acceleratedHash,
          })
        : undefined;
      // 列表正常返回、又对不上，且本地从未有过远程记录时，才结束这条待处理。
      if (
        local &&
        list &&
        !history &&
        !record.history &&
        isStaleUnmatchedLocal(local)
      ) {
        await transactionHistoryServiceApi.completeBridgeTxHistory(
          local.hash,
          local.fromChainId,
          'failed',
        );
        if (isCurrent()) {
          setRecord({
            ...record,
            local: { ...local, status: 'failed', completedAt: Date.now() },
          });
        }
        return;
      }
      let next = { ...record, local, history: history ?? record.history };
      if (local && history && !local.isCanceled) {
        // 确认时间优先取远程 time_at，否则沿用已有时间，最后用当前时间兜底。
        if (
          history.status === 'pending' &&
          history.from_tx?.status === 'success'
        ) {
          local = {
            ...local,
            fromTxCompleteTs:
              bridgeRemoteSourceCompleteTs(history) ||
              local.fromTxCompleteTs ||
              Date.now(),
          };
        }
        next = { ...next, local };
        const status = getBridgeStatus(next);
        const terminal =
          status.scene === 'succeeded'
            ? 'allSuccess'
            : status.scene === 'sourceFailed'
            ? 'fromFailed'
            : status.failed
            ? 'failed'
            : undefined;
        local = {
          ...local,
          ...(status.sourceCompleteTs
            ? { fromTxCompleteTs: status.sourceCompleteTs }
            : {}),
          status:
            terminal ||
            (history.from_tx?.status === 'success'
              ? 'fromSuccess'
              : local.status),
          actualToToken: history.to_actual_token ?? local.actualToToken,
          actualToAmount:
            history.actual?.receive_token_amount ?? local.actualToAmount,
          toTxId: history.to_tx?.tx_id || local.toTxId,
        };
        next = { ...next, local };
        // 仅在终态发生变化时写回本地历史，避免轮询重复持久化。
        if (terminal && record.local?.status !== terminal) {
          await transactionHistoryServiceApi.completeBridgeTxHistory(
            local.hash,
            local.fromChainId,
            terminal,
            history,
          );
        }
      }
      if (isCurrent()) {
        setRecord(next);
      }
    } catch (error) {
      if (isCurrent()) {
        console.warn('[Bridge] refresh failed', error);
      }
    } finally {
      if (controller && inFlight.current === requestKey) {
        inFlight.current = undefined;
      }
      if (controller && request.current === controller) {
        request.current = undefined;
      }
    }
  });
  const scene = getBridgeStatus(record).scene;
  const pending = [
    'sourcePending',
    'destCountdown',
    'destStillBridging',
    'destDelayed',
  ].includes(scene);
  // 首次启用、恢复启用或切换交易时立即补一次刷新。
  useEffect(() => {
    generation.current += 1;
    active.current = enabled;
    if (enabled) {
      refresh().catch(error => console.warn('[Bridge] refresh failed', error));
    }
    // 暂停也结束本轮请求，避免快速返回后旧响应重新生效。
    return () => {
      active.current = false;
      generation.current += 1;
      request.current?.abort();
      request.current = undefined;
    };
  }, [enabled, key, refresh]);
  // 仅在启用且交易未结束时轮询，终态停止定时请求。
  useInterval(
    () => {
      refresh().catch(error => console.warn('[Bridge] refresh failed', error));
    },
    enabled && pending ? 2500 : undefined,
  );
  return record;
}
