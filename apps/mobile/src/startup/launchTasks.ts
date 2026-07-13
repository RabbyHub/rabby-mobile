import { runStartupTask } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';

import { registerStartupPhaseTask } from './phaseRegistry';
import {
  markStartupModuleLoaded,
  observeStartupModuleLoad,
} from './runtimeDiagnostics';

type LaunchTaskKey = keyof typeof STARTUP_TASKS;

markStartupModuleLoaded({
  name: 'startup/launchTasks',
  group: 'launch',
  taskStage: 'registration',
  reason: 'static launch task registry',
});

function loadLaunchModule<T>(
  taskKey: LaunchTaskKey,
  name: string,
  loader: () => Promise<T>,
) {
  const task = STARTUP_TASKS[taskKey];
  return observeStartupModuleLoad(
    {
      name,
      group: 'launch',
      taskStage: task.stage,
      reason: task.reason,
    },
    loader,
  );
}

function registerLaunchTask(
  taskKey: LaunchTaskKey,
  run: () => unknown | Promise<unknown>,
) {
  const task = STARTUP_TASKS[taskKey];
  registerStartupPhaseTask('launch', {
    id: task.label,
    run: () => {
      runStartupTask(run, STARTUP_TASKS[taskKey]);
    },
  });
}

registerLaunchTask('lockUnlockEventBridge', async () => {
  const { startLockUnlockEventBridge } = await loadLaunchModule(
    'lockUnlockEventBridge',
    'core/apis/lock',
    () => import('@/core/apis/lock'),
  );
  startLockUnlockEventBridge();
});

registerLaunchTask('bootstrapHideSplashOnNavigationReady', async () => {
  const { startHideSplashOnNavigationReady } = await loadLaunchModule(
    'bootstrapHideSplashOnNavigationReady',
    'hooks/useBootstrap',
    () => import('@/hooks/useBootstrap'),
  );
  startHideSplashOnNavigationReady();
});

registerLaunchTask('bootstrapI18nReady', async () => {
  const { startSubscribeLangChange } = await loadLaunchModule(
    'bootstrapI18nReady',
    'hooks/lang',
    () => import('@/hooks/lang'),
  );
  startSubscribeLangChange();
});

registerLaunchTask('appTimeoutAutoLockHydrate', async () => {
  const { startAppTimeoutAutoLockHydration } = await loadLaunchModule(
    'appTimeoutAutoLockHydrate',
    'hooks/appTimeout',
    () => import('@/hooks/appTimeout'),
  );
  startAppTimeoutAutoLockHydration();
});

registerLaunchTask('appSettingsAutoLockHydrate', async () => {
  const { startAppSettingsAutoLockHydration } = await loadLaunchModule(
    'appSettingsAutoLockHydrate',
    'hooks/appSettings',
    () => import('@/hooks/appSettings'),
  );
  startAppSettingsAutoLockHydration();
});

registerLaunchTask('biometricsSystemAuthAvailability', async () => {
  const { startBiometricsSystemAuthAvailabilityHydration } =
    await loadLaunchModule(
      'biometricsSystemAuthAvailability',
      'hooks/biometrics',
      () => import('@/hooks/biometrics'),
    );
  startBiometricsSystemAuthAvailabilityHydration();
});

registerLaunchTask('globalNetworkPolling', async () => {
  const { startGlobalNetworkPolling } = await loadLaunchModule(
    'globalNetworkPolling',
    'hooks/useGlobalStatus',
    () => import('@/hooks/useGlobalStatus'),
  );
  startGlobalNetworkPolling();
});

registerLaunchTask('homePreSplashLocalStateWarmup', async () => {
  const { warmHomePreSplashLocalState } = await loadLaunchModule(
    'homePreSplashLocalStateWarmup',
    'setup/home-pre-splash-state',
    () => import('@/setup-home-pre-splash-state'),
  );
  warmHomePreSplashLocalState();
});

registerLaunchTask('computationWorkerPrewarm', async () => {
  const { requestComputationThreadStart } = await loadLaunchModule(
    'computationWorkerPrewarm',
    'perfs/thread',
    () => import('@/perfs/thread'),
  );
  requestComputationThreadStart('startup_prewarm');
});

registerLaunchTask('transactionWatchersStart', async () => {
  const { ensureServiceApiReady } = await loadLaunchModule(
    'transactionWatchersStart',
    'core/serviceApi/createDeferredServiceApi',
    () => import('@/core/serviceApi/createDeferredServiceApi'),
  );
  await Promise.all([
    ensureServiceApiReady('transactionWatcherService'),
    ensureServiceApiReady('transactionBroadcastWatcherService'),
  ]);
});

registerLaunchTask('syncChainMetadataWarmup', async () => {
  const { ensureSyncChainServiceReady } = await loadLaunchModule(
    'syncChainMetadataWarmup',
    'core/serviceApi/syncChain',
    () => import('@/core/serviceApi/syncChain'),
  );
  await ensureSyncChainServiceReady();
});
