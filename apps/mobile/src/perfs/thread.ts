import {
  getLatestOnlineConfig,
  isOnlineWorkerThreadEnabled,
  subscribeOnlineConfig,
} from '@/core/config/online';
import { Thread, ThreadError } from '@/core/native/RNThread';

// relative path from the app bundle root
export const workerThread = new Thread('worker-src/worker.thread.js');
let workerThreadStartPromise: Promise<number> | null = null;
let didSubscribeOnlineConfig = false;
let workerThreadDeferredStartTimer: ReturnType<typeof setTimeout> | null = null;
let workerThreadStartRequestPromise: Promise<void> | null = null;

function getStartupProfilerWorkerDelayMs() {
  const deferWorkerUntil = Number(
    (
      globalThis as typeof globalThis & {
        __RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__?: number;
      }
    ).__RABBY_STARTUP_PROFILER_DEFER_WORKER_UNTIL__ || 0,
  );

  if (!Number.isFinite(deferWorkerUntil) || deferWorkerUntil <= 0) {
    return 0;
  }

  return Math.max(0, deferWorkerUntil - Date.now());
}

export function isWorkerThreadRunning() {
  return workerThread.isRunning;
}

function startWorkerThreadOnce() {
  if (workerThread.isRunning) {
    return Promise.resolve();
  }

  if (!workerThreadStartPromise) {
    workerThreadStartPromise = workerThread.start().finally(() => {
      workerThreadStartPromise = null;
    });
  }

  return workerThreadStartPromise.then(() => undefined);
}

async function startWorkerThreadIfEnabled(reason = 'unknown') {
  if (!isOnlineWorkerThreadEnabled()) {
    return;
  }

  const profilerDelayMs = getStartupProfilerWorkerDelayMs();
  if (profilerDelayMs > 0) {
    if (!workerThreadDeferredStartTimer) {
      console.info('[RabbyStartupProfiler] worker_thread_deferred', {
        delayMs: profilerDelayMs,
        reason,
      });
      workerThreadDeferredStartTimer = setTimeout(() => {
        workerThreadDeferredStartTimer = null;
        void startWorkerThreadIfEnabled(`${reason}:deferred`);
      }, profilerDelayMs);
    }
    return;
  }

  try {
    await startWorkerThreadOnce();
  } catch (error) {
    console.warn('Failed to start computation worker thread', reason, error);
  }
}

function subscribeWorkerThreadOnlineConfig() {
  if (didSubscribeOnlineConfig) {
    return;
  }

  didSubscribeOnlineConfig = true;
  subscribeOnlineConfig(() => {
    void startWorkerThreadIfEnabled('online_config_update');
  });
}

export function requestComputationThreadStart(reason = 'manual') {
  subscribeWorkerThreadOnlineConfig();

  if (workerThread.isRunning || workerThreadStartRequestPromise) {
    return;
  }

  workerThreadStartRequestPromise = Promise.resolve()
    .then(() => startWorkerThreadIfEnabled(`${reason}:cached_config`))
    .then(() => getLatestOnlineConfig())
    .then(() => startWorkerThreadIfEnabled(`${reason}:latest_config`))
    .catch(error => {
      console.warn(
        'Failed to request computation worker thread',
        reason,
        error,
      );
    })
    .finally(() => {
      workerThreadStartRequestPromise = null;
    });
}

export async function startComputationThread(reason = 'manual') {
  subscribeWorkerThreadOnlineConfig();
  await startWorkerThreadIfEnabled(`${reason}:cached_config`);
  await getLatestOnlineConfig();
  await startWorkerThreadIfEnabled(`${reason}:latest_config`);
}

type Context = {
  workThread: Thread;
  rpcCall: Thread['remoteCall'];
};
export async function rpcCallAndFallback<
  T extends (ctx: Context, ...args: any[]) => Promise<any>,
>(fn: T, fallback: () => Awaited<ReturnType<T>> | ReturnType<T>) {
  try {
    if (!workerThread.isRunning) {
      requestComputationThreadStart('rpc_fallback');
      throw new Error(ThreadError.Timeout);
    }
    return fn({
      workThread: workerThread,
      rpcCall: workerThread.remoteCall.bind(workerThread),
    });
  } catch (error: any) {
    const msg = error.message;
    if (msg === ThreadError.Timeout) {
      return fallback();
    }
    throw error;
  }
}
