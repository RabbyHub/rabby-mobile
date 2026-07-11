import { runStartupDiagnosticTask } from '@/core/utils/startupDiagnostics';

import { scene24hBalanceStore } from './balance24h';
import { startProcessMultiCurveEvents } from './curve24h';
import { startHomeSceneCacheHydrateInitializers } from './initializers';

const homeSceneActivationStateRef = {
  promise: null as Promise<void> | null,
};

export async function startHomeSceneDerivedDataActivation(
  reason = 'unknown',
) {
  if (homeSceneActivationStateRef.promise) {
    return homeSceneActivationStateRef.promise;
  }

  const promise = runStartupDiagnosticTask(
    'homeSceneDerivedDataActivation',
    { reason },
    async () => {
      scene24hBalanceStore.startProcessScene24hBalanceEvents();
      startProcessMultiCurveEvents();
      await startHomeSceneCacheHydrateInitializers();
    },
  ).catch(error => {
    homeSceneActivationStateRef.promise = null;
    throw error;
  });

  homeSceneActivationStateRef.promise = promise;
  await promise;
}
