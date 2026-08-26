import * as appSettings from '@/hooks/appSettings';
import * as appTimeout from '@/hooks/appTimeout';
import * as biometrics from '@/hooks/biometrics';
import * as lang from '@/hooks/lang';
import * as globalStatus from '@/hooks/useGlobalStatus';
import * as computationThread from '@/perfs/thread';
import * as lock from '@/core/apis/lock';
import * as customTestnet from '@/core/serviceApi/customTestnet';
import * as deferredServiceApi from '@/core/serviceApi/createDeferredServiceApi';
import * as syncChain from '@/core/serviceApi/syncChain';
import * as homePreSplashLocalState from '@/setup-home-pre-splash-state';
import * as assetSyncPersistenceQueue from '@/perfs/assetSyncPersistenceQueue';

export const launchTaskLoaders = {
  assetSyncPersistenceQueueRecovery: () =>
    Promise.resolve(assetSyncPersistenceQueue),
  appSettingsAutoLockHydrate: () => Promise.resolve(appSettings),
  appTimeoutAutoLockHydrate: () => Promise.resolve(appTimeout),
  biometricsSystemAuthAvailability: () => Promise.resolve(biometrics),
  bootstrapI18nReady: () => Promise.resolve(lang),
  computationWorkerPrewarm: () => Promise.resolve(computationThread),
  customTestnetSnapshotHydration: () => Promise.resolve(customTestnet),
  globalNetworkPolling: () => Promise.resolve(globalStatus),
  homePreSplashLocalStateWarmup: () => Promise.resolve(homePreSplashLocalState),
  lockUnlockEventBridge: () => Promise.resolve(lock),
  syncChainMetadataWarmup: () => Promise.resolve(syncChain),
  transactionWatchersStart: () => Promise.resolve(deferredServiceApi),
} as const satisfies typeof import('./launchTaskLoaders.lazy').launchTaskLoaders;
