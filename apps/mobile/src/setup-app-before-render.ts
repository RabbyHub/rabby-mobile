import {
  recordStartupProbe,
  recordStartupProbeOnce,
  trackStartupProbePromise,
} from './debug/startupProbe';

type SetupBeforeRenderRuntime =
  typeof import('./setup-app-before-render.runtime');

const setupBeforeRenderRuntimeRef = {
  promise: null as Promise<SetupBeforeRenderRuntime> | null,
};

async function loadSetupBeforeRenderRuntime(reason: string) {
  if (setupBeforeRenderRuntimeRef.promise) {
    return setupBeforeRenderRuntimeRef.promise;
  }

  const loadMode = __DEV__ ? 'sync_require' : 'dynamic_import';

  recordStartupProbeOnce('SETUP_APP_BEFORE_RENDER_IMPORT_START', {
    payload: {
      reason,
      loadMode,
    },
  });

  const runtimePromise = (
    __DEV__
      ? Promise.resolve(
          require('./setup-app-before-render.runtime') as SetupBeforeRenderRuntime,
        )
      : trackStartupProbePromise(
          'setupAppBeforeRenderImport',
          import('./setup-app-before-render.runtime'),
        )
  )
    .then(runtime => {
      recordStartupProbeOnce('SETUP_APP_BEFORE_RENDER_IMPORT_DONE', {
        payload: {
          reason,
          loadMode,
        },
      });
      return runtime;
    })
    .catch(error => {
      setupBeforeRenderRuntimeRef.promise = null;
      recordStartupProbe('SETUP_APP_BEFORE_RENDER_IMPORT_FAIL', {
        level: 'error',
        payload: {
          reason,
          loadMode,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    });

  setupBeforeRenderRuntimeRef.promise = runtimePromise;
  return runtimePromise;
}

export async function startSetupAppBeforeRenderDeferred(
  reason = 'app_could_render',
) {
  await loadSetupBeforeRenderRuntime(reason);
}

export async function startInitPersistedStores() {
  return (
    await loadSetupBeforeRenderRuntime('start_init_persisted_stores')
  ).startInitPersistedStores();
}

export async function startUnlockScreenBootstrapWarmups() {
  return (
    await loadSetupBeforeRenderRuntime('unlock_screen_bootstrap_warmups')
  ).startUnlockScreenBootstrapWarmups();
}
