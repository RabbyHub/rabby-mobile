export const launchTaskLoaders = {
  appSettingsAutoLockHydrate: () => import('@/hooks/appSettings'),
  appTimeoutAutoLockHydrate: () => import('@/hooks/appTimeout'),
  biometricsSystemAuthAvailability: () => import('@/hooks/biometrics'),
  bootstrapI18nReady: () => import('@/hooks/lang'),
  computationWorkerPrewarm: () => import('@/perfs/thread'),
  globalNetworkPolling: () => import('@/hooks/useGlobalStatus'),
  homePreSplashLocalStateWarmup: () => import('@/setup-home-pre-splash-state'),
  lockUnlockEventBridge: () => import('@/core/apis/lock'),
  syncChainMetadataWarmup: () => import('@/core/serviceApi/syncChain'),
  transactionWatchersStart: () =>
    import('@/core/serviceApi/createDeferredServiceApi'),
} as const;
