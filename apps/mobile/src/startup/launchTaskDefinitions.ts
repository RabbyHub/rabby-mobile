import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import type { StartupPhaseTask } from './phaseRegistry';
import { launchTaskLoaders } from './moduleLoading/launchTaskLoaders';
import type { LaunchTaskLoaderCatalog } from './moduleLoading/launchTaskContracts';
import { observeStartupModuleLoad } from './runtimeDiagnostics';

type LaunchTaskKey = keyof typeof STARTUP_TASKS;

export type LaunchTaskDefinition = {
  taskKey: LaunchTaskKey;
  run: () => unknown | Promise<unknown>;
};

type LaunchTaskRegistrationDependencies = {
  registerPhaseTask: (phase: 'launch', task: StartupPhaseTask) => void;
  scheduleTask: (
    run: LaunchTaskDefinition['run'],
    taskKey: LaunchTaskDefinition['taskKey'],
  ) => void;
};

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

export function createLaunchTaskDefinitions(
  loaders: LaunchTaskLoaderCatalog = launchTaskLoaders,
): LaunchTaskDefinition[] {
  return [
    {
      taskKey: 'lockUnlockEventBridge',
      run: async () => {
        const { startLockUnlockEventBridge } = await loadLaunchModule(
          'lockUnlockEventBridge',
          'core/apis/lock',
          loaders.lockUnlockEventBridge,
        );
        startLockUnlockEventBridge();
      },
    },
    {
      taskKey: 'bootstrapI18nReady',
      run: async () => {
        const { startSubscribeLangChange } = await loadLaunchModule(
          'bootstrapI18nReady',
          'hooks/lang',
          loaders.bootstrapI18nReady,
        );
        startSubscribeLangChange();
      },
    },
    {
      taskKey: 'appTimeoutAutoLockHydrate',
      run: async () => {
        const { startAppTimeoutAutoLockHydration } = await loadLaunchModule(
          'appTimeoutAutoLockHydrate',
          'hooks/appTimeout',
          loaders.appTimeoutAutoLockHydrate,
        );
        await startAppTimeoutAutoLockHydration();
      },
    },
    {
      taskKey: 'appSettingsAutoLockHydrate',
      run: async () => {
        const { startAppSettingsAutoLockHydration } = await loadLaunchModule(
          'appSettingsAutoLockHydrate',
          'hooks/appSettings',
          loaders.appSettingsAutoLockHydrate,
        );
        startAppSettingsAutoLockHydration();
      },
    },
    {
      taskKey: 'biometricsSystemAuthAvailability',
      run: async () => {
        const { startBiometricsSystemAuthAvailabilityHydration } =
          await loadLaunchModule(
            'biometricsSystemAuthAvailability',
            'hooks/biometrics',
            loaders.biometricsSystemAuthAvailability,
          );
        startBiometricsSystemAuthAvailabilityHydration();
      },
    },
    {
      taskKey: 'globalNetworkPolling',
      run: async () => {
        const { startGlobalNetworkPolling } = await loadLaunchModule(
          'globalNetworkPolling',
          'hooks/useGlobalStatus',
          loaders.globalNetworkPolling,
        );
        startGlobalNetworkPolling();
      },
    },
    {
      taskKey: 'homePreSplashLocalStateWarmup',
      run: async () => {
        const { warmHomePreSplashLocalState } = await loadLaunchModule(
          'homePreSplashLocalStateWarmup',
          'setup/home-pre-splash-state',
          loaders.homePreSplashLocalStateWarmup,
        );
        warmHomePreSplashLocalState();
      },
    },
    {
      taskKey: 'computationWorkerPrewarm',
      run: async () => {
        const { requestComputationThreadStart } = await loadLaunchModule(
          'computationWorkerPrewarm',
          'perfs/thread',
          loaders.computationWorkerPrewarm,
        );
        requestComputationThreadStart('startup_prewarm');
      },
    },
    {
      taskKey: 'transactionWatchersStart',
      run: async () => {
        const { ensureServiceApiReady } = await loadLaunchModule(
          'transactionWatchersStart',
          'core/serviceApi/createDeferredServiceApi',
          loaders.transactionWatchersStart,
        );
        await Promise.all([
          ensureServiceApiReady('transactionWatcherService'),
          ensureServiceApiReady('transactionBroadcastWatcherService'),
        ]);
      },
    },
    {
      taskKey: 'syncChainMetadataWarmup',
      run: async () => {
        const { ensureSyncChainServiceReady } = await loadLaunchModule(
          'syncChainMetadataWarmup',
          'core/serviceApi/syncChain',
          loaders.syncChainMetadataWarmup,
        );
        await ensureSyncChainServiceReady();
      },
    },
  ];
}

export function registerLaunchTaskDefinitions(
  definitions: LaunchTaskDefinition[],
  dependencies: LaunchTaskRegistrationDependencies,
) {
  definitions.forEach(definition => {
    const task = STARTUP_TASKS[definition.taskKey];
    dependencies.registerPhaseTask('launch', {
      id: task.label,
      run: () => {
        dependencies.scheduleTask(definition.run, definition.taskKey);
      },
    });
  });
}
