import { runStartupDiagnosticTask } from './core/utils/startupDiagnostics';
import { startReadableAccountHeavyStoreInitializers } from './store/initializers';

async function initReadableAccountStores() {
  return runStartupDiagnosticTask('initReadableAccountStores', {}, async () => {
    console.time('initReadableAccountStores');
    try {
      await startReadableAccountHeavyStoreInitializers();
    } finally {
      console.timeEnd('initReadableAccountStores');
    }
  });
}

const initReadableAccountStoresStateRef = {
  promise: null as Promise<void> | null,
};

export async function startInitReadableAccountStores() {
  if (initReadableAccountStoresStateRef.promise) {
    return initReadableAccountStoresStateRef.promise;
  }

  const promise = initReadableAccountStores().catch(error => {
    initReadableAccountStoresStateRef.promise = null;
    throw error;
  });
  initReadableAccountStoresStateRef.promise = promise;
  await promise;
}
