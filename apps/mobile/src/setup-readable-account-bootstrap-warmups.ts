import { ensureAccountBalanceSelectionLifecycle } from './store/balanceAccountSelection';
import { runStartupDiagnosticTask } from './core/utils/startupDiagnostics';
import { startReadableAccountBootStoreInitializers } from './store/initializers';

async function initPersistedStores() {
  return runStartupDiagnosticTask('initPersistedStores', {}, async () => {
    console.time('initPersistedStores');
    try {
      await startReadableAccountBootStoreInitializers();
    } finally {
      console.timeEnd('initPersistedStores');
    }
  });
}

const initPersistedStoresStateRef = {
  promise: null as Promise<void> | null,
};

export async function startInitPersistedStores() {
  if (initPersistedStoresStateRef.promise) {
    return initPersistedStoresStateRef.promise;
  }

  const promise = initPersistedStores().catch(error => {
    initPersistedStoresStateRef.promise = null;
    throw error;
  });
  initPersistedStoresStateRef.promise = promise;
  await promise;
}

export async function startReadableAccountBootstrapWarmups() {
  const results = await Promise.allSettled([
    startInitPersistedStores(),
    runStartupDiagnosticTask('ensureAccountBalanceSelectionLifecycle', {}, () =>
      ensureAccountBalanceSelectionLifecycle(),
    ),
  ]);

  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error(
        'startReadableAccountBootstrapWarmups::error',
        result.reason,
      );
    }
  });
}

export async function startUnlockScreenBootstrapWarmups() {
  return startReadableAccountBootstrapWarmups();
}
