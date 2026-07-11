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
  bootstrapHideSplashOnNavigationReady: defineStartupTask({
    label: 'bootstrap.hideSplashOnNavigationReady',
    owner: 'bootstrap',
    reason: 'hide native splash once app navigation is ready',
    stage: 'registration',
    priority: 'critical',
    budgetMs: 8,
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
  homeHistorySyncListener: defineStartupTask({
    label: 'homeHistory.syncListener',
    owner: 'home',
    reason:
      'register history sync listener and preserve existing pending tx count refresh',
    stage: 'registration',
    priority: 'normal',
    budgetMs: 80,
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
