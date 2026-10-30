import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import {
  getBridgeHistoryDetail,
  getBridgeHistoryDetailRefreshMs,
  type BridgeHistoryScene,
} from './historyStatus';
import {
  getBridgeProgressBar,
  getBridgeProgressRefreshMs,
} from './progressBar';
import {
  bridgeRemoteSourceCompleteTs,
  mergeBridgeSourceStatus,
} from './remoteFromTx';
import type {
  BridgeProgressRecord,
  BridgeRecordData,
  BridgeStatusHistory,
} from './statusTypes';

const localStatusByScene: Record<
  BridgeHistoryScene,
  BridgeTxHistoryItem['status']
> = {
  sourcePending: 'pending',
  destCountdown: 'fromSuccess',
  destStillBridging: 'fromSuccess',
  destDelayed: 'fromSuccess',
  sourceFailed: 'fromFailed',
  failedNoRefund: 'failed',
  refundOriginal: 'failed',
  refundOther: 'failed',
  succeeded: 'allSuccess',
};

function toStatusHistory({
  history,
  local,
}: BridgeRecordData): BridgeStatusHistory {
  const data: BridgeStatusHistory = history ?? {
    status:
      local?.status === 'allSuccess'
        ? 'completed'
        : local?.status === 'failed' || local?.status === 'fromFailed'
        ? 'failed'
        : 'pending',
    from_token: local?.fromToken,
    to_token: local?.toToken,
    to_actual_token: local?.actualToToken,
    quote: {
      pay_token_amount: local?.fromAmount,
      receive_token_amount: local?.toAmount,
    },
    actual: {
      pay_token_amount: local?.fromAmount,
      receive_token_amount: local?.actualToAmount,
    },
    create_at: local?.createdAt ? local.createdAt / 1000 : undefined,
    from_tx: {
      tx_id: local?.acceleratedHash || local?.hash || '',
      chain_id: local?.fromToken.chain || '',
      status:
        !local || local.status === 'pending'
          ? 'pending'
          : local.status === 'fromFailed'
          ? 'failed'
          : 'success',
      time_at: local?.fromTxCompleteTs
        ? local.fromTxCompleteTs / 1000
        : undefined,
    },
    to_tx: { tx_id: local?.toTxId },
  };
  // A canceled source transaction must not pick up the original hash's result.
  if (local?.isCanceled) {
    return {
      ...data,
      status: 'failed',
      from_tx: {
        ...data.from_tx,
        tx_id: local.acceleratedHash || local.hash,
        chain_id: local.fromToken.chain,
        status: 'failed',
      },
    };
  }
  return data;
}

/** Adapt mobile inputs and expose the ported helpers' results without reclassifying scenes. */
export function getBridgeStatus(record: BridgeRecordData, now = Date.now()) {
  const { local } = record;
  const data = toStatusHistory(record);
  const merged = mergeBridgeSourceStatus(data, local);
  const detail = getBridgeHistoryDetail(merged, local, now);
  const source = detail.steps[0];
  const receive = detail.steps[2] ?? detail.steps[1];
  const fromToken = source.token;
  const toToken = data.to_token;
  const sourceHash =
    source.detail.kind === 'hash' ? source.detail.txId : undefined;
  const sourceCompleteTs =
    bridgeRemoteSourceCompleteTs(merged) || local?.fromTxCompleteTs || 0;
  const toHash = data.to_tx?.tx_id || local?.toTxId;
  const progressRecord: BridgeProgressRecord | undefined = fromToken
    ? {
        status: localStatusByScene[detail.scene],
        hash: sourceHash || '',
        acceleratedHash: local?.acceleratedHash,
        fromToken,
        estimatedDuration: local?.estimatedDuration || 0,
        fromTxCompleteTs: sourceCompleteTs || undefined,
        actualToToken: data.to_actual_token?.id
          ? data.to_actual_token
          : local?.actualToToken,
        toTxId: toHash,
      }
    : undefined;
  const progress = progressRecord
    ? getBridgeProgressBar(progressRecord, now)
    : undefined;
  const refund = detail.action.kind === 'details' ? detail.action : undefined;
  return {
    detail,
    scene: detail.scene,
    progress,
    refreshMs: {
      card:
        progressRecord && progress
          ? getBridgeProgressRefreshMs(progressRecord, progress)
          : undefined,
      detail: getBridgeHistoryDetailRefreshMs(detail.scene),
    },
    fromToken,
    toToken,
    fromAmount: source.amount,
    toAmount: data.quote?.receive_token_amount ?? 0,
    receiveToken: receive.token,
    receiveAmount: receive.amount,
    sourceHash,
    sourceCompleteTs,
    createdAt: (data.create_at || 0) * 1000,
    completed: detail.header === 'succeeded',
    refunded:
      detail.scene === 'refundOriginal' || detail.scene === 'refundOther',
    failed: detail.header === 'failed' || detail.header === 'refund',
    refundHash: refund?.txId,
    refundChain: refund?.chainServerId,
  };
}

export type BridgeStatus = ReturnType<typeof getBridgeStatus>;
