import { runStartupTask } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';

import { registerStartupPhaseTask } from './phaseRegistry';

type LaunchTaskKey = keyof typeof STARTUP_TASKS;

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
  const { startLockUnlockEventBridge } = await import('@/core/apis/lock');
  startLockUnlockEventBridge();
});

registerLaunchTask('bootstrapHideSplashOnNavigationReady', async () => {
  const { startHideSplashOnNavigationReady } = await import(
    '@/hooks/useBootstrap'
  );
  startHideSplashOnNavigationReady();
});

registerLaunchTask('bootstrapI18nReady', async () => {
  const { startSubscribeLangChange } = await import('@/hooks/lang');
  startSubscribeLangChange();
});

registerLaunchTask('appTimeoutAutoLockHydrate', async () => {
  const { startAppTimeoutAutoLockHydration } = await import(
    '@/hooks/appTimeout'
  );
  startAppTimeoutAutoLockHydration();
});

registerLaunchTask('appSettingsAutoLockHydrate', async () => {
  const { startAppSettingsAutoLockHydration } = await import(
    '@/hooks/appSettings'
  );
  startAppSettingsAutoLockHydration();
});

registerLaunchTask('biometricsSystemAuthAvailability', async () => {
  const { startBiometricsSystemAuthAvailabilityHydration } = await import(
    '@/hooks/biometrics'
  );
  startBiometricsSystemAuthAvailabilityHydration();
});

registerLaunchTask('globalNetworkPolling', async () => {
  const { startGlobalNetworkPolling } = await import('@/hooks/useGlobalStatus');
  startGlobalNetworkPolling();
});

registerLaunchTask('homePreSplashLocalStateWarmup', async () => {
  const { warmHomePreSplashLocalState } = await import(
    '@/setup-home-pre-splash-state'
  );
  warmHomePreSplashLocalState();
});

registerLaunchTask('computationWorkerPrewarm', async () => {
  const { requestComputationThreadStart } = await import('@/perfs/thread');
  requestComputationThreadStart('startup_prewarm');
});

registerLaunchTask('transactionWatchersStart', async () => {
  const { ensureServiceApiReady } = await import(
    '@/core/serviceApi/createDeferredServiceApi'
  );
  await Promise.all([
    ensureServiceApiReady('transactionWatcherService'),
    ensureServiceApiReady('transactionBroadcastWatcherService'),
  ]);
});

registerLaunchTask('syncChainMetadataWarmup', async () => {
  const { ensureSyncChainServiceReady } = await import(
    '@/core/serviceApi/syncChain'
  );
  await ensureSyncChainServiceReady();
});
