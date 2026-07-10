import { runStartupDiagnosticTask } from './core/utils/startupDiagnostics';
import { startReadableAccountHeavyStoreInitializer } from './store/initializers';
import type { ReadableAccountHeavyStoreTarget } from './store/initializers';

export type ReadableAccountStoreWarmupTarget =
  ReadableAccountHeavyStoreTarget;

export async function startInitReadableAccountStores(
  target: ReadableAccountStoreWarmupTarget = 'all',
  reason = 'unknown',
) {
  return runStartupDiagnosticTask(
    `initReadableAccountStores.${target}`,
    {
      target,
      reason,
    },
    async () => {
      const label = `initReadableAccountStores.${target}`;
      console.time(label);
      try {
        await startReadableAccountHeavyStoreInitializer(target);
      } finally {
        console.timeEnd(label);
      }
    },
  );
}
