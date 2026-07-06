import {
  getLatestOnlineConfig,
  isOnlineWorkerThreadEnabled,
  subscribeOnlineConfig,
} from '@/core/config/online';
import { IS_ANDROID, isBridgelessRuntimeEnabled } from '@/core/native/utils';
import { Thread, ThreadError } from '@/core/native/RNThread';

// relative path from the app bundle root
export const workerThread = new Thread('worker-src/worker.thread.js');
let workerThreadStartPromise: Promise<number> | null = null;
let didSubscribeOnlineConfig = false;

export function isWorkerThreadRunning() {
  return workerThread.isRunning;
}

export function shouldDisableWorkerThread() {
  return IS_ANDROID && isBridgelessRuntimeEnabled();
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
  if (shouldDisableWorkerThread()) {
    console.debug(
      '[perf] Worker Thread disabled on Android bridgeless runtime',
    );
    return;
  }

  if (!isOnlineWorkerThreadEnabled()) {
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
