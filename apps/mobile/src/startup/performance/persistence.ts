import {
  getStartupPerformanceRecorderSnapshot,
  isStartupPerformanceRecordingEnabled,
  recordStartupPerformanceEvent,
  restoreStartupPerformanceEventBatch,
  stopStartupPerformanceRecording,
  takeStartupPerformanceEventBatch,
} from './recorder';
import type { StartupPerformanceShareArtifact } from './fileStore';

type IdleCallbackHandle = number;
type RequestIdleCallback = (
  callback: () => void,
  options?: { timeout?: number },
) => IdleCallbackHandle;

async function runAfterInteractions(callback: () => void) {
  const { InteractionManager } = await import('react-native');
  InteractionManager.runAfterInteractions(callback);
}

let operationQueue: Promise<void> = Promise.resolve();
let didScheduleIdleFlush = false;

function runSerialized<T>(operation: () => Promise<T>) {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function flushStartupPerformanceLog(reason: string) {
  if (!isStartupPerformanceRecordingEnabled()) {
    return Promise.resolve<string | null>(null);
  }

  return runSerialized(async () => {
    const batch = takeStartupPerformanceEventBatch();
    if (!batch) {
      return null;
    }

    try {
      const { writeStartupPerformanceEventBatch } = await import('./fileStore');
      return await writeStartupPerformanceEventBatch(batch, reason);
    } catch (error) {
      restoreStartupPerformanceEventBatch(batch);
      throw error;
    }
  });
}

export function scheduleStartupPerformanceIdleFlush(reason = 'home_idle') {
  if (
    !isStartupPerformanceRecordingEnabled() ||
    didScheduleIdleFlush ||
    getStartupPerformanceRecorderSnapshot().stopped
  ) {
    return;
  }

  didScheduleIdleFlush = true;
  const flush = () => {
    recordStartupPerformanceEvent('persistence', 'idle_flush_requested', {
      reason,
    });
    stopStartupPerformanceRecording('idle_flush_requested');
    flushStartupPerformanceLog(reason).catch(error => {
      console.warn('[StartupPerformance] idle flush failed', error);
    });
  };
  const requestIdleCallback = (
    globalThis as {
      requestIdleCallback?: RequestIdleCallback;
    }
  ).requestIdleCallback;

  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(flush, { timeout: 5000 });
      return;
    }

    runAfterInteractions(flush).catch(() => {
      setTimeout(flush, 0);
    });
  }, 1200);
}

export function prepareStartupPerformanceLogsForSharing() {
  if (!isStartupPerformanceRecordingEnabled()) {
    return Promise.resolve<StartupPerformanceShareArtifact | null>(null);
  }

  recordStartupPerformanceEvent('persistence', 'share_flush_requested');
  return runSerialized(async () => {
    const batch = takeStartupPerformanceEventBatch();
    if (batch) {
      try {
        const { writeStartupPerformanceEventBatch } = await import(
          './fileStore'
        );
        await writeStartupPerformanceEventBatch(batch, 'share');
      } catch (error) {
        restoreStartupPerformanceEventBatch(batch);
        throw error;
      }
    }

    const { prepareStartupPerformanceLogShare } = await import('./fileStore');
    return prepareStartupPerformanceLogShare();
  });
}
