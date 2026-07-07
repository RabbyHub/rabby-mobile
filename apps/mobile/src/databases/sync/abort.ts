import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';

type SyncAbortHandler = (reason: string) => void;

const syncAbortHandlers = new Set<SyncAbortHandler>();
let syncAbortVersion = 0;

export function getSyncAbortVersion() {
  return syncAbortVersion;
}

export function isSyncAbortVersionStale(version: number) {
  return version !== syncAbortVersion;
}

export function makeSyncAbortError(reason: string) {
  const error = new Error(`Sync task aborted: ${reason}`);
  error.name = 'SyncTaskAbortError';
  return error;
}

export function registerSyncAbortHandler(handler: SyncAbortHandler) {
  syncAbortHandlers.add(handler);

  return () => {
    syncAbortHandlers.delete(handler);
  };
}

export function notifySyncAbortHandlers(reason = 'manual') {
  syncAbortVersion += 1;
  traceStartupDiagnostic('db_scheduler', 'abort_all', {
    reason,
    version: syncAbortVersion,
    handlerCount: syncAbortHandlers.size,
  });

  Array.from(syncAbortHandlers).forEach(handler => {
    try {
      handler(reason);
    } catch (error) {
      console.error('[syncAbort] abort handler failed', error);
    }
  });
}
