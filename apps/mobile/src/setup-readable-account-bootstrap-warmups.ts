import {
  balance24hStore,
  hydrateCachedHome24hBalanceScene,
} from './store/balance24h';
import { hydrateCachedHomeDayCurve, initCurve24hStore } from './store/curve24h';
import { useAppChainStore } from './store/appchain';
import addressBalanceStore from './store/balance';
import { ensureAccountBalanceSelectionLifecycle } from './store/balanceAccountSelection';

async function initPersistedStores() {
  console.time('initPersistedStores');
  try {
    await useAppChainStore.getState().initStore();
    await Promise.all([
      addressBalanceStore.initStore(),
      balance24hStore.initStore(),
      initCurve24hStore(),
    ]);
    hydrateCachedHome24hBalanceScene();
    hydrateCachedHomeDayCurve();
  } finally {
    console.timeEnd('initPersistedStores');
  }
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
    ensureAccountBalanceSelectionLifecycle(),
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
