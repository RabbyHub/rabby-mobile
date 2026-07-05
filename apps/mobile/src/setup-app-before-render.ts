type SetupBeforeRenderRuntime =
  typeof import('./setup-app-before-render.runtime');
type ReadableAccountBootstrapRuntime =
  typeof import('./setup-readable-account-bootstrap-warmups');
type ReadableAccountStoresRuntime =
  typeof import('./setup-readable-account-stores');

const setupBeforeRenderRuntimeRef = {
  promise: null as Promise<SetupBeforeRenderRuntime> | null,
};
const readableAccountBootstrapRuntimeRef = {
  promise: null as Promise<ReadableAccountBootstrapRuntime> | null,
};
const readableAccountStoresRuntimeRef = {
  promise: null as Promise<ReadableAccountStoresRuntime> | null,
};

async function loadSetupBeforeRenderRuntime(_reason: string) {
  if (setupBeforeRenderRuntimeRef.promise) {
    return setupBeforeRenderRuntimeRef.promise;
  }

  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-app-before-render.runtime') as SetupBeforeRenderRuntime,
        )
      : import('./setup-app-before-render.runtime')
  ).catch(error => {
    setupBeforeRenderRuntimeRef.promise = null;
    throw error;
  });

  setupBeforeRenderRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

async function loadReadableAccountBootstrapRuntime(_reason: string) {
  if (readableAccountBootstrapRuntimeRef.promise) {
    return readableAccountBootstrapRuntimeRef.promise;
  }

  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-readable-account-bootstrap-warmups') as ReadableAccountBootstrapRuntime,
        )
      : import('./setup-readable-account-bootstrap-warmups')
  ).catch(error => {
    readableAccountBootstrapRuntimeRef.promise = null;
    throw error;
  });

  readableAccountBootstrapRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

async function loadReadableAccountStoresRuntime(_reason: string) {
  if (readableAccountStoresRuntimeRef.promise) {
    return readableAccountStoresRuntimeRef.promise;
  }

  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-readable-account-stores') as ReadableAccountStoresRuntime,
        )
      : import('./setup-readable-account-stores')
  ).catch(error => {
    readableAccountStoresRuntimeRef.promise = null;
    throw error;
  });

  readableAccountStoresRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

export async function startSetupAppBeforeRenderDeferred(
  reason = 'app_could_render',
) {
  await loadSetupBeforeRenderRuntime(reason);
}

export async function startInitPersistedStores() {
  return (
    await loadReadableAccountBootstrapRuntime('start_init_persisted_stores')
  ).startInitPersistedStores();
}

export async function startUnlockScreenBootstrapWarmups() {
  return (
    await loadReadableAccountBootstrapRuntime('unlock_screen_bootstrap_warmups')
  ).startUnlockScreenBootstrapWarmups();
}

export async function startReadableAccountBootstrapWarmups() {
  return (
    await loadReadableAccountBootstrapRuntime(
      'readable_account_bootstrap_warmups',
    )
  ).startReadableAccountBootstrapWarmups();
}

export async function startInitReadableAccountStores() {
  return (
    await loadReadableAccountStoresRuntime('start_init_readable_account_stores')
  ).startInitReadableAccountStores();
}
