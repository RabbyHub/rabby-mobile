import { useEffect, useRef, useState } from 'react';
import { useInterval, useMemoizedFn } from 'ahooks';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { getBridgeStatus } from '../utils/status';
import {
  findBridgeHistory,
  getBridgeRecordKey,
  sameBridgeHash,
} from '../utils/record';
import type { BridgeRecordData } from '../utils/statusTypes';

async function readLocalBridgeRecord(local: BridgeTxHistoryItem) {
  return (await transactionHistoryServiceApi.getRecentTxHistory(
    local.address,
    local.hash,
    local.fromChainId,
    'bridge',
  )) as BridgeTxHistoryItem | null;
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
    // 上一轮查询未结束时跳过本轮，避免同一实例重复请求。
    if (inFlight.current === requestKey) {
      return;
    }
    inFlight.current = requestKey;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () =>
      !controller.signal.aborted &&
      requestGeneration === generation.current &&
      identity.current === key &&
      active.current;
    try {
      let local = record.local;
      // 先同步本地源链确认、加速和取消结果，再查询跨链状态。
      if (local) {
        local = (await readLocalBridgeRecord(local)) || local;
      }
      if (!isCurrent()) {
        return;
      }
      if (local?.isCanceled) {
        setRecord({ ...record, local });
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
      // 请求期间也可能完成取消，返回后重读本地状态以免覆盖取消结果。
      if (local) {
        const latest = await readLocalBridgeRecord(local);
        if (latest?.isCanceled) {
          local = latest;
        }
      }
      if (!isCurrent()) {
        return;
      }
      const history = local
        ? findBridgeHistory(response.history_list || [], local)
        : response.history_list?.find(
            item =>
              item.from_token.chain === record.history?.from_token.chain &&
              sameBridgeHash(item.from_tx.tx_id, record.history?.from_tx.tx_id),
          );
      let next = { ...record, local, history: history ?? record.history };
      if (local && history && !local.isCanceled) {
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
      if (inFlight.current === requestKey) {
        inFlight.current = undefined;
      }
      if (request.current === controller) {
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
