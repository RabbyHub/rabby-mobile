import type { CoreServiceName } from '@/core/services/serviceRegistry';

type LaunchTaskModuleLoader<TModule> = () => Promise<TModule>;

export type LaunchTaskLoaderCatalog = {
  appSettingsAutoLockHydrate: LaunchTaskModuleLoader<{
    startAppSettingsAutoLockHydration: () => unknown;
  }>;
  appTimeoutAutoLockHydrate: LaunchTaskModuleLoader<{
    startAppTimeoutAutoLockHydration: () => unknown | Promise<unknown>;
  }>;
  biometricsSystemAuthAvailability: LaunchTaskModuleLoader<{
    startBiometricsSystemAuthAvailabilityHydration: () => unknown;
  }>;
  bootstrapI18nReady: LaunchTaskModuleLoader<{
    startSubscribeLangChange: () => unknown;
  }>;
  computationWorkerPrewarm: LaunchTaskModuleLoader<{
    requestComputationThreadStart: (reason?: string) => unknown;
  }>;
  globalNetworkPolling: LaunchTaskModuleLoader<{
    startGlobalNetworkPolling: () => unknown;
  }>;
  homePreSplashLocalStateWarmup: LaunchTaskModuleLoader<{
    warmHomePreSplashLocalState: () => unknown;
  }>;
  lockUnlockEventBridge: LaunchTaskModuleLoader<{
    startLockUnlockEventBridge: () => unknown;
  }>;
  syncChainMetadataWarmup: LaunchTaskModuleLoader<{
    ensureSyncChainServiceReady: () => unknown | Promise<unknown>;
  }>;
  transactionWatchersStart: LaunchTaskModuleLoader<{
    ensureServiceApiReady: (
      serviceName: CoreServiceName,
    ) => unknown | Promise<unknown>;
  }>;
};
