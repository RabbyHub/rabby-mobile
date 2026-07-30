import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { launchTaskLoaders } from '@/startup/moduleLoading/launchTaskLoaders';

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
    launchTaskLoaders.lockUnlockEventBridge,
  );
  startLockUnlockEventBridge();
});

registerLaunchTask('bootstrapI18nReady', async () => {
  const { startSubscribeLangChange } = await loadLaunchModule(
    'bootstrapI18nReady',
    'hooks/lang',
    launchTaskLoaders.bootstrapI18nReady,
  );
  startSubscribeLangChange();
});

registerLaunchTask('appTimeoutAutoLockHydrate', async () => {
  const { startAppTimeoutAutoLockHydration } = await loadLaunchModule(
    'appTimeoutAutoLockHydrate',
    'hooks/appTimeout',
    launchTaskLoaders.appTimeoutAutoLockHydrate,
  );
  startAppTimeoutAutoLockHydration();
});

registerLaunchTask('appSettingsAutoLockHydrate', async () => {
  const { startAppSettingsAutoLockHydration } = await loadLaunchModule(
    'appSettingsAutoLockHydrate',
    'hooks/appSettings',
    launchTaskLoaders.appSettingsAutoLockHydrate,
  );
  startAppSettingsAutoLockHydration();
});

registerLaunchTask('biometricsSystemAuthAvailability', async () => {
  const { startBiometricsSystemAuthAvailabilityHydration } =
    await loadLaunchModule(
      'biometricsSystemAuthAvailability',
      'hooks/biometrics',
      launchTaskLoaders.biometricsSystemAuthAvailability,
    );
  startBiometricsSystemAuthAvailabilityHydration();
});

registerLaunchTask('globalNetworkPolling', async () => {
  const { startGlobalNetworkPolling } = await loadLaunchModule(
    'globalNetworkPolling',
    'hooks/useGlobalStatus',
    launchTaskLoaders.globalNetworkPolling,
  );
  startGlobalNetworkPolling();
});

registerLaunchTask('homePreSplashLocalStateWarmup', async () => {
  const { warmHomePreSplashLocalState } = await loadLaunchModule(
    'homePreSplashLocalStateWarmup',
    'setup/home-pre-splash-state',
    launchTaskLoaders.homePreSplashLocalStateWarmup,
  );
  warmHomePreSplashLocalState();
});

registerLaunchTask('computationWorkerPrewarm', async () => {
  const { requestComputationThreadStart } = await loadLaunchModule(
    'computationWorkerPrewarm',
    'perfs/thread',
    launchTaskLoaders.computationWorkerPrewarm,
  );
  requestComputationThreadStart('startup_prewarm');
});

registerLaunchTask('transactionWatchersStart', async () => {
  const { ensureServiceApiReady } = await loadLaunchModule(
    'transactionWatchersStart',
    'core/serviceApi/createDeferredServiceApi',
    launchTaskLoaders.transactionWatchersStart,
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
    launchTaskLoaders.syncChainMetadataWarmup,
  );
  await ensureSyncChainServiceReady();
});
