import type { LaunchTaskLoaderCatalog } from './launchTaskContracts';

export const launchTaskLoaders = {
  appSettingsAutoLockHydrate: () => import('@/hooks/appSettings'),
  appTimeoutAutoLockHydrate: () => import('@/hooks/appTimeout'),
  biometricsSystemAuthAvailability: () => import('@/hooks/biometrics'),
  bootstrapI18nReady: () => import('@/hooks/lang'),
  computationWorkerPrewarm: () => import('@/perfs/thread'),
  customTestnetSnapshotHydration: () =>
    import('@/core/serviceApi/customTestnet'),
  globalNetworkPolling: () => import('@/hooks/useGlobalStatus'),
  homePreSplashLocalStateWarmup: () => import('@/setup-home-pre-splash-state'),
  lockUnlockEventBridge: () => import('@/core/apis/lock'),
  setupRuntimeSecuritySubscriptions: () =>
    import('@/startup/setupRuntimeSecuritySubscriptions'),
  syncChainMetadataWarmup: () => import('@/core/serviceApi/syncChain'),
  transactionWatchersStart: () =>
    import('@/core/serviceApi/createDeferredServiceApi'),
} as const satisfies LaunchTaskLoaderCatalog;
