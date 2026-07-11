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
    stage: 'immediate',
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
    stage: 'immediate',
    priority: 'normal',
    budgetMs: 8,
  }),
  globalBottomSheetClearListener: defineStartupTask({
    label: 'modal.globalBottomSheetClearListener',
    owner: 'modal',
    reason: 'register global modal cleanup listener',
    stage: 'immediate',
    priority: 'high',
    budgetMs: 8,
  }),
  homeTabBackListener: defineStartupTask({
    label: 'home.homeTabBackListener',
    owner: 'home',
    reason: 'register Home tab back navigation listener',
    stage: 'immediate',
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
    stage: 'immediate',
    priority: 'critical',
    budgetMs: 8,
  }),
  homeHistorySyncListener: defineStartupTask({
    label: 'homeHistory.syncListener',
    owner: 'home',
    reason:
      'register history sync listener and preserve existing pending tx count refresh',
    stage: 'immediate',
    priority: 'normal',
    budgetMs: 80,
  }),
  cexSupportListFetch: defineStartupTask({
    label: 'cex.supportListFetch',
    owner: 'cex',
    reason: 'preserve existing CEX support list warm fetch',
    stage: 'immediate',
    priority: 'low',
    budgetMs: 120,
  }),
  browserGlobalClearListener: defineStartupTask({
    label: 'browser.globalClearListener',
    owner: 'browser',
    reason: 'register global browser cleanup listener',
    stage: 'immediate',
    priority: 'normal',
    budgetMs: 8,
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
} as const;

export type StartupTaskManifest = typeof STARTUP_TASKS;
