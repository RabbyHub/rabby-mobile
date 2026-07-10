import { traceAndroidInstant } from './core/utils/androidTrace';
import type { ReadableAccountStoreWarmupTarget } from './setup-readable-account-stores';

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
    traceAndroidInstant('startup.load_setup_before_render_runtime.reuse', {
      reason: _reason,
    });
    return setupBeforeRenderRuntimeRef.promise;
  }

  const startedAt = Date.now();
  traceAndroidInstant('startup.load_setup_before_render_runtime.start', {
    reason: _reason,
  });
  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-app-before-render.runtime') as SetupBeforeRenderRuntime,
        )
      : import('./setup-app-before-render.runtime')
  )
    .then(runtime => {
      traceAndroidInstant('startup.load_setup_before_render_runtime.end', {
        reason: _reason,
        elapsedMs: Date.now() - startedAt,
      });
      return runtime;
    })
    .catch(error => {
      traceAndroidInstant('startup.load_setup_before_render_runtime.error', {
        reason: _reason,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      setupBeforeRenderRuntimeRef.promise = null;
      throw error;
    });

  setupBeforeRenderRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

async function loadReadableAccountBootstrapRuntime(_reason: string) {
  if (readableAccountBootstrapRuntimeRef.promise) {
    traceAndroidInstant('startup.load_readable_account_bootstrap.reuse', {
      reason: _reason,
    });
    return readableAccountBootstrapRuntimeRef.promise;
  }

  const startedAt = Date.now();
  traceAndroidInstant('startup.load_readable_account_bootstrap.start', {
    reason: _reason,
  });
  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-readable-account-bootstrap-warmups') as ReadableAccountBootstrapRuntime,
        )
      : import('./setup-readable-account-bootstrap-warmups')
  )
    .then(runtime => {
      traceAndroidInstant('startup.load_readable_account_bootstrap.end', {
        reason: _reason,
        elapsedMs: Date.now() - startedAt,
      });
      return runtime;
    })
    .catch(error => {
      traceAndroidInstant('startup.load_readable_account_bootstrap.error', {
        reason: _reason,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      readableAccountBootstrapRuntimeRef.promise = null;
      throw error;
    });

  readableAccountBootstrapRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

async function loadReadableAccountStoresRuntime(_reason: string) {
  if (readableAccountStoresRuntimeRef.promise) {
    traceAndroidInstant('startup.load_readable_account_stores.reuse', {
      reason: _reason,
    });
    return readableAccountStoresRuntimeRef.promise;
  }

  const startedAt = Date.now();
  traceAndroidInstant('startup.load_readable_account_stores.start', {
    reason: _reason,
  });
  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-readable-account-stores') as ReadableAccountStoresRuntime,
        )
      : import('./setup-readable-account-stores')
  )
    .then(runtime => {
      traceAndroidInstant('startup.load_readable_account_stores.end', {
        reason: _reason,
        elapsedMs: Date.now() - startedAt,
      });
      return runtime;
    })
    .catch(error => {
      traceAndroidInstant('startup.load_readable_account_stores.error', {
        reason: _reason,
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      readableAccountStoresRuntimeRef.promise = null;
      throw error;
    });

  readableAccountStoresRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

export async function startSetupAppBeforeRenderDeferred(
  reason = 'app_could_render',
) {
  traceAndroidInstant('startup.start_setup_before_render_deferred.start', {
    reason,
  });
  await loadSetupBeforeRenderRuntime(reason);
  traceAndroidInstant('startup.start_setup_before_render_deferred.end', {
    reason,
  });
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

export async function startInitReadableAccountStores(
  target: ReadableAccountStoreWarmupTarget = 'all',
  reason = 'unknown',
) {
  return (
    await loadReadableAccountStoresRuntime('start_init_readable_account_stores')
  ).startInitReadableAccountStores(target, reason);
}
