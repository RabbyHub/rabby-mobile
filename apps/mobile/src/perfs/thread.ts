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

function getStartupProfilerWorkerDelayMs() {
  const activeUntil = Number(
    (
      globalThis as typeof globalThis & {
        __RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__?: number;
      }
    ).__RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__ || 0,
  );

  if (!Number.isFinite(activeUntil) || activeUntil <= 0) {
    return 0;
  }

  return Math.max(0, activeUntil - Date.now());
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

async function startWorkerThreadIfEnabled() {
  if (!isOnlineWorkerThreadEnabled()) {
    return;
  }

  const profilerDelayMs = getStartupProfilerWorkerDelayMs();
  if (profilerDelayMs > 0) {
    if (!workerThreadDeferredStartTimer) {
      console.info('[RabbyStartupProfiler] worker_thread_deferred', {
        delayMs: profilerDelayMs,
      });
      workerThreadDeferredStartTimer = setTimeout(() => {
        workerThreadDeferredStartTimer = null;
        void startWorkerThreadIfEnabled();
      }, profilerDelayMs);
    }
    return;
  }

  try {
    await startWorkerThreadOnce();
  } catch (error) {
    console.warn('Failed to start computation worker thread', error);
  }
}

function subscribeWorkerThreadOnlineConfig() {
  if (didSubscribeOnlineConfig) {
    return;
  }

  didSubscribeOnlineConfig = true;
  subscribeOnlineConfig(() => {
    void startWorkerThreadIfEnabled();
  });
}

export async function startComputationThread() {
  subscribeWorkerThreadOnlineConfig();
  await getLatestOnlineConfig();
  await startWorkerThreadIfEnabled();
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
