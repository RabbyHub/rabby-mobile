import { getLatestOnlineConfig } from '@/core/config/online';
import { Thread, ThreadError } from '@/core/native/RNThread';

// relative path from the app bundle root
export const workerThread = new Thread('worker-src/worker.thread.js');

export function isWorkerThreadRunning() {
  return workerThread.isRunning;
}

export async function startComputationThread() {
  const config = await getLatestOnlineConfig();
  if (config.switches?.['20251226.enable_worker_thread']) {
    workerThread.start();
  }
}

type Context = {
  workThread: Thread;
  rpcCall: Thread['remoteCall'];
};
export async function rpcCallAndFallback<
  T extends (ctx: Context, ...args: any[]) => Promise<any>,
>(fn: T, fallback: () => Awaited<ReturnType<T>> | ReturnType<T>) {
  try {
    if (!__DEV__ || !workerThread.isRunning) {
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
