import nftListStore from './store/nfts';
import useProtocolListStore from './store/protocols';
import tokenListStore from './store/tokens';
import { runStartupDiagnosticTask } from './core/utils/startupDiagnostics';

async function initReadableAccountStores() {
  return runStartupDiagnosticTask('initReadableAccountStores', {}, async () => {
    console.time('initReadableAccountStores');
    try {
      await runStartupDiagnosticTask('tokenListStore.initStore', {}, () =>
        tokenListStore.getState().initStore(),
      );
      await runStartupDiagnosticTask('nftListStore.initStore', {}, () =>
        nftListStore.getState().initStore(),
      );
      await runStartupDiagnosticTask('protocolListStore.initStore', {}, () =>
        useProtocolListStore.getState().initStore(),
      );
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
