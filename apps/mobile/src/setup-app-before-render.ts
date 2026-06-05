type SetupBeforeRenderRuntime =
  typeof import('./setup-app-before-render.runtime');

const setupBeforeRenderRuntimeRef = {
  promise: null as Promise<SetupBeforeRenderRuntime> | null,
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

export async function startReadableAccountBootstrapWarmups() {
  (
    await loadSetupBeforeRenderRuntime(
      'start_restore_wallet_connect_sessions_on_unlock',
    )
  ).startRestoreWalletConnectSessionsOnUnlock();

  return (
    await loadSetupBeforeRenderRuntime('readable_account_bootstrap_warmups')
  ).startReadableAccountBootstrapWarmups();
}
