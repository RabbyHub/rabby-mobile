import nftListStore from './store/nfts';
import useProtocolListStore from './store/protocols';
import tokenListStore from './store/tokens';

async function initReadableAccountStores() {
  console.time('initReadableAccountStores');
  try {
    await tokenListStore.getState().initStore();
    await nftListStore.getState().initStore();
    await useProtocolListStore.getState().initStore();
  } finally {
    console.timeEnd('initReadableAccountStores');
  }
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
