import type { StartupTaskOptions } from './startupScheduler';

type StartupTaskManifestItem = Omit<StartupTaskOptions, 'tracePrefix'> & {
  label: string;
  owner: string;
  reason: string;
  stage: NonNullable<StartupTaskOptions['stage']>;
  priority: NonNullable<StartupTaskOptions['priority']>;
};

function defineStartupTask<T extends StartupTaskManifestItem>(task: T) {
  return task;
}

export const STARTUP_TASKS = {
  lockUnlockEventBridge: defineStartupTask({
    label: 'lock.unlockEventBridge',
    owner: 'lock',
    reason:
      'register unlock events that bridge keyring unlock to app runtime state',
    stage: 'registration',
    priority: 'critical',
    budgetMs: 8,
  }),
  setupGasAccountInfoFetch: defineStartupTask({
    label: 'setup.gasAccountInfoFetch',
    owner: 'gas-account',
    reason: 'refresh gas account info after Home is usable',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 8000,
    idleTimeoutMs: 5000,
    budgetMs: 120,
  }),
  gasAccountEventBridge: defineStartupTask({
    label: 'gasAccount.eventBridge',
    owner: 'gas-account',
    reason: 'register gas account event listeners',
    stage: 'registration',
    priority: 'normal',
    budgetMs: 8,
  }),
  globalBottomSheetClearListener: defineStartupTask({
    label: 'modal.globalBottomSheetClearListener',
    owner: 'modal',
    reason: 'register global modal cleanup listener',
    stage: 'registration',
    priority: 'high',
    budgetMs: 8,
  }),
  homeTabBackListener: defineStartupTask({
    label: 'home.homeTabBackListener',
    owner: 'home',
    reason: 'register Home tab back navigation listener',
    stage: 'registration',
    priority: 'high',
    budgetMs: 8,
  }),
  biometricsSystemAuthAvailability: defineStartupTask({
    label: 'biometrics.systemAuthAvailability',
    owner: 'biometrics',
    reason: 'preserve existing early platform auth capability hydration',
    stage: 'immediate',
    priority: 'normal',
    budgetMs: 120,
  }),
  appTimeoutAutoLockHydrate: defineStartupTask({
    label: 'appTimeout.autoLockHydrate',
    owner: 'autolock',
    reason: 'hydrate persisted auto-lock settings and register change listener',
    stage: 'immediate',
    priority: 'high',
    budgetMs: 12,
  }),
  appSettingsAutoLockHydrate: defineStartupTask({
    label: 'appSettings.autoLockHydrate',
    owner: 'settings',
    reason: 'hydrate settings-facing auto-lock state',
    stage: 'immediate',
    priority: 'normal',
    budgetMs: 12,
  }),
  globalNetworkPolling: defineStartupTask({
    label: 'network.globalPolling',
    owner: 'network',
    reason: 'preserve existing global network polling startup behavior',
    stage: 'immediate',
    priority: 'normal',
    budgetMs: 30,
  }),
  bootstrapI18nReady: defineStartupTask({
    label: 'bootstrap.i18nReady',
    owner: 'i18n',
    reason:
      'start initial language loading as soon as App mounts without gating native splash hide',
    stage: 'preSplash',
    priority: 'critical',
    budgetMs: 80,
  }),
  homePreSplashLocalStateWarmup: defineStartupTask({
    label: 'home.preSplashLocalStateWarmup',
    owner: 'home',
    reason:
      'read local-only Home display gates before the first Home render without gating splash hide',
    stage: 'preSplash',
    priority: 'high',
    budgetMs: 16,
  }),
  computationWorkerPrewarm: defineStartupTask({
    label: 'computation.workerPrewarm',
    owner: 'worker',
    reason:
      'prewarm computation worker infrastructure early while keeping heavy calculations on demand',
    stage: 'preSplash',
    priority: 'normal',
    budgetMs: 8,
  }),
  homeHistorySyncListener: defineStartupTask({
    label: 'homeHistory.syncListener',
    owner: 'home',
    reason:
      'register history sync listener and preserve existing pending tx count refresh',
    stage: 'registration',
    priority: 'normal',
    budgetMs: 80,
  }),
  transactionWatchersStart: defineStartupTask({
    label: 'transaction.watchersStart',
    owner: 'transaction',
    reason:
      'restore and monitor pending transactions after Home is usable without coupling watchers to keyring construction',
    stage: 'homePostStartupReady',
    priority: 'high',
    fallbackMs: 5000,
    budgetMs: 180,
  }),
  homeHistoryWarmup: defineStartupTask({
    label: 'home.historyWarmup',
    owner: 'home-history',
    reason:
      'warm top account transaction history after Home is usable without gating splash',
    stage: 'homePostStartupIdle',
    priority: 'normal',
    delayMs: 1200,
    fallbackMs: 8000,
    idleTimeoutMs: 5000,
    budgetMs: 450,
  }),
  homeReceiveAddressListWarmup: defineStartupTask({
    label: 'home.receiveAddressListWarmup',
    owner: 'home-receive',
    reason: 'warm receive account list data and modules after Home is usable',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 1500,
    fallbackMs: 8000,
    idleTimeoutMs: 5000,
    budgetMs: 240,
  }),
  homeLendingDataWarmup: defineStartupTask({
    label: 'home.lendingDataWarmup',
    owner: 'lending',
    reason:
      'warm Lending health-factor data only after Home is usable and early interactions are likely quiet',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 10000,
    idleTimeoutMs: 5000,
    budgetMs: 600,
  }),
  cexSupportListFetch: defineStartupTask({
    label: 'cex.supportListFetch',
    owner: 'cex',
    reason: 'warm remote CEX support list after Home is usable',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 8000,
    idleTimeoutMs: 5000,
    budgetMs: 120,
  }),
  browserGlobalClearListener: defineStartupTask({
    label: 'browser.globalClearListener',
    owner: 'browser',
    reason: 'register global browser cleanup listener',
    stage: 'registration',
    priority: 'normal',
    budgetMs: 8,
  }),
  serviceStoreStubBrowserDappWarmup: defineStartupTask({
    label: 'serviceStoreStub.browserDappWarmup',
    owner: 'service-store-stub',
    reason:
      'hydrate browser, dapp, and custom RPC local stores after Home is usable',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 1500,
    fallbackMs: 10000,
    idleTimeoutMs: 5000,
    budgetMs: 450,
  }),
  setupRuntimeCoreLifecycle: defineStartupTask({
    label: 'setup.runtimeCoreLifecycle',
    owner: 'bootstrap',
    reason:
      'register post-startup core lifecycle listeners after Home is usable',
    stage: 'homePostStartupReady',
    priority: 'high',
    fallbackMs: 5000,
    budgetMs: 160,
  }),
  setupRuntimeUnlockPolicies: defineStartupTask({
    label: 'setup.runtimeUnlockPolicies',
    owner: 'bootstrap',
    reason:
      'register post-unlock store hydration and WalletConnect restore policies',
    stage: 'registration',
    priority: 'high',
    budgetMs: 80,
  }),
  setupRuntimeRemoteWarmups: defineStartupTask({
    label: 'setup.runtimeRemoteWarmups',
    owner: 'bootstrap',
    reason:
      'start useful remote/cache warmups after Home, without gating first screen',
    stage: 'homePostStartupIdle',
    priority: 'normal',
    fallbackMs: 8000,
    idleTimeoutMs: 5000,
    budgetMs: 320,
  }),
  setupRuntimeHardwareSubscriptions: defineStartupTask({
    label: 'setup.runtimeHardwareSubscriptions',
    owner: 'hardware',
    reason: 'register hardware integrations after early Home interactions',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 10000,
    idleTimeoutMs: 5000,
    budgetMs: 120,
  }),
  setupRuntimeSecuritySubscriptions: defineStartupTask({
    label: 'setup.runtimeSecuritySubscriptions',
    owner: 'security',
    reason:
      'register screenshot and sensitive-scene guards after Home is usable',
    stage: 'homePostStartupReady',
    priority: 'normal',
    fallbackMs: 5000,
    budgetMs: 120,
  }),
  setupRuntimePerpsAppStateSubscription: defineStartupTask({
    label: 'setup.runtimePerpsAppStateSubscription',
    owner: 'perps',
    reason: 'register perps app-state subscription after Home is usable',
    stage: 'homePostStartupReady',
    priority: 'normal',
    fallbackMs: 5000,
    budgetMs: 80,
  }),
  setupRuntimeNotificationBootstrap: defineStartupTask({
    label: 'setup.runtimeNotificationBootstrap',
    owner: 'notification',
    reason:
      'prepare notification permissions and remote notification listeners after Home',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 10000,
    idleTimeoutMs: 5000,
    budgetMs: 160,
  }),
  perpsFetchMarketData: defineStartupTask({
    label: 'perps.fetchMarketData',
    owner: 'perps',
    reason:
      'warm market list only after early Home interactions are likely complete',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 15000,
    fallbackMs: 30000,
    idleTimeoutMs: 10000,
    budgetMs: 450,
  }),
  perpsFetchFavoriteMarkets: defineStartupTask({
    label: 'perps.fetchFavoriteMarkets',
    owner: 'perps',
    reason: 'warm user preference data after Home',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 8000,
    budgetMs: 200,
  }),
  perpsFetchMarginModeByCoin: defineStartupTask({
    label: 'perps.fetchMarginModeByCoin',
    owner: 'perps',
    reason: 'warm perps margin mode cache after Home',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 8000,
    budgetMs: 200,
  }),
  perpsHomePositionSubscription: defineStartupTask({
    label: 'perps.homePositionSubscription',
    owner: 'perps',
    reason:
      'subscribe Home Perps position data after early Home interactions are likely complete',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 5000,
    fallbackMs: 12000,
    idleTimeoutMs: 6000,
    budgetMs: 220,
  }),
  readableAccountStoresIdleWarmup: defineStartupTask({
    label: 'readableAccountStores.idleWarmup',
    owner: 'home-assets',
    reason:
      'warm heavy readable account stores only after Home has been usable for a while',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 12000,
    fallbackMs: 20000,
    idleTimeoutMs: 10000,
    budgetMs: 450,
  }),
  homeSceneDerivedDataActivation: defineStartupTask({
    label: 'home.sceneDerivedDataActivation',
    owner: 'home-assets',
    reason:
      'activate Home 24h and curve derived data after the first Home frame is usable',
    stage: 'homePostStartupReady',
    priority: 'normal',
    fallbackMs: 3000,
    budgetMs: 160,
  }),
  currencyServiceBinding: defineStartupTask({
    label: 'currency.serviceBinding',
    owner: 'currency',
    reason:
      'bind currency service and refresh remote currency list after early Home interactions are likely complete',
    stage: 'homePostStartupIdle',
    priority: 'low',
    delayMs: 3000,
    fallbackMs: 10000,
    idleTimeoutMs: 5000,
    budgetMs: 450,
  }),
  syncChainMetadataWarmup: defineStartupTask({
    label: 'chain.syncMetadataWarmup',
    owner: 'chain',
    reason:
      'restore cached dynamic chain metadata after Home and refresh it without gating first paint',
    stage: 'homePostStartupReady',
    priority: 'normal',
    fallbackMs: 5000,
    budgetMs: 120,
  }),
  homeDbLowPriorityRelease: defineStartupTask({
    label: 'home.dbLowPriorityRelease',
    owner: 'home-db',
    reason:
      'release low-priority DB writes only after early Home interactions are likely quiet',
    stage: 'homePostStartupIdle',
    priority: 'high',
    delayMs: 1500,
    fallbackMs: 10000,
    idleTimeoutMs: 5000,
    budgetMs: 20,
  }),
  databaseAppDataSourceLoader: defineStartupTask({
    label: 'database.appDataSourceLoader',
    owner: 'database',
    reason:
      'open the app SQLite data source only after a database consumer explicitly requests it',
    stage: 'onDemand',
    priority: 'high',
    budgetMs: 600,
  }),
} as const;

export type StartupTaskManifest = typeof STARTUP_TASKS;
