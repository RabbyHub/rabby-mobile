export const enum APP_STORE_NAMES {
  'bridge' = 'bridge',
  'browserHistory' = 'browserHistory',
  'rpc' = 'rpc',
  'customTestnet' = 'customTestnet',
  'dapps' = 'dapps',
  'gasAccount' = 'gasAccount',
  'HDKeyRingLastAddAddrTime' = 'HDKeyRingLastAddAddrTime',

  'preference' = 'preference',

  'RabbyPoints' = 'RabbyPoints',

  'securityEngine' = 'securityEngine',

  'swap' = 'swap',
  'transactionBroadcastWatcher' = 'transactionBroadcastWatcher',
  'txHistory' = 'txHistory',
  'transactions' = 'transactions',

  'whitelist' = 'whitelist',

  'contactBook' = 'contactBook',
  'offlineChain' = 'offlineChain',

  'browser' = 'browser',
  'syncChain' = 'syncChain',
  'openapi' = 'openapi',

  'metamaskMode' = 'metamaskMode',

  'perps' = 'perps',
  'lending' = 'lending',

  'currency' = 'currency',
}

export type STORE_SERVICE_MAP = {
  // contactBook
  [APP_STORE_NAMES.contactBook]: import('@rabby-wallet/service-address').ContactBookService;
  [APP_STORE_NAMES.HDKeyRingLastAddAddrTime]: import('@/core/services/hdKeyringService').HDKeyringService;
  // dappService
  [APP_STORE_NAMES.dapps]: import('@/core/services/dappService').DappService;
  // browserHistoryService
  [APP_STORE_NAMES.browserHistory]: import('@/core/services/browserHistoryService').BrowserHistoryService;
  // preferenceService
  [APP_STORE_NAMES.preference]: import('@/core/services/preference').PreferenceService;
  // whitelistService
  [APP_STORE_NAMES.whitelist]: import('@/core/services/whitelist').WhitelistService;
  // transactionHistoryService
  [APP_STORE_NAMES.txHistory]: import('@/core/services/transactionHistory').TransactionHistoryService;
  // transactionWatcherService
  [APP_STORE_NAMES.transactions]: import('@/core/services/transactionWatcher').TransactionWatcherService;
  // transactionBroadcastWatcher
  [APP_STORE_NAMES.transactionBroadcastWatcher]: import('@/core/services/transactionBroadcastWatcher').TransactionBroadcastWatcherService;
  // securityEngineService
  [APP_STORE_NAMES.securityEngine]: import('@/core/services/securityEngine').SecurityEngineService;
  // rabbyPointsService
  [APP_STORE_NAMES.RabbyPoints]: import('@/core/services/rabbyPoints').RabbyPointsService;
  // swapService
  [APP_STORE_NAMES.swap]: import('@/core/services/swap').SwapService;
  // bridgeService
  [APP_STORE_NAMES.bridge]: import('@/core/services/bridge').BridgeService;
  // gasAccountService
  [APP_STORE_NAMES.gasAccount]: import('@/core/services/gasAccount').GasAccountService;

  [APP_STORE_NAMES.offlineChain]: import('@/core/services/offlineChain').OfflineChainService;

  [APP_STORE_NAMES.browser]: import('@/core/services/browserService').BrowserService;

  [APP_STORE_NAMES.metamaskMode]: import('@/core/services/metamaskModeService').MetamaskModeService;
  [APP_STORE_NAMES.syncChain]: import('@/core/services/syncChainService').SyncChainService;
  [APP_STORE_NAMES.perps]: import('@/core/services/perpsService').PerpsService;
  [APP_STORE_NAMES.lending]: import('@/core/services/lendingService').LendingService;
  [APP_STORE_NAMES.currency]: import('@/core/services/currencyService').CurrencyService;
};

export type MIGRATABLE_STORE_SERVICE = keyof STORE_SERVICE_MAP;
export type STORE_BASED_SERVICE = STORE_SERVICE_MAP[MIGRATABLE_STORE_SERVICE];
export type GET_SERVICE_BY_NAME<T extends MIGRATABLE_STORE_SERVICE> =
  STORE_SERVICE_MAP[T];
