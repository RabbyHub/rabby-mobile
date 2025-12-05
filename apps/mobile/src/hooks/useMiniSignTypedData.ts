import { useSyncExternalStore } from 'react';
import { Account } from '@/core/services/preference';
import { sendSignTypedData } from '@/utils/sendTypedData';
import { MiniTypedData } from './useMiniSignTypedDataApprovalTask';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { apiLedger, apiOneKey } from '@/core/apis';
import {
  callConnectLedgerModal,
  setLedgerStatus,
} from '@/hooks/ledger/useLedgerStatus';
import {
  callConnectOneKeyModal,
  setOneKeyStatus,
} from '@/hooks/onekey/useOneKeyStatus';
import { t } from 'i18next';
import type { BatchSignTxTaskType } from '@/components/Approval/components/MiniSignTx/useBatchSignTxTask';

type ProgressStatus = 'building' | 'builded' | 'signed' | 'submitted';

type MiniSignTypedDataStatus = 'pending' | 'signing' | 'signed' | 'failed';

type MiniSignTypedDataError = NonNullable<BatchSignTxTaskType['error']>;

type MiniSignTypedDataInfo = {
  currentTxIndex: number;
  totalTxs: number;
  status: MiniSignTypedDataStatus;
  lastProgress?: ProgressStatus;
  lastHash?: string;
  error: MiniSignTypedDataError | null;
};

const createDefaultInfo = (): MiniSignTypedDataInfo => ({
  currentTxIndex: 0,
  totalTxs: 0,
  status: 'pending',
  lastProgress: undefined,
  lastHash: undefined,
  error: null,
});

type Listener = () => void;

export type MiniSignTypedDataResult = Awaited<
  ReturnType<typeof sendSignTypedData>
>;

type MiniSignTypedDataRunContext = {
  txs: MiniTypedData[];
  account: Account;
  ga?: Record<string, any>;
  currentIndex: number;
  results: MiniSignTypedDataResult[];
  onProgress?: MiniSignTypedDataParams['onProgress'];
};

const HARDWARE_USER_CANCELLED = 'User cancelled hardware connection';

class MiniSignTypedDataStore {
  private state: MiniSignTypedDataInfo = createDefaultInfo();
  private listeners = new Set<Listener>();
  private runContext: MiniSignTypedDataRunContext | null = null;
  private pendingPromise: Promise<MiniSignTypedDataResult[]> | null = null;
  private pendingResult: {
    resolve: (value: MiniSignTypedDataResult[]) => void;
    reject: (reason: any) => void;
  } | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  reset = () => {
    this.clearRunContext();
    this.pendingPromise = null;
    this.pendingResult = null;
    this.setState(createDefaultInfo());
  };

  startRun = (total: number, context: MiniSignTypedDataRunContext) => {
    this.runContext = {
      ...context,
      results: [...context.results],
    };
    this.setState({
      currentTxIndex: total > 0 ? context.currentIndex : 0,
      totalTxs: total,
      status: 'signing',
      lastProgress: undefined,
      lastHash: undefined,
      error: null,
    });
  };

  progress = ({
    index,
    total,
    progress,
    hash,
  }: {
    index: number;
    total: number;
    progress: ProgressStatus;
    hash?: string;
  }) => {
    const isLast = index === total - 1;
    const nextStatus: MiniSignTypedDataStatus =
      progress === 'signed' && isLast ? 'signed' : 'signing';
    const nextIndex =
      total <= 1 ? 0 : progress === 'signed' && !isLast ? index + 1 : index;

    this.patchRunContext({
      currentIndex: nextIndex,
    });

    this.patchState({
      currentTxIndex: nextIndex,
      totalTxs: total,
      status: nextStatus,
      lastProgress: progress,
      lastHash: hash ?? undefined,
      error: null,
    });
  };

  finish = (total: number) => {
    this.patchState({
      currentTxIndex: total ? total - 1 : 0,
      totalTxs: total,
      status: 'signed',
      lastProgress: 'signed',
      error: null,
    });
  };

  fail = (message: string) => {
    const currentIndex =
      this.runContext?.currentIndex ?? this.state.currentTxIndex ?? 0;
    const isRejected =
      message === HARDWARE_USER_CANCELLED || /reject/i.test(message || '');
    const status: MiniSignTypedDataError['status'] = isRejected
      ? 'REJECTED'
      : 'FAILED';
    const content =
      status === 'REJECTED'
        ? t('page.signFooterBar.ledger.txRejected')
        : t('page.signFooterBar.qrcode.txFailed');
    this.patchState({
      status: 'failed',
      currentTxIndex: currentIndex,
      error: {
        status,
        content,
        description: message,
      },
    });
  };

  createPendingPromise = () => {
    if (this.pendingResult) {
      this.pendingResult.reject(new Error('Replaced by new request'));
      this.pendingResult = null;
      this.pendingPromise = null;
    }
    let resolve!: (value: MiniSignTypedDataResult[]) => void;
    let reject!: (reason: any) => void;
    const promise = new Promise<MiniSignTypedDataResult[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.pendingResult = { resolve, reject };
    this.pendingPromise = promise;
    return promise;
  };

  getPendingPromise = () => this.pendingPromise;

  resolvePending = (value: MiniSignTypedDataResult[]) => {
    if (this.pendingResult) {
      this.pendingResult.resolve(value);
    }
    this.pendingResult = null;
    this.pendingPromise = null;
  };

  rejectPending = (reason: any) => {
    if (!this.pendingResult) {
      return false;
    }
    this.pendingResult.reject(reason);
    this.pendingResult = null;
    this.pendingPromise = null;
    return true;
  };

  patchRunContext = (patch: Partial<MiniSignTypedDataRunContext>): void => {
    if (!this.runContext) return;
    this.runContext = {
      ...this.runContext,
      ...patch,
      results:
        patch.results !== undefined
          ? [...patch.results]
          : this.runContext.results,
    };
  };

  getRunContext = () => this.runContext;

  clearRunContext = () => {
    this.runContext = null;
  };

  private setState(next: MiniSignTypedDataInfo) {
    this.state = next;
    this.emit();
  }

  private patchState(patch: Partial<MiniSignTypedDataInfo>) {
    this.setState({
      ...this.state,
      ...patch,
    });
  }

  private emit() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('miniSignTypedDataState listener error', error);
      }
    });
  }
}

const store = new MiniSignTypedDataStore();

const ensureHardwareConnected = async (account: Account) => {
  const type = account.type;
  if (type === KEYRING_CLASS.HARDWARE.LEDGER) {
    await new Promise<void>(async (resolve, reject) => {
      let settled = false;
      const safeResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const safeReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      try {
        const [isConnected, deviceId] = await apiLedger.isConnected(
          account.address,
          // true,
        );
        setLedgerStatus(isConnected);
        if (isConnected) {
          safeResolve();
          return;
        }
        callConnectLedgerModal({
          cb: safeResolve,
          deviceId,
          reject: () => safeReject(new Error(HARDWARE_USER_CANCELLED)),
          address: account.address,
        });
      } catch (error) {
        safeReject(error);
      }
    });
    return;
  }

  if (type === KEYRING_CLASS.HARDWARE.ONEKEY) {
    await new Promise<void>(async (resolve, reject) => {
      let settled = false;
      const safeResolve = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const safeReject = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error instanceof Error ? error : new Error(String(error)));
      };
      try {
        const [isConnected, deviceId] = await apiOneKey.isConnected(
          account.address,
        );
        setOneKeyStatus(isConnected);
        if (isConnected) {
          safeResolve();
          return;
        }
        callConnectOneKeyModal({
          cb: safeResolve,
          deviceId,
          reject: () => safeReject(new Error(HARDWARE_USER_CANCELLED)),
          address: account.address,
        });
      } catch (error) {
        safeReject(error);
      }
    });
  }
};

export const resetMiniSignTypedDataState = () => {
  store.reset();
};

export const useMiniSignTypedDataState = () =>
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

export const getMiniSignTypedDataState = () => store.getSnapshot();

export const getMiniSignTypedDataContext = () => store.getRunContext();

export const cancelMiniSignTypedData = (reason?: any) => {
  const description =
    reason instanceof Error
      ? reason.message
      : reason
      ? String(reason)
      : store.getSnapshot().error?.description ?? HARDWARE_USER_CANCELLED;
  const error = reason instanceof Error ? reason : new Error(description);
  store.rejectPending(error);
  store.reset();
};

type MiniSignTypedDataParams = {
  txs: MiniTypedData[];
  account: Account;
  ga?: Record<string, any>;
  onProgress?: (payload: {
    status: ProgressStatus;
    index: number;
    total: number;
    item: MiniTypedData;
    hash?: string;
  }) => void;
};

type ExecuteSignTypedDataParams = {
  txs: MiniTypedData[];
  account: Account;
  ga?: Record<string, any>;
  startIndex?: number;
  initialResults?: MiniSignTypedDataResult[];
  onProgress?: MiniSignTypedDataParams['onProgress'];
};

const executeSignTypedData = async ({
  txs,
  account,
  ga,
  startIndex = 0,
  initialResults = [],
  onProgress,
}: ExecuteSignTypedDataParams): Promise<MiniSignTypedDataResult[] | null> => {
  if (!txs.length) {
    const error = new Error('No typed data payloads to sign');
    store.fail(error.message);
    store.rejectPending(error);
    store.reset();
    return null;
  }

  const total = txs.length;
  const resumeIndex = Math.min(Math.max(startIndex, 0), total);
  const results = initialResults.slice(0, resumeIndex);

  const context: MiniSignTypedDataRunContext = {
    txs,
    account,
    ga,
    currentIndex: resumeIndex,
    results: results.slice(),
    onProgress,
  };

  store.startRun(total, context);

  try {
    await ensureHardwareConnected(account);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    store.rejectPending(message);
    store.reset();
    return null;
  }

  for (let index = resumeIndex; index < total; index++) {
    const item = txs[index];
    try {
      const result = await sendSignTypedData({
        data: item.data,
        from: item.from,
        version: item.version,
        ga,
        account,
        onProgress: (status, hash) => {
          store.progress({
            index,
            total,
            progress: status,
            hash,
          });

          onProgress?.({
            status,
            index,
            total,
            item,
            hash,
          });
        },
      });

      results[index] = result;

      store.patchRunContext({
        currentIndex: index + 1,
        results: results.slice(),
        onProgress,
      });
    } catch (error) {
      store.patchRunContext({
        currentIndex: index,
        results: results.slice(),
        onProgress,
      });
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error');
      store.fail(message);
      return null;
    }
  }

  store.finish(total);
  store.clearRunContext();
  return results;
};

export const miniSignTypedData = (
  params: MiniSignTypedDataParams,
): Promise<MiniSignTypedDataResult[]> => {
  const { txs, account, ga, onProgress } = params;
  if (!txs?.length) {
    return Promise.reject(new Error('No typed data payloads to sign'));
  }

  const pendingPromise = store.createPendingPromise();

  executeSignTypedData({
    txs,
    account,
    ga,
    startIndex: 0,
    initialResults: [],
    onProgress,
  })
    .then(results => {
      if (results) {
        store.resolvePending(results);
        store.reset();
      }
    })
    .catch(error => {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error');
      store.fail(message);
    });

  return pendingPromise;
};

export const retryMiniSignTypedData = (options?: {
  onProgress?: MiniSignTypedDataParams['onProgress'];
}): Promise<MiniSignTypedDataResult[]> => {
  const snapshot = store.getSnapshot();
  if (snapshot.status !== 'failed') {
    throw new Error('No failed typed data signing to retry');
  }

  const context = store.getRunContext();
  if (!context) {
    throw new Error('No pending typed data signing context found');
  }

  const pendingPromise = store.getPendingPromise();
  if (!pendingPromise) {
    throw new Error('No pending typed data signing request');
  }

  const nextOnProgress = options?.onProgress ?? context.onProgress;

  store.patchRunContext({
    onProgress: nextOnProgress,
  });

  executeSignTypedData({
    txs: context.txs,
    account: context.account,
    ga: context.ga,
    startIndex: context.currentIndex,
    initialResults: context.results,
    onProgress: nextOnProgress,
  })
    .then(results => {
      if (results) {
        store.resolvePending(results);
        store.reset();
      }
    })
    .catch(error => {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error');
      store.fail(message);
    });

  return pendingPromise;
};
