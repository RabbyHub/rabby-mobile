// Ported from Rabby Bridge utils/progressBar.ts; only imports and input types differ.
import type { BridgeProgressRecord as BridgeTxHistoryItem } from './statusTypes';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { formatEstimateClock } from './duration';

export const BRIDGE_PROGRESS_COUNTDOWN_MIN_SECONDS = 5;
export const BRIDGE_PROGRESS_DELAY_MS = 30 * 60 * 1000;

/** 倒计时按秒刷新；只剩跨过延迟阈值时放慢；状态不再随时间变化时不刷新。 */
export const BRIDGE_STATUS_TICK_MS = 1000;
export const BRIDGE_STATUS_SLOW_TICK_MS = 30 * 1000;

export type BridgeProgressStep =
  | 'sourceLoading'
  | 'queued'
  | 'destLoading'
  | 'destDelayed'
  | 'success'
  | 'destFailed'
  | 'sourceFailed'
  | 'undo';

export type BridgeProgressFooter =
  | { kind: 'none' }
  | { kind: 'countdown'; time: string }
  | { kind: 'stillBridging' }
  | { kind: 'delayed' }
  | { kind: 'sourceFailed' }
  | {
      kind: 'refund';
      isOriginalToken: boolean;
      txId?: string;
      chainServerId?: string;
    }
  | { kind: 'failedNoRefund' };

export type BridgeProgressBar = {
  step1: BridgeProgressStep;
  step2: BridgeProgressStep;
  footer: BridgeProgressFooter;
};

export type BridgePopupStep =
  | 'processing'
  | 'queued'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refund';

const formatEta = (remainingSeconds: number) =>
  formatEstimateClock(remainingSeconds, true);

const refundDetails = (item: BridgeTxHistoryItem) => {
  const txId = item.toTxId;
  const chainServerId = item.actualToToken?.chain;
  if (!item.actualToToken?.id || !txId) {
    return null;
  }
  return { txId, chainServerId };
};

const sourceDoneProgress = (
  item: BridgeTxHistoryItem,
  now: number,
): BridgeProgressBar => {
  const elapsedMs = item.fromTxCompleteTs
    ? Math.max(0, now - item.fromTxCompleteTs)
    : 0;

  if (item.fromTxCompleteTs && elapsedMs >= BRIDGE_PROGRESS_DELAY_MS) {
    return {
      step1: 'success',
      step2: 'destDelayed',
      footer: { kind: 'delayed' },
    };
  }

  const estimateSeconds = item.estimatedDuration || 0;
  const remainingSeconds = estimateSeconds - elapsedMs / 1000;
  if (
    estimateSeconds > BRIDGE_PROGRESS_COUNTDOWN_MIN_SECONDS &&
    remainingSeconds > 0
  ) {
    return {
      step1: 'success',
      step2: 'destLoading',
      footer: { kind: 'countdown', time: formatEta(remainingSeconds) },
    };
  }

  // A quote of 5s or less never shows a countdown. Hold the footer until 5s
  // after the source chain completes so "Still Bridging" does not flash.
  if (elapsedMs < BRIDGE_PROGRESS_COUNTDOWN_MIN_SECONDS * 1000) {
    return {
      step1: 'success',
      step2: 'destLoading',
      footer: { kind: 'none' },
    };
  }

  return {
    step1: 'success',
    step2: 'destLoading',
    footer: { kind: 'stillBridging' },
  };
};

export const getBridgeProgressBar = (
  item: BridgeTxHistoryItem,
  now = Date.now(),
): BridgeProgressBar => {
  if (item.status === 'fromFailed') {
    return {
      step1: 'sourceFailed',
      step2: 'undo',
      footer: { kind: 'sourceFailed' },
    };
  }

  if (item.status === 'allSuccess') {
    return {
      step1: 'success',
      step2: 'success',
      footer: { kind: 'none' },
    };
  }

  if (item.status === 'failed') {
    const refund = refundDetails(item);
    if (refund) {
      return {
        step1: 'success',
        step2: 'undo',
        footer: {
          kind: 'refund',
          isOriginalToken:
            item.actualToToken?.chain === item.fromToken.chain &&
            isSameAddress(item.actualToToken?.id || '', item.fromToken.id),
          txId: refund.txId,
          chainServerId: refund.chainServerId,
        },
      };
    }
    return {
      step1: 'success',
      step2: 'destFailed',
      footer: { kind: 'failedNoRefund' },
    };
  }

  if (item.status === 'fromSuccess') {
    return sourceDoneProgress(item, now);
  }

  return {
    step1: 'sourceLoading',
    step2: 'queued',
    footer: { kind: 'none' },
  };
};

export const getBridgeProgressRefreshMs = (
  item: BridgeTxHistoryItem,
  progress: BridgeProgressBar,
) => {
  if (item.status !== 'fromSuccess') {
    return undefined;
  }
  if (progress.footer.kind === 'delayed') {
    return undefined;
  }
  if (progress.footer.kind === 'stillBridging') {
    return BRIDGE_STATUS_SLOW_TICK_MS;
  }
  // 倒计时，或源链完成后前 5 秒的空白期。
  return BRIDGE_STATUS_TICK_MS;
};
